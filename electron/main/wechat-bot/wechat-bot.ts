import {ILinkAPI, WeixinMessage, QRCodeResult, QRCodeStatus} from './ilink-api'
import {chatWithLLM} from '../llm'
import {settingsDb} from '../db/settings'
import {notificationConfigsDb} from '../db/notification-configs'
import {chatHistoryDb} from '../db/chat-history'
import {ReminderScheduler} from '../scheduler'

export type WeChatBotStatus = 'disconnected' | 'waiting_qrcode' | 'connecting' | 'connected'

export interface WeChatBotState {
    status: WeChatBotStatus
    nickname?: string
    headImgUrl?: string
    recentContacts: Array<{uin: string; nickname: string}>
    isBound: boolean
}

class WeChatBot {
    private api: ILinkAPI
    private _status: WeChatBotStatus = 'disconnected'
    private _nickname: string = ''
    private _headImgUrl: string = ''
    private _polling: boolean = false
    private _cursor: string = ''
    private _scheduler: ReminderScheduler | null = null
    private _recentContacts: Map<string, string> = new Map()
    private _qrcodeKey: string = ''
    private _pollAbort: boolean = false
    private _initialized: boolean = false

    // 每个联系人的对话上下文（简单实现：保留最近几轮）
    private _chatContexts: Map<string, Array<{role: string; content: string}>> = new Map()
    // 每个联系人对应的 chat session id
    private _chatSessionIds: Map<string, number> = new Map()
    private static MAX_CONTEXT_LENGTH = 20

    constructor() {
        this.api = new ILinkAPI()
    }

    /** 从数据库恢复设置，必须在 initDatabase 之后调用 */
    private ensureInit(): void {
        if (this._initialized) return
        this._initialized = true
        try {
            const savedToken = settingsDb.get('wechat_bot_token') || ''
            if (savedToken) {
                this.api.setToken(savedToken)
            }
            const savedBaseUrl = settingsDb.get('wechat_bot_base_url') || ''
            if (savedBaseUrl) {
                this.api.setBaseUrl(savedBaseUrl)
            }
        } catch {
            // 数据库未就绪时忽略，后续操作会再次尝试
        }
    }

    setScheduler(scheduler: ReminderScheduler | null): void {
        this._scheduler = scheduler
    }

    // ======================== 状态访问 ========================

    getState(): WeChatBotState {
        this.ensureInit()
        const remindUserId = settingsDb.get('wechat_bot_remind_user_id') || ''
        return {
            status: this._status,
            nickname: this._nickname,
            headImgUrl: this._headImgUrl,
            recentContacts: Array.from(this._recentContacts.entries())
                .slice(-10)
                .map(([uin, nickname]) => ({uin, nickname})),
            isBound: this._status === 'connected' && !!remindUserId
        }
    }

    get status(): WeChatBotStatus {
        return this._status
    }

    // ======================== 二维码登录 ========================

    async getQRCode(): Promise<QRCodeResult> {
        this.ensureInit()
        const result = await this.api.getQRCode()
        this._qrcodeKey = result.qrcode_key || ''
        this._status = 'waiting_qrcode'
        return result
    }

    async checkQRCodeStatus(): Promise<QRCodeStatus> {
        this.ensureInit()
        if (!this._qrcodeKey) {
            throw new Error('请先获取二维码')
        }

        const result = await this.api.getQRCodeStatus(this._qrcodeKey)
        console.log('[WeChatBot] checkQRCodeStatus result:', JSON.stringify(result))

        if (result.status === 'confirmed') {
            this._status = 'connected'
            this._nickname = result.nickname || ''
            this._headImgUrl = result.head_img_url || ''

            // 持久化 token
            if (result.bot_token) {
                settingsDb.set('wechat_bot_token', result.bot_token)
            }
            if (result.baseurl) {
                settingsDb.set('wechat_bot_base_url', result.baseurl)
                this.api.setBaseUrl(result.baseurl)
            }
            if (this._nickname) {
                settingsDb.set('wechat_bot_nickname', this._nickname)
            }

            // 扫码确认后自动开始轮询
            this.startPolling()
        } else if (result.status === 'expired' || result.status === 'canceled') {
            this._status = 'disconnected'
            this._qrcodeKey = ''
        }

        return result
    }

    // ======================== 启停控制 ========================

    async login(): Promise<void> {
        this.ensureInit()
        if (!this.api.getToken()) {
            throw new Error('请先扫码登录获取 token')
        }
        this._status = 'connected'
        this.startPolling()
    }

    async logout(): Promise<void> {
        this.ensureInit()
        this.stopPolling()
        this.api.setToken('')
        this._status = 'disconnected'
        this._nickname = ''
        this._headImgUrl = ''
        this._cursor = ''
        this._chatContexts.clear()
        this._chatSessionIds.clear()
        this._recentContacts.clear()
        settingsDb.set('wechat_bot_token', '')
        // 解绑时删除提醒接收人并关闭微信通知渠道
        settingsDb.set('wechat_bot_remind_user_id', '')
        settingsDb.set('wechat_bot_remind_nickname', '')
        notificationConfigsDb.update('wechat_bot', {is_enabled: 0})
    }

    // ======================== 消息轮询 ========================

    private startPolling(): void {
        if (this._polling) return
        this._polling = true
        this._pollAbort = false
        console.log('[WeChatBot] 开始消息轮询')
        this.pollLoop()
    }

    private stopPolling(): void {
        this._pollAbort = true
        this._polling = false
        console.log('[WeChatBot] 停止消息轮询')
    }

    private async pollLoop(): Promise<void> {
        while (this._polling && !this._pollAbort) {
            try {
                const result = await this.api.getUpdates(this._cursor)
                this._cursor = result.get_updates_buf

                if (result.msgs && result.msgs.length > 0) {
                    for (const msg of result.msgs) {
                        await this.handleMessage(msg)
                    }
                }

                const delay = result.longpolling_timeout_ms
                    ? Math.min(result.longpolling_timeout_ms, 5000)
                    : 5000
                await this.sleep(delay)
            } catch (e: any) {
                if (e.message === 'SESSION_EXPIRED') {
                    console.error('[WeChatBot] 会话已过期，需要重新登录')
                    this.stopPolling()
                    this._status = 'disconnected'
                    settingsDb.set('wechat_bot_token', '')
                    break
                }
                console.error('[WeChatBot] 轮询错误:', e.message)
                await this.sleep(5000)
            }
        }
    }

    // ======================== 消息处理 ========================

    /** 从 WeixinMessage 中提取文本内容 */
    private extractTextContent(msg: WeixinMessage): string {
        if (!msg.item_list || msg.item_list.length === 0) return ''

        const texts: string[] = []
        for (const item of msg.item_list) {
            if (item.type === 1 && item.text_item?.text) {
                texts.push(item.text_item.text)
            }
            if (item.type === 3 && item.voice_item?.text) {
                texts.push(item.voice_item.text)
            }
        }
        return texts.join('\n').trim()
    }

    /** 获取或创建微信联系人的 chat session */
    private getOrCreateSession(fromUserId: string, nickname: string): number {
        let sessionId = this._chatSessionIds.get(fromUserId)
        if (sessionId) return sessionId

        // 查找已有的 session，标题格式: [微信] nickname
        const sessions = chatHistoryDb.listSessions()
        const existing = sessions.find(s => s.title === `[微信] ${nickname}`)
        if (existing) {
            sessionId = existing.id
        } else {
            const newSession = chatHistoryDb.createSession(`[微信] ${nickname}`)
            sessionId = newSession.id
        }

        this._chatSessionIds.set(fromUserId, sessionId)
        return sessionId
    }

    private async handleMessage(msg: WeixinMessage): Promise<void> {
        // 只处理用户消息 (message_type=1)
        if (msg.message_type !== 1) return

        const content = this.extractTextContent(msg)
        if (!content) return

        const fromUserId = msg.from_user_id || ''
        if (!fromUserId) return

        const rawId = fromUserId.split('@')[0]
        const nickname = `对话`

        // 记录最近联系人
        this._recentContacts.set(fromUserId, nickname)

        // 自动绑定提醒接收人：给机器人发消息的用户自动成为提醒接收人
        const currentRemindUser = settingsDb.get('wechat_bot_remind_user_id') || ''
        if (!currentRemindUser || currentRemindUser !== fromUserId) {
            settingsDb.set('wechat_bot_remind_user_id', fromUserId)
            settingsDb.set('wechat_bot_remind_nickname', nickname)
            console.log(`[WeChatBot] 绑定提醒接收人: ${nickname}(${fromUserId})`)
        }

        console.log(`[WeChatBot] 收到消息: ${nickname}(${fromUserId}): ${content.substring(0, 100)}`)

        try {
            // 发送"正在输入"状态
            await this.api.sendTyping(fromUserId, msg.context_token)

            // 获取或创建对话上下文
            let context = this._chatContexts.get(fromUserId) || []

            // 添加用户消息
            context.push({role: 'user', content})

            // 调用 AI 对话
            const result = await chatWithLLM(
                context,
                this._scheduler,
                undefined,
                undefined,
                undefined
            )

            const reply = result.reply || '抱歉，我暂时无法处理你的消息。'

            // 更新上下文
            context.push({role: 'assistant', content: reply})
            if (context.length > WeChatBot.MAX_CONTEXT_LENGTH) {
                context = context.slice(-WeChatBot.MAX_CONTEXT_LENGTH)
            }
            this._chatContexts.set(fromUserId, context)

            // 保存到 chat-history 数据库，与应用对话数据存放在一起
            try {
                const sessionId = this.getOrCreateSession(fromUserId, nickname)
                chatHistoryDb.appendToSession(sessionId, [
                    {role: 'user', content},
                    {role: 'assistant', content: reply}
                ])
            } catch (e: any) {
                console.error('[WeChatBot] 保存聊天记录失败:', e.message)
            }

            // 发送回复
            await this.api.sendMessage(
                fromUserId,
                reply,
                msg.context_token,
                msg.session_id
            )

            console.log(`[WeChatBot] 回复: ${reply.substring(0, 100)}`)
        } catch (e: any) {
            console.error(`[WeChatBot] 处理消息失败:`, e.message)
            try {
                await this.api.sendMessage(
                    fromUserId,
                    '抱歉，处理消息时出错了，请稍后再试。',
                    msg.context_token,
                    msg.session_id
                )
            } catch {
                // 发送失败也忽略
            }
        }
    }

    /** 发送提醒消息给绑定的接收人 */
    async sendReminderMessage(content: string): Promise<void> {
        this.ensureInit()

        if (this._status !== 'connected') {
            throw new Error('微信机器人未连接，无法发送提醒')
        }

        const remindUserId = settingsDb.get('wechat_bot_remind_user_id') || ''
        if (!remindUserId) {
            throw new Error('微信机器人尚未收到消息，无法发送提醒。请先在微信中给机器人发一条消息')
        }

        await this.api.sendMessage(remindUserId, content)
    }

    // ======================== 自动恢复 ========================

    async autoReconnect(): Promise<void> {
        this.ensureInit()
        const token = settingsDb.get('wechat_bot_token') || ''

        if (!token) return

        console.log('[WeChatBot] 尝试自动恢复连接...')
        this._status = 'connecting'
        this.api.setToken(token)

        const baseUrl = settingsDb.get('wechat_bot_base_url') || ''
        if (baseUrl) this.api.setBaseUrl(baseUrl)

        try {
            await this.api.getUpdates('')
            this._status = 'connected'
            this._nickname = settingsDb.get('wechat_bot_nickname') || ''
            this.startPolling()
            console.log('[WeChatBot] 自动恢复连接成功')
        } catch (e: any) {
            if (e.message === 'SESSION_EXPIRED') {
                console.error('[WeChatBot] 会话已过期，需要重新登录')
                settingsDb.set('wechat_bot_token', '')
            } else {
                console.error('[WeChatBot] 自动恢复连接失败:', e.message)
            }
            this._status = 'disconnected'
        }
    }

    // ======================== 工具方法 ========================

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}

// 单例
export const weChatBot = new WeChatBot()
