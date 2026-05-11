import {net, session} from 'electron'
import {settingsDb} from './db/settings'

export type NetworkProxyMode = 'system' | 'direct' | 'custom'

export interface NetworkProxyConfig {
    mode: NetworkProxyMode
    proxyUrl: string
}

const PROXY_MODE_KEY = 'network_proxy_mode'
const PROXY_URL_KEY = 'network_proxy_url'
const DEFAULT_PROXY_URL = 'http://127.0.0.1:7890'

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
    if (!value) throw new Error('请填写代理地址')

    const url = new URL(value.includes('://') ? value : `http://${value}`)
    if (!url.hostname) throw new Error('代理地址格式无效')

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
    if (!url.port) {
        url.port = url.protocol === 'https:' ? '443' : '1080'
    }
    return url.toString()
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
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)

    try {
        const response = await net.fetch('https://raw.githubusercontent.com/coder-kingyifan/king-remind-skill-store/main/skill-store.json', {
            signal: controller.signal,
            headers: {'Accept': 'application/json'}
        })
        if (!response.ok) {
            return {success: false, error: `GitHub 返回状态码 ${response.status}`}
        }
        return {success: true}
    } catch (e: any) {
        const message = e.name === 'AbortError' ? '连接超时' : (e.message || '网络请求失败')
        return {success: false, error: message}
    } finally {
        clearTimeout(timer)
    }
}
