import {net, session} from 'electron'
import {settingsDb} from './db/settings'

export type NetworkProxyMode = 'system' | 'direct' | 'custom'

export interface NetworkProxyConfig {
    mode: NetworkProxyMode
    proxyUrl: string
}

interface NetworkProbe {
    name: string
    url: string
    validate?: (body: string) => boolean
}

const PROXY_MODE_KEY = 'network_proxy_mode'
const PROXY_URL_KEY = 'network_proxy_url'
const DEFAULT_PROXY_URL = 'http://127.0.0.1:7890'
const GITHUB_HOME_URL = 'https://github.com/coder-kingyifan/king-mate'
const GITHUB_RELEASES_URL = 'https://github.com/coder-kingyifan/king-mate/releases'
const STORE_MANIFEST_URL = 'https://raw.githubusercontent.com/coder-kingyifan/king-remind-skill-store/main/skill-store.json'

function normalizeMode(mode?: string): NetworkProxyMode {
    if (mode === 'direct' || mode === 'custom') return mode
    return 'system'
}

export function getNetworkProxyConfig(): NetworkProxyConfig {
    return {
        mode: normalizeMode(settingsDb.get(PROXY_MODE_KEY)),
        proxyUrl: settingsDb.get(PROXY_URL_KEY) || DEFAULT_PROXY_URL
    }
}

function parseProxyUrl(raw: string): URL {
    const value = raw.trim()
    if (!value) throw new Error('请填写代理地址，例如 http://127.0.0.1:7890')

    let url: URL
    try {
        url = new URL(value.includes('://') ? value : `http://${value}`)
    } catch {
        throw new Error('代理地址格式不正确，请填写类似 http://127.0.0.1:7890 的地址')
    }

    if (!url.hostname) throw new Error('代理地址缺少主机，请填写类似 http://127.0.0.1:7890 的地址')
    if (!url.port) throw new Error('代理地址缺少端口，请填写类似 http://127.0.0.1:7890 的完整地址')

    const port = Number(url.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('代理端口无效，请填写 1-65535 之间的端口号')
    }

    const allowed = ['http:', 'https:', 'socks4:', 'socks5:']
    if (!allowed.includes(url.protocol)) {
        throw new Error('仅支持 http、https、socks4、socks5 代理')
    }

    return url
}

function proxyRulesFromUrl(raw: string): string {
    const url = parseProxyUrl(raw)
    const host = url.hostname.includes(':') ? `[${url.hostname}]` : url.hostname
    const port = url.port || (url.protocol === 'https:' ? '443' : '1080')
    const server = `${host}:${port}`

    if (url.protocol === 'socks4:' || url.protocol === 'socks5:') {
        return `${url.protocol}//${server}`
    }

    return `http=${server};https=${server}`
}

function proxyEnvFromUrl(raw: string): string {
    const url = parseProxyUrl(raw)
    return url.toString()
}

function friendlyNetworkError(error: any, config: NetworkProxyConfig): string {
    const raw = String(error?.message || error || '')

    if (error?.name === 'AbortError' || raw.includes('ERR_TIMED_OUT') || raw.includes('ETIMEDOUT')) {
        return '连接超时。请确认网络正常，代理软件已启动，并且代理规则允许访问 GitHub。'
    }

    if (raw.includes('ERR_PROXY_CONNECTION_FAILED') || raw.includes('ECONNREFUSED')) {
        if (config.mode === 'custom') {
            return `代理连接失败。请确认代理软件正在运行，并检查代理地址 ${config.proxyUrl || DEFAULT_PROXY_URL} 是否正确；常见 Clash 端口是 7890。`
        }
        return '系统代理连接失败。请确认系统代理软件正在运行，或改用手动代理配置。'
    }

    if (raw.includes('ERR_TUNNEL_CONNECTION_FAILED')) {
        return '代理隧道连接失败。请检查代理协议是否选对，HTTP 代理通常填写 http://127.0.0.1:7890。'
    }

    if (raw.includes('ERR_NAME_NOT_RESOLVED') || raw.includes('ENOTFOUND')) {
        return '域名解析失败。请检查网络 DNS，或确认代理已正确接管 GitHub 访问。'
    }

    if (raw.includes('ERR_CONNECTION_RESET') || raw.includes('ECONNRESET')) {
        return '连接被中断。请检查当前网络或代理规则，稍后再试。'
    }

    if (raw.includes('ERR_INTERNET_DISCONNECTED')) {
        return '当前网络不可用。请先检查电脑网络连接。'
    }

    if (raw.includes('ERR_CERT') || raw.includes('certificate')) {
        return 'HTTPS 证书校验失败。请检查代理软件的 HTTPS 设置或证书配置。'
    }

    if (raw.includes('net::ERR_')) {
        return '网络请求失败。请检查代理地址、端口和代理软件状态后再试。'
    }

    return raw || '网络请求失败，请检查网络连接或代理设置。'
}

function probeUrl(probe: NetworkProbe): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const separator = probe.url.includes('?') ? '&' : '?'
        const request = net.request({
            method: 'GET',
            url: `${probe.url}${separator}_proxy_test=${Date.now()}_${Math.random().toString(16).slice(2)}`
        })

        request.setHeader('Accept', probe.name === '技能商店清单' ? 'application/json' : 'text/html,application/xhtml+xml')
        request.setHeader('Cache-Control', 'no-cache, no-store, max-age=0')
        request.setHeader('Pragma', 'no-cache')
        request.setHeader('User-Agent', 'King-Mate proxy check')

        let settled = false
        let timer: ReturnType<typeof setTimeout>
        const finish = (fn: () => void) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            fn()
        }

        timer = setTimeout(() => {
            request.abort()
            finish(() => reject(new Error(`${probe.name} 连接超时`)))
        }, 12000)

        let body = ''
        request.on('response', (response) => {
            response.on('data', (chunk) => {
                body += chunk.toString()
                if (body.length > 1024 * 1024) {
                    request.abort()
                    finish(() => reject(new Error(`${probe.name} 响应内容异常`)))
                }
            })

            response.on('end', () => {
                finish(() => {
                    if (response.statusCode < 200 || response.statusCode >= 400) {
                        reject(new Error(`${probe.name} 返回状态码 ${response.statusCode}`))
                        return
                    }
                    if (probe.validate && !probe.validate(body)) {
                        reject(new Error(`${probe.name} 返回内容不符合预期`))
                        return
                    }
                    resolve()
                })
            })
        })

        request.on('error', (err) => {
            finish(() => reject(new Error(`${probe.name} 请求失败：${err.message}`)))
        })

        request.end()
    })
}

function isStoreManifest(body: string): boolean {
    try {
        const parsed = JSON.parse(body)
        return !!parsed && typeof parsed === 'object' && Array.isArray(parsed.skills)
    } catch {
        return false
    }
}

function applyProxyEnv(proxyUrl?: string): void {
    if (proxyUrl) {
        process.env.HTTP_PROXY = proxyUrl
        process.env.HTTPS_PROXY = proxyUrl
        process.env.ALL_PROXY = proxyUrl
    } else {
        delete process.env.HTTP_PROXY
        delete process.env.HTTPS_PROXY
        delete process.env.ALL_PROXY
    }
}

export async function applyNetworkProxy(config: NetworkProxyConfig = getNetworkProxyConfig()): Promise<void> {
    const mode = normalizeMode(config.mode)

    if (mode === 'direct') {
        await session.defaultSession.setProxy({mode: 'direct'})
        applyProxyEnv()
    } else if (mode === 'custom') {
        const proxyRules = proxyRulesFromUrl(config.proxyUrl)
        await session.defaultSession.setProxy({
            mode: 'fixed_servers',
            proxyRules,
            proxyBypassRules: '<local>'
        })
        applyProxyEnv(proxyEnvFromUrl(config.proxyUrl))
    } else {
        await session.defaultSession.setProxy({mode: 'system'})
        applyProxyEnv()
    }

    await session.defaultSession.closeAllConnections()
}

export async function saveNetworkProxyConfig(config: NetworkProxyConfig): Promise<void> {
    const mode = normalizeMode(config.mode)
    const proxyUrl = config.proxyUrl.trim()

    if (mode === 'custom') {
        parseProxyUrl(proxyUrl)
    }

    settingsDb.set(PROXY_MODE_KEY, mode)
    settingsDb.set(PROXY_URL_KEY, proxyUrl)
    await applyNetworkProxy({mode, proxyUrl})
}

export async function testNetworkProxy(): Promise<{ success: boolean; error?: string }> {
    const config = getNetworkProxyConfig()
    const probes: NetworkProbe[] = [
        {name: 'GitHub 主站', url: GITHUB_HOME_URL, validate: (body) => body.includes('github') || body.includes('GitHub')},
        {name: 'GitHub Releases', url: GITHUB_RELEASES_URL, validate: (body) => body.includes('/releases') || body.includes('Releases')},
        {name: '技能商店清单', url: STORE_MANIFEST_URL, validate: isStoreManifest}
    ]

    try {
        for (const probe of probes) {
            await probeUrl(probe)
        }
        return {success: true}
    } catch (e: any) {
        return {success: false, error: friendlyNetworkError(e, config)}
    }
}
