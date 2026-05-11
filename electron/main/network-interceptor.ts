import axios from 'axios'
import {BrowserWindow} from 'electron'

/**
 * 主进程网络请求拦截器
 * 将 axios 请求/响应信息转发到渲染进程，使 DevTools Network 面板可见
 */

let mainWindow: BrowserWindow | null = null

export interface NetworkEvent {
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

const pendingRequests = new Map<string, { startTime: number; event: NetworkEvent }>()

function sendToRenderer(event: NetworkEvent): void {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('network:event', event)
    }
}

/** 将 axios headers 对象转为纯 Record<string, string> */
function extractHeaders(headers: any): Record<string, string> {
    if (!headers || typeof headers !== 'object') return {}
    // axios AxiosHeaders 类支持 toJSON()
    if (typeof headers.toJSON === 'function') {
        try {
            const obj = headers.toJSON()
            return Object.fromEntries(
                Object.entries(obj).filter(([, v]) => typeof v === 'string')
            )
        } catch { /* fallback */
        }
    }
    return Object.fromEntries(
        Object.entries(headers).filter(([, v]) => typeof v === 'string')
    )
}

export function initNetworkInterceptor(win: BrowserWindow): void {
    mainWindow = win

    // 请求拦截器
    axios.interceptors.request.use(
        (config) => {
            const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
            ;(config as any).__networkId = id

            const event: NetworkEvent = {
                id,
                method: (config.method || 'GET').toUpperCase(),
                url: config.url || '',
                requestHeaders: extractHeaders(config.headers),
                requestBody: truncateBody(config.data),
                startTime: Date.now()
            }

            pendingRequests.set(id, {startTime: Date.now(), event})
            sendToRenderer(event)
            return config
        },
        (error) => {
            return Promise.reject(error)
        }
    )

    // 响应拦截器
    axios.interceptors.response.use(
        (response) => {
            const id = (response.config as any).__networkId
            if (id) {
                const pending = pendingRequests.get(id)
                if (pending) {
                    const event: NetworkEvent = {
                        ...pending.event,
                        status: response.status,
                        statusText: response.statusText,
                        responseHeaders: extractHeaders(response.headers),
                        responseBody: truncateBody(response.data),
                        duration: Date.now() - pending.startTime
                    }
                    sendToRenderer(event)
                    pendingRequests.delete(id)
                }
            }
            return response
        },
        (error) => {
            const id = error?.config?.__networkId
            if (id) {
                const pending = pendingRequests.get(id)
                if (pending) {
                    const event: NetworkEvent = {
                        ...pending.event,
                        status: error.response?.status,
                        statusText: error.response?.statusText,
                        responseHeaders: extractHeaders(error.response?.headers),
                        responseBody: truncateBody(error.response?.data),
                        duration: Date.now() - pending.startTime,
                        error: error.message
                    }
                    sendToRenderer(event)
                    pendingRequests.delete(id)
                }
            }
            return Promise.reject(error)
        }
    )
}

function truncateBody(data: any, maxLen = 5000): any {
    if (!data) return data
    if (typeof data === 'string') {
        return data.length > maxLen ? data.substring(0, maxLen) + '...[truncated]' : data
    }
    try {
        const str = JSON.stringify(data)
        if (str.length > maxLen) {
            return str.substring(0, maxLen) + '...[truncated]'
        }
        return JSON.parse(str)  // 确保返回纯可序列化对象
    } catch {
        return '[non-serializable]'  // 无法序列化的数据用占位符替代
    }
}
