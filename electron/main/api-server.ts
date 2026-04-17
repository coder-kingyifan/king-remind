import {createServer, IncomingMessage, Server, ServerResponse} from 'http'
import {remindersDb} from './db/reminders'
import {settingsDb} from './db/settings'
import {ReminderScheduler} from './scheduler'
import {chatWithLLM} from './llm'
import type {StreamEvent} from './llm'
import {modelConfigsDb} from './db/model-configs'
import {notificationConfigsDb} from './db/notification-configs'
import {weChatBot} from './wechat-bot/wechat-bot'
import {NotificationDispatcher} from './notifications/dispatcher'

let server: Server | null = null
let dispatcherRef: NotificationDispatcher | null = null

function readBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
        let data = ''
        req.on('data', chunk => {
            data += chunk
        })
        req.on('end', () => {
            try {
                resolve(data ? JSON.parse(data) : {})
            } catch {
                reject(new Error('Invalid JSON body'))
            }
        })
        req.on('error', reject)
    })
}

function send(res: ServerResponse, status: number, body: any) {
    const json = JSON.stringify(body)
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(json)
    })
    res.end(json)
}

function ok(res: ServerResponse, data: any) {
    send(res, 200, {success: true, data})
}

function err(res: ServerResponse, status: number, message: string) {
    send(res, status, {success: false, error: message})
}

function checkAuth(req: IncomingMessage, res: ServerResponse, token: string): boolean {
    if (!token) return true
    const auth = req.headers['authorization'] || ''
    const provided = auth.startsWith('Bearer ') ? auth.slice(7) : auth
    if (provided !== token) {
        err(res, 401, '无效的 API Token')
        return false
    }
    return true
}

export function startApiServer(scheduler: ReminderScheduler, dispatcher?: NotificationDispatcher): void {
    const port = parseInt(settingsDb.get('api_port') || '33333')
    const token = settingsDb.get('api_token') || ''
    if (dispatcher) dispatcherRef = dispatcher

    server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        // CORS
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return
        }

        if (!checkAuth(req, res, token)) return

        const url = new URL(req.url || '/', `http://localhost:${port}`)
        const path = url.pathname
        const method = req.method || 'GET'

        try {
            // POST /api/reminders - 创建提醒
            if (method === 'POST' && path === '/api/reminders') {
                const body = await readBody(req)
                if (!body.title) return err(res, 400, '缺少必填字段: title')
                if (!body.remind_type) return err(res, 400, '缺少必填字段: remind_type')
                if (!body.start_time) return err(res, 400, '缺少必填字段: start_time')

                const input = {
                    title: String(body.title),
                    description: body.description ? String(body.description) : undefined,
                    icon: body.icon ? String(body.icon) : undefined,
                    color: body.color ? String(body.color) : undefined,
                    remind_type: body.remind_type as 'interval' | 'scheduled',
                    interval_value: body.interval_value ? Number(body.interval_value) : undefined,
                    interval_unit: body.interval_unit,
                    weekdays: body.weekdays || null,
                    workday_only: body.workday_only ? 1 : 0,
                    holiday_only: body.holiday_only ? 1 : 0,
                    lunar_date: body.lunar_date || null,
                    start_time: String(body.start_time),
                    end_time: body.end_time || null,
                    active_hours_start: body.active_hours_start || null,
                    active_hours_end: body.active_hours_end || null,
                    channels: Array.isArray(body.channels) ? body.channels : ['desktop']
                }

                const reminder = remindersDb.create(input)
                scheduler.triggerNow()
                return ok(res, reminder)
            }

            // GET /api/reminders - 列出提醒
            if (method === 'GET' && path === '/api/reminders') {
                const isActive = url.searchParams.get('is_active')
                const search = url.searchParams.get('search') || undefined
                const filters: any = {}
                if (isActive !== null) filters.is_active = parseInt(isActive)
                if (search) filters.search = search
                return ok(res, remindersDb.list(filters))
            }

            // GET /api/reminders/:id
            const matchGet = path.match(/^\/api\/reminders\/(\d+)$/)
            if (method === 'GET' && matchGet) {
                const reminder = remindersDb.get(parseInt(matchGet[1]))
                if (!reminder) return err(res, 404, '提醒不存在')
                return ok(res, reminder)
            }

            // DELETE /api/reminders/:id
            const matchDel = path.match(/^\/api\/reminders\/(\d+)$/)
            if (method === 'DELETE' && matchDel) {
                const deleted = remindersDb.delete(parseInt(matchDel[1]))
                if (!deleted) return err(res, 404, '提醒不存在')
                return ok(res, {deleted: true})
            }

            // GET /api/ping
            if (method === 'GET' && path === '/api/ping') {
                return ok(res, {message: 'pong', version: '1.0.0'})
            }

            // POST /api/chat - AI 对话接口
            if (method === 'POST' && path === '/api/chat') {
                const body = await readBody(req)
                if (!body.message) return err(res, 400, '缺少必填字段: message')

                // 构建消息列表
                const history: Array<{ role: string; content: string }> = Array.isArray(body.history) ? body.history : []
                const messages = [
                    ...history,
                    { role: 'user', content: String(body.message) }
                ]

                const configId = body.model_config_id ? Number(body.model_config_id) : undefined

                // 收集工具调用信息
                const toolCalls: Array<{ name: string; args: Record<string, any>; result: any }> = []
                const toolArgsMap = new Map<string, Record<string, any>>()

                try {
                    const result = await chatWithLLM(messages, scheduler, configId, undefined, (event: StreamEvent) => {
                        if (event.type === 'tool_start') {
                            toolArgsMap.set(event.name, event.args)
                        }
                        if (event.type === 'tool_result') {
                            toolCalls.push({
                                name: event.name,
                                args: toolArgsMap.get(event.name) || {},
                                result: event.result
                            })
                        }
                    })

                    return ok(res, {
                        reply: result.reply,
                        tool_calls: toolCalls.length > 0 ? toolCalls : undefined
                    })
                } catch (e: any) {
                    return err(res, 500, `AI 对话失败: ${e.message || '未知错误'}`)
                }
            }

            // GET /api/models - 获取模型配置列表
            if (method === 'GET' && path === '/api/models') {
                const models = modelConfigsDb.list()
                return ok(res, models.map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    provider: m.provider,
                    model: m.model,
                    is_default: m.is_default
                })))
            }

            // ========== 通知渠道配置 API ==========
            // GET /api/notifications/configs - 获取所有通知渠道配置
            if (method === 'GET' && path === '/api/notifications/configs') {
                return ok(res, notificationConfigsDb.getAll())
            }

            // PUT /api/notifications/configs/:channel - 更新通知渠道配置
            const matchNotifChannel = path.match(/^\/api\/notifications\/configs\/([a-z_]+)$/)
            if (method === 'PUT' && matchNotifChannel) {
                const channel = matchNotifChannel[1]
                const body = await readBody(req)
                const data: { is_enabled?: number; config_json?: string } = {}
                if (body.is_enabled !== undefined) data.is_enabled = body.is_enabled ? 1 : 0
                if (body.config_json !== undefined) data.config_json = typeof body.config_json === 'string' ? body.config_json : JSON.stringify(body.config_json)
                const result = notificationConfigsDb.update(channel, data)
                if (!result) return err(res, 404, `通知渠道 ${channel} 不存在`)
                return ok(res, result)
            }

            // POST /api/notifications/test/:channel - 测试通知渠道
            const matchTestChannel = path.match(/^\/api\/notifications\/test\/([a-z_]+)$/)
            if (method === 'POST' && matchTestChannel) {
                const channel = matchTestChannel[1]
                if (!dispatcherRef) return err(res, 500, '通知分发器未初始化')
                const result = await dispatcherRef.testChannel(channel)
                return ok(res, result)
            }

            // ========== 系统设置 API ==========
            // GET /api/settings - 获取所有设置
            if (method === 'GET' && path === '/api/settings') {
                return ok(res, settingsDb.getAll())
            }

            // PUT /api/settings - 更新设置
            if (method === 'PUT' && path === '/api/settings') {
                const body = await readBody(req)
                if (!body || typeof body !== 'object') return err(res, 400, '请求体必须是 JSON 对象')
                for (const [key, value] of Object.entries(body)) {
                    if (typeof value === 'string') {
                        settingsDb.set(key, value)
                    } else {
                        settingsDb.set(key, JSON.stringify(value))
                    }
                }
                return ok(res, settingsDb.getAll())
            }

            // ========== 微信机器人 API ==========
            // GET /api/wechat-bot/qrcode - 获取登录二维码
            if (method === 'GET' && path === '/api/wechat-bot/qrcode') {
                try {
                    const result = await weChatBot.getQRCode()
                    return ok(res, result)
                } catch (e: any) {
                    return err(res, 500, `获取二维码失败: ${e.message}`)
                }
            }

            // GET /api/wechat-bot/status - 获取机器人状态
            if (method === 'GET' && path === '/api/wechat-bot/status') {
                return ok(res, weChatBot.getState())
            }

            // POST /api/wechat-bot/login - 登录
            if (method === 'POST' && path === '/api/wechat-bot/login') {
                try {
                    await weChatBot.login()
                    return ok(res, weChatBot.getState())
                } catch (e: any) {
                    return err(res, 400, e.message)
                }
            }

            // POST /api/wechat-bot/logout - 登出
            if (method === 'POST' && path === '/api/wechat-bot/logout') {
                await weChatBot.logout()
                return ok(res, weChatBot.getState())
            }

            // POST /api/wechat-bot/toggle - 启用/禁用
            if (method === 'POST' && path === '/api/wechat-bot/toggle') {
                const body = await readBody(req)
                weChatBot.toggle(!!body.enabled)
                return ok(res, weChatBot.getState())
            }

            err(res, 404, '接口不存在')
        } catch (e: any) {
            err(res, 500, e.message || '服务器内部错误')
        }
    })

    const host = settingsDb.get('api_host') || '0.0.0.0'
    server.listen(port, host, () => {
        console.log(`[API Server] 监听 http://${host}:${port}`)
    })

    server.on('error', (e: any) => {
        console.error('[API Server] 启动失败:', e.message)
    })
}

export function stopApiServer(): void {
    server?.close()
    server = null
}
