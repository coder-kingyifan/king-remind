import {createServer, IncomingMessage, Server, ServerResponse} from 'http'
import {remindersDb} from './db/reminders'
import {settingsDb} from './db/settings'
import {ReminderScheduler} from './scheduler'

let server: Server | null = null

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

export function startApiServer(scheduler: ReminderScheduler): void {
    const port = parseInt(settingsDb.get('api_port') || '33333')
    const token = settingsDb.get('api_token') || ''

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

            err(res, 404, '接口不存在')
        } catch (e: any) {
            err(res, 500, e.message || '服务器内部错误')
        }
    })

    const host = process.env['API_HOST'] || '127.0.0.1'
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
