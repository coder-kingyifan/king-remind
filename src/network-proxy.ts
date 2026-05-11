/**
 * 渲染进程网络代理
 * 将主进程通过 IPC 转发的 axios 请求信息，映射到 DevTools Network 面板可见的请求记录
 *
 * 原理：主进程的 axios 请求不会出现在渲染进程的 DevTools 中。
 * 我们通过 IPC 收到主进程的请求/响应事件后，用 fetch API 在渲染进程发起一个
 * 到原始 URL 的请求并立即 abort，让 DevTools 记录下请求信息。
 * 同时在 console 中输出完整的请求/响应日志，方便调试。
 */

interface NetworkEvent {
    id: string
    method: string
    url: string
    status?: number
    statusText?: string
    requestHeaders?: Record<string, string>
    requestBody?: any
    responseHeaders?: Record<string, string>
    responseBody?: any
    duration?: number
    startTime: number
    error?: string
}

const pendingEvents = new Map<string, NetworkEvent>()

/** 最近完成的网络事件记录（最多保留 200 条） */
const recentEvents: NetworkEvent[] = []
const MAX_RECENT_EVENTS = 200

export function initNetworkProxy(): void {
    if (!window.electronAPI?.network) return

    window.electronAPI.network.onEvent((event: NetworkEvent) => {
        if (!event.status && !event.error) {
            // 请求开始
            pendingEvents.set(event.id, event)
            emitFetch(event)
        } else {
            // 响应到达
            const pending = pendingEvents.get(event.id)
            if (pending) {
                const merged: NetworkEvent = {...pending, ...event}
                logToConsole(pending, event)
                // 保存到历史记录
                recentEvents.push(merged)
                if (recentEvents.length > MAX_RECENT_EVENTS) {
                    recentEvents.shift()
                }
                pendingEvents.delete(event.id)
            }
        }
    })
}

/**
 * 获取最近的网络事件记录
 */
export function getRecentNetworkEvents(): NetworkEvent[] {
    return [...recentEvents]
}

/**
 * 用 fetch 发起请求让 DevTools Network 面板记录，然后立即 abort
 * fetch + AbortController 在 Chromium DevTools 中会显示为 "canceled" 状态的请求条目，
 * 能看到 URL、Method、Headers 等信息，比 XHR 更可靠
 */
function emitFetch(event: NetworkEvent): void {
    try {
        const controller = new AbortController()
        const headers: Record<string, string> = {
            'X-Network-Proxy': 'main-process'
        }

        // 设置原始请求的 headers（非敏感信息）
        if (event.requestHeaders) {
            for (const [key, value] of Object.entries(event.requestHeaders)) {
                const lower = key.toLowerCase()
                // 跳过浏览器禁止设置的 header 和敏感 header
                if (isForbiddenHeader(lower)) continue
                headers[key] = value
            }
        }

        // 使用 no-cors 模式避免 CORS 预检请求导致的延迟和失败
        fetch(event.url, {
            method: event.method,
            headers,
            signal: controller.signal,
            mode: 'no-cors'
        }).catch(() => {
            // 预期会被 abort，忽略错误
        })

        // 立即取消，让 DevTools 记录但不实际请求
        controller.abort()
    } catch {
        // URL 格式不合法等情况，忽略
    }
}

/**
 * 判断是否为浏览器禁止设置的 header
 * https://fetch.spec.whatwg.org/#forbidden-header-name
 */
function isForbiddenHeader(lower: string): boolean {
    const forbidden = [
        'accept-charset', 'accept-encoding', 'access-control-request-headers',
        'access-control-request-method', 'connection', 'content-length',
        'cookie', 'cookie2', 'date', 'dnt', 'expect', 'host', 'keep-alive',
        'origin', 'referer', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'via'
    ]
    if (forbidden.includes(lower)) return true
    if (lower.startsWith('proxy-') || lower.startsWith('sec-')) return true
    return false
}

/**
 * 在 console 中输出完整的请求/响应日志
 */
function logToConsole(request: NetworkEvent, response: NetworkEvent): void {
    const method = request.method
    const url = request.url
    const status = response.status
    const duration = response.duration
    const error = response.error

    const style = error
        ? 'color: #F56C6C; font-weight: bold'
        : (status && status >= 400)
            ? 'color: #E6A23C; font-weight: bold'
            : 'color: #67C23A; font-weight: bold'

    const statusText = error
        ? `ERROR: ${error}`
        : `${status} ${response.statusText || ''}`

    // 简短 URL 显示（只保留路径部分）
    let shortUrl = url
    try {
        const u = new URL(url)
        shortUrl = u.pathname + u.search
    } catch { /* keep original */
    }

    console.groupCollapsed(
        `%c${method} %c${shortUrl} %c${statusText} %c${duration}ms`,
        'color: #409EFF; font-weight: bold',
        'color: #303133',
        style,
        'color: #909399'
    )

    // 请求信息
    console.group('Request')
    console.log('Method:', method)
    console.log('URL:', url)
    if (request.requestHeaders && Object.keys(request.requestHeaders).length > 0) {
        console.log('Headers:', sanitizeHeaders(request.requestHeaders))
    }
    if (request.requestBody) {
        console.log('Body:', truncate(request.requestBody))
    }
    console.groupEnd()

    // 响应信息
    console.group('Response')
    if (status) console.log('Status:', status, response.statusText)
    if (response.responseHeaders && Object.keys(response.responseHeaders).length > 0) {
        console.log('Headers:', sanitizeHeaders(response.responseHeaders))
    }
    if (response.responseBody) {
        console.log('Body:', truncate(response.responseBody))
    }
    if (error) {
        console.log('Error:', error)
    }
    console.groupEnd()

    console.groupEnd()
}

/** 脱敏：隐藏 API Key 等敏感 header 值 */
function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(headers)) {
        const lower = key.toLowerCase()
        if (lower.includes('key') || lower.includes('token') || lower.includes('auth') || lower.includes('secret')) {
            result[key] = value.length > 8
                ? value.substring(0, 4) + '****' + value.substring(value.length - 4)
                : '****'
        } else {
            result[key] = value
        }
    }
    return result
}

function truncate(data: any, maxLen = 2000): any {
    if (!data) return data
    if (typeof data === 'string') {
        return data.length > maxLen ? data.substring(0, maxLen) + '...[truncated]' : data
    }
    try {
        const str = JSON.stringify(data)
        if (str.length > maxLen) {
            return str.substring(0, maxLen) + '...[truncated]'
        }
    } catch { /* ignore */
    }
    return data
}
