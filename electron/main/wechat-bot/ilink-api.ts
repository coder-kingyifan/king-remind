import axios from 'axios'
import crypto from 'crypto'
import QRCode from 'qrcode'

const ILINK_BASE_URL = 'https://ilinkai.weixin.qq.com'
const CHANNEL_VERSION = '1.0.2'
const BOT_TYPE = '3'

function randomUin(): string {
    const uint32 = crypto.randomBytes(4).readUInt32BE(0)
    return Buffer.from(String(uint32), 'utf-8').toString('base64')
}

function buildHeaders(botToken?: string, body?: any): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'AuthorizationType': 'ilink_bot_token',
        'X-WECHAT-UIN': randomUin()
    }
    if (body !== undefined) {
        headers['Content-Length'] = String(Buffer.byteLength(JSON.stringify(body), 'utf-8'))
    }
    if (botToken) {
        headers['Authorization'] = `Bearer ${botToken}`
    }
    return headers
}

function buildBaseInfo(): { channel_version: string } {
    return {channel_version: CHANNEL_VERSION}
}

// ======================== 类型定义（基于官方 Tencent/openclaw-weixin） ========================

export interface QRCodeResult {
    qrcode: string
    url: string
    qrcode_key?: string
}

export interface QRCodeStatus {
    status: 'waiting' | 'scanned' | 'confirmed' | 'expired' | 'canceled'
    bot_token?: string
    baseurl?: string
    nickname?: string
    head_img_url?: string
}

// ---------- 消息相关类型 ----------

export interface TextItem {
    text?: string
}

export interface ImageItem {
    media: CDNMedia
    aeskey?: string
    url?: string
}

export interface VoiceItem {
    media: CDNMedia
    encode_type?: number
    text?: string       // 语音转文字
    playtime?: number
}

export interface FileItem {
    media: CDNMedia
    file_name?: string
    md5?: string
    len?: string
}

export interface VideoItem {
    media: CDNMedia
    video_size?: number
    play_length?: number
}

export interface CDNMedia {
    encrypt_query_param?: string
    aes_key?: string
    encrypt_type?: number
}

export interface RefMessage {
    title?: string
    message_item?: MessageItem
}

export interface MessageItem {
    type?: number           // 1=TEXT, 2=IMAGE, 3=VOICE, 4=FILE, 5=VIDEO
    create_time_ms?: number
    update_time_ms?: number
    is_completed?: boolean
    msg_id?: string
    ref_msg?: RefMessage
    text_item?: TextItem
    image_item?: ImageItem
    voice_item?: VoiceItem
    file_item?: FileItem
    video_item?: VideoItem
}

export interface WeixinMessage {
    seq?: number
    message_id?: number
    from_user_id?: string   // 发送者 ID，格式如 "o9cq800kum_4g8Py8Qw5G0a@im.wechat"
    to_user_id?: string     // 接收者 ID，格式如 "e06c1ceea05e@im.bot"
    client_id?: string
    create_time_ms?: number
    update_time_ms?: number
    delete_time_ms?: number
    session_id?: string
    group_id?: string
    message_type?: number   // 1=USER, 2=BOT
    message_state?: number  // 0=NEW, 1=GENERATING, 2=FINISH
    item_list?: MessageItem[]
    context_token?: string
}

export interface GetUpdatesResult {
    ret: number
    errcode?: number
    errmsg?: string
    msgs: WeixinMessage[]
    get_updates_buf: string
    longpolling_timeout_ms?: number
}

export interface SendMessageResult {
    ret: number
    errmsg?: string
}

export interface TypingResult {
    ret: number
    errmsg?: string
}

export interface GetConfigResult {
    ret: number
    errmsg?: string
    typing_ticket?: string
}

// ======================== API 客户端 ========================

export class ILinkAPI {
    private botToken: string = ''
    private baseUrl: string = ILINK_BASE_URL
    // 缓存每个用户的 typing_ticket
    private _typingTickets: Map<string, { ticket: string; expires: number }> = new Map()

    setToken(token: string): void {
        this.botToken = token
    }

    getToken(): string {
        return this.botToken
    }

    setBaseUrl(url: string): void {
        this.baseUrl = url || ILINK_BASE_URL
    }

    private buildUrl(endpoint: string): string {
        const base = this.baseUrl.replace(/\/$/, '')
        return `${base}/${endpoint}`
    }

    // ---------- 获取登录二维码 (GET, 无需鉴权) ----------
    async getQRCode(): Promise<QRCodeResult> {
        const url = this.buildUrl(`ilink/bot/get_bot_qrcode?bot_type=${BOT_TYPE}`)
        const res = await axios.get(url, {timeout: 15000})
        const data = res.data
        console.log('[ILinkAPI] getQRCode raw:', JSON.stringify(data).substring(0, 500))
        if (data.ret !== 0 && data.ret !== undefined) {
            throw new Error(data.errmsg || `获取二维码失败 (ret=${data.ret})`)
        }

        const qrKey = data.qrcode || ''
        const qrImgUrl = data.qrcode_img_content || ''
        let qrcodeDataUrl = ''

        if (qrImgUrl) {
            qrcodeDataUrl = await QRCode.toDataURL(qrImgUrl, {
                width: 256,
                margin: 2,
                color: {dark: '#000000', light: '#ffffff'}
            })
        }

        return {
            qrcode: qrcodeDataUrl,
            url: qrImgUrl,
            qrcode_key: qrKey
        }
    }

    // ---------- 轮询扫码状态 (GET, 无需鉴权) ----------
    async getQRCodeStatus(qrcodeKey: string): Promise<QRCodeStatus> {
        const url = this.buildUrl(`ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcodeKey)}`)
        const res = await axios.get(url, {timeout: 30000})
        const data = res.data
        console.log('[ILinkAPI] getQRCodeStatus raw:', JSON.stringify(data).substring(0, 500))

        const statusMap: Record<string, QRCodeStatus['status']> = {
            wait: 'waiting',
            scaned: 'scanned',
            confirm: 'confirmed',
            confirmed: 'confirmed',
            expired: 'expired',
            canceled: 'canceled'
        }
        const status = statusMap[data.status] || 'waiting'

        if (status === 'confirmed') {
            this.botToken = data.bot_token || ''
            if (data.baseurl) {
                this.baseUrl = data.baseurl
            }
            return {
                status: 'confirmed',
                bot_token: data.bot_token,
                baseurl: data.baseurl,
                nickname: data.nickname || data.nick_name,
                head_img_url: data.head_img_url
            }
        }

        return {status}
    }

    // ---------- 长轮询获取消息 (POST) ----------
    async getUpdates(cursor: string = ''): Promise<GetUpdatesResult> {
        if (!this.botToken) {
            throw new Error('未登录，请先扫码获取 bot_token')
        }

        const body = {
            get_updates_buf: cursor,
            base_info: buildBaseInfo()
        }

        try {
            const res = await axios.post(
                this.buildUrl('ilink/bot/getupdates'),
                body,
                {headers: buildHeaders(this.botToken, body), timeout: 38000}
            )
            const data = res.data
            // 只在首次或有消息时打印完整响应，避免刷屏
            if (data.msgs && data.msgs.length > 0) {
                console.log('[ILinkAPI] getUpdates got messages! raw:', JSON.stringify(data).substring(0, 1000))
            }

            if (data.ret !== 0 && data.ret !== undefined) {
                console.error('[ILinkAPI] getUpdates error:', data.ret, data.errmsg, data.errcode)
                // -14 表示会话过期，需要重新登录
                if (data.ret === -14 || data.errcode === -14) {
                    throw new Error('SESSION_EXPIRED')
                }
            }

            // 如果有消息，打印详细信息以便调试
            if (data.msgs && data.msgs.length > 0) {
                for (const msg of data.msgs) {
                    console.log('[ILinkAPI] msg:', JSON.stringify({
                        from_user_id: msg.from_user_id,
                        to_user_id: msg.to_user_id,
                        message_type: msg.message_type,
                        message_state: msg.message_state,
                        session_id: msg.session_id,
                        context_token: msg.context_token?.substring(0, 30),
                        item_count: msg.item_list?.length || 0
                    }))
                }
            }

            return {
                ret: data.ret ?? 0,
                errcode: data.errcode,
                errmsg: data.errmsg,
                msgs: data.msgs || [],
                get_updates_buf: data.get_updates_buf || cursor,
                longpolling_timeout_ms: data.longpolling_timeout_ms
            }
        } catch (e: any) {
            if (e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
                // 长轮询超时是正常的，返回空结果
                return {
                    ret: 0,
                    msgs: [],
                    get_updates_buf: cursor
                }
            }
            throw e
        }
    }

    // ---------- 获取配置（含 typing_ticket） (POST) ----------
    async getConfig(ilinkUserId: string, contextToken?: string): Promise<GetConfigResult> {
        if (!this.botToken) {
            throw new Error('未登录')
        }

        const body: any = {
            ilink_user_id: ilinkUserId,
            context_token: contextToken || '',
            base_info: buildBaseInfo()
        }

        try {
            const res = await axios.post(
                this.buildUrl('ilink/bot/getconfig'),
                body,
                {headers: buildHeaders(this.botToken, body), timeout: 10000}
            )
            const data = res.data
            console.log('[ILinkAPI] getConfig ret:', data.ret, 'has_ticket:', !!data.typing_ticket)
            return {
                ret: data.ret ?? 0,
                errmsg: data.errmsg,
                typing_ticket: data.typing_ticket
            }
        } catch (e: any) {
            console.error('[ILinkAPI] getConfig error:', e.message)
            return {ret: -1}
        }
    }

    // ---------- 发送文本消息 (POST) ----------
    async sendMessage(
        toUserId: string,
        content: string,
        contextToken?: string,
        sessionId?: string
    ): Promise<SendMessageResult> {
        if (!this.botToken) {
            throw new Error('未登录，请先扫码获取 bot_token')
        }

        const clientId = `remind-${crypto.randomUUID()}`
        const body = {
            msg: {
                from_user_id: '',
                to_user_id: toUserId,
                client_id: clientId,
                message_type: 2,   // BOT
                message_state: 2,  // FINISH
                context_token: contextToken || '',
                item_list: [
                    {
                        type: 1,  // TEXT
                        text_item: {text: content}
                    }
                ]
            },
            base_info: buildBaseInfo()
        }

        console.log('[ILinkAPI] sendMessage to:', toUserId, 'content:', content.substring(0, 50))

        const res = await axios.post(
            this.buildUrl('ilink/bot/sendmessage'),
            body,
            {headers: buildHeaders(this.botToken, body), timeout: 15000}
        )
        const data = res.data
        const ret = data.ret ?? data.errcode ?? 0
        const errmsg = data.errmsg || ''
        if (ret !== 0) {
            console.error('[ILinkAPI] sendMessage error:', ret, errmsg)
        }
        return {
            ret,
            errmsg
        }
    }

    // ---------- 发送正在输入状态 (POST) ----------
    async sendTyping(ilinkUserId: string, contextToken?: string): Promise<TypingResult> {
        if (!this.botToken) {
            throw new Error('未登录')
        }

        // 尝试获取缓存的 typing_ticket
        let ticket = this.getCachedTypingTicket(ilinkUserId)
        if (!ticket) {
            const configResult = await this.getConfig(ilinkUserId, contextToken)
            if (configResult.typing_ticket) {
                ticket = configResult.typing_ticket
                this.cacheTypingTicket(ilinkUserId, ticket)
            } else {
                // 无法获取 ticket，跳过 typing
                console.log('[ILinkAPI] sendTyping: no typing_ticket available, skipping')
                return {ret: 0}
            }
        }

        const body = {
            ilink_user_id: ilinkUserId,
            typing_ticket: ticket,
            status: 1,  // 1=正在输入, 2=取消
            base_info: buildBaseInfo()
        }

        try {
            const res = await axios.post(
                this.buildUrl('ilink/bot/sendtyping'),
                body,
                {headers: buildHeaders(this.botToken, body), timeout: 10000}
            )
            const data = res.data
            return {ret: data.ret ?? 0, errmsg: data.errmsg}
        } catch (e: any) {
            console.error('[ILinkAPI] sendTyping error:', e.message)
            // typing 状态发送失败不影响主流程
            return {ret: 0}
        }
    }

    // ---------- typing_ticket 缓存管理 ----------

    private getCachedTypingTicket(userId: string): string | null {
        const cached = this._typingTickets.get(userId)
        if (cached && cached.expires > Date.now()) {
            return cached.ticket
        }
        this._typingTickets.delete(userId)
        return null
    }

    private cacheTypingTicket(userId: string, ticket: string): void {
        // ticket 有效期约24小时，保守设为12小时
        this._typingTickets.set(userId, {
            ticket,
            expires: Date.now() + 12 * 60 * 60 * 1000
        })
    }
}
