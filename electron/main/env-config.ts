/**
 * 环境变量配置加载模块
 *
 * 在 Docker 部署时，通过 KING_* 环境变量预配置通知渠道和系统设置。
 * 只在环境变量存在时更新数据库，不覆盖已有配置（除非 KING_CONFIG_OVERRIDE=true）。
 */
import {notificationConfigsDb} from './db/notification-configs'
import {settingsDb} from './db/settings'

const OVERRIDE = process.env.KING_CONFIG_OVERRIDE === 'true'

function env(key: string): string | undefined {
    return process.env[key]
}

function envBool(key: string): boolean | undefined {
    const v = env(key)
    if (v === undefined) return undefined
    return v === 'true' || v === '1'
}

function envInt(key: string): number | undefined {
    const v = env(key)
    if (v === undefined) return undefined
    const n = parseInt(v, 10)
    return isNaN(n) ? undefined : n
}

/** 更新通知渠道配置：仅在环境变量存在时写入 */
function updateChannel(channel: string, isEnabled: boolean | undefined, configJson: string | undefined): void {
    const existing = notificationConfigsDb.getByChannel(channel)
    if (!OVERRIDE && existing && existing.config_json && existing.config_json !== '{}') {
        // 已有配置且非覆盖模式，仅更新启用状态
        if (isEnabled !== undefined) {
            notificationConfigsDb.update(channel, {is_enabled: isEnabled ? 1 : 0})
        }
        return
    }
    const data: { is_enabled?: number; config_json?: string } = {}
    if (isEnabled !== undefined) {
        data.is_enabled = isEnabled ? 1 : 0
    }
    if (configJson !== undefined) {
        data.config_json = configJson
    }
    if (Object.keys(data).length > 0) {
        notificationConfigsDb.update(channel, data)
    }
}

/** 加载邮件渠道配置 */
function loadEmailConfig(): void {
    const enabled = envBool('KING_EMAIL_ENABLED')
    const smtpHost = env('KING_EMAIL_SMTP_HOST')
    const smtpPort = envInt('KING_EMAIL_SMTP_PORT')
    const smtpSecure = envBool('KING_EMAIL_SMTP_SECURE')
    const smtpUser = env('KING_EMAIL_SMTP_USER')
    const smtpPass = env('KING_EMAIL_SMTP_PASS')
    const from = env('KING_EMAIL_FROM')
    const to = env('KING_EMAIL_TO')

    if (enabled === undefined && !smtpHost) return

    const config: Record<string, any> = {}
    if (smtpHost) config.smtp_host = smtpHost
    if (smtpPort !== undefined) config.smtp_port = smtpPort
    if (smtpSecure !== undefined) config.smtp_secure = smtpSecure
    if (smtpUser) config.smtp_user = smtpUser
    if (smtpPass) config.smtp_pass = smtpPass
    if (from) config.from_address = from
    if (to) config.to_addresses = to.split(',').map(s => s.trim()).filter(Boolean)

    updateChannel('email', enabled, Object.keys(config).length > 0 ? JSON.stringify(config) : undefined)
}

/** 加载 Telegram 渠道配置 */
function loadTelegramConfig(): void {
    const enabled = envBool('KING_TELEGRAM_ENABLED')
    const botToken = env('KING_TELEGRAM_BOT_TOKEN')
    const chatId = env('KING_TELEGRAM_CHAT_ID')
    const proxyUrl = env('KING_TELEGRAM_PROXY_URL')

    if (enabled === undefined && !botToken) return

    const config: Record<string, any> = {}
    if (botToken) config.bot_token = botToken
    if (chatId) config.chat_id = chatId
    if (proxyUrl) config.proxy_url = proxyUrl

    updateChannel('telegram', enabled, Object.keys(config).length > 0 ? JSON.stringify(config) : undefined)
}

/** 加载企业微信渠道配置 */
function loadWeChatWorkConfig(): void {
    const enabled = envBool('KING_WECHAT_WORK_ENABLED')
    const corpId = env('KING_WECHAT_WORK_CORP_ID')
    const corpSecret = env('KING_WECHAT_WORK_CORP_SECRET')
    const agentId = env('KING_WECHAT_WORK_AGENT_ID')
    const toUser = env('KING_WECHAT_WORK_TO_USER')
    const msgType = env('KING_WECHAT_WORK_MSG_TYPE')

    if (enabled === undefined && !corpId) return

    const config: Record<string, any> = {}
    if (corpId) config.corp_id = corpId
    if (corpSecret) config.corp_secret = corpSecret
    if (agentId) config.agent_id = agentId
    if (toUser) config.to_user = toUser
    if (msgType) config.msg_type = msgType

    updateChannel('wechat_work', enabled, Object.keys(config).length > 0 ? JSON.stringify(config) : undefined)
}

/** 加载企微群消息推送 Webhook 渠道配置 */
function loadWeChatWorkWebhookConfig(): void {
    const enabled = envBool('KING_WECHAT_WORK_WEBHOOK_ENABLED')
    const webhookUrl = env('KING_WECHAT_WORK_WEBHOOK_URL')
    const msgType = env('KING_WECHAT_WORK_WEBHOOK_MSG_TYPE')

    if (enabled === undefined && !webhookUrl) return

    const config: Record<string, any> = {}
    if (webhookUrl) config.webhook_url = webhookUrl
    if (msgType) config.msg_type = msgType

    updateChannel('wechat_work_webhook', enabled, Object.keys(config).length > 0 ? JSON.stringify(config) : undefined)
}

/** 加载测试公众号渠道配置 */
function loadWeChatTestConfig(): void {
    const enabled = envBool('KING_WECHAT_TEST_ENABLED')
    const appId = env('KING_WECHAT_TEST_APP_ID')
    const appSecret = env('KING_WECHAT_TEST_APP_SECRET')
    const toOpenid = env('KING_WECHAT_TEST_TO_OPENID')

    if (enabled === undefined && !appId) return

    const config: Record<string, any> = {}
    if (appId) config.app_id = appId
    if (appSecret) config.app_secret = appSecret
    if (toOpenid) config.to_openid = toOpenid

    updateChannel('wechat_test', enabled, Object.keys(config).length > 0 ? JSON.stringify(config) : undefined)
}

/** 加载微信机器人渠道配置 */
function loadWeChatBotConfig(): void {
    const enabled = envBool('KING_WECHAT_BOT_ENABLED')
    if (enabled === undefined) return
    updateChannel('wechat_bot', enabled, undefined)
}

/** 加载钉钉渠道配置 */
function loadDingTalkConfig(): void {
    const enabled = envBool('KING_DINGTALK_ENABLED')
    const webhookUrl = env('KING_DINGTALK_WEBHOOK_URL')
    const secret = env('KING_DINGTALK_SECRET')
    const msgType = env('KING_DINGTALK_MSG_TYPE')

    if (enabled === undefined && !webhookUrl) return

    const config: Record<string, any> = {}
    if (webhookUrl) config.webhook_url = webhookUrl
    if (secret) config.secret = secret
    if (msgType) config.msg_type = msgType

    updateChannel('dingtalk', enabled, Object.keys(config).length > 0 ? JSON.stringify(config) : undefined)
}

/** 加载飞书渠道配置 */
function loadFeishuConfig(): void {
    const enabled = envBool('KING_FEISHU_ENABLED')
    const webhookUrl = env('KING_FEISHU_WEBHOOK_URL')
    const msgType = env('KING_FEISHU_MSG_TYPE')

    if (enabled === undefined && !webhookUrl) return

    const config: Record<string, any> = {}
    if (webhookUrl) config.webhook_url = webhookUrl
    if (msgType) config.msg_type = msgType

    updateChannel('feishu', enabled, Object.keys(config).length > 0 ? JSON.stringify(config) : undefined)
}

/** 加载 Bark 渠道配置 */
function loadBarkConfig(): void {
    const enabled = envBool('KING_BARK_ENABLED')
    const serverUrl = env('KING_BARK_SERVER_URL')
    const key = env('KING_BARK_KEY')
    const sound = env('KING_BARK_SOUND')
    const group = env('KING_BARK_GROUP')

    if (enabled === undefined && !serverUrl) return

    const config: Record<string, any> = {}
    if (serverUrl) config.server_url = serverUrl
    if (key) config.key = key
    if (sound) config.sound = sound
    if (group) config.group = group

    updateChannel('bark', enabled, Object.keys(config).length > 0 ? JSON.stringify(config) : undefined)
}

/** 加载 Discord 渠道配置 */
function loadDiscordConfig(): void {
    const enabled = envBool('KING_DISCORD_ENABLED')
    const webhookUrl = env('KING_DISCORD_WEBHOOK_URL')
    const username = env('KING_DISCORD_USERNAME')

    if (enabled === undefined && !webhookUrl) return

    const config: Record<string, any> = {}
    if (webhookUrl) config.webhook_url = webhookUrl
    if (username) config.username = username

    updateChannel('discord', enabled, Object.keys(config).length > 0 ? JSON.stringify(config) : undefined)
}

/** 加载自定义 Webhook 渠道配置 */
function loadWebhookConfig(): void {
    const enabled = envBool('KING_WEBHOOK_ENABLED')
    const url = env('KING_WEBHOOK_URL')
    const method = env('KING_WEBHOOK_METHOD')
    const headers = env('KING_WEBHOOK_HEADERS')

    if (enabled === undefined && !url) return

    const config: Record<string, any> = {}
    if (url) config.url = url
    if (method) config.method = method
    if (headers) config.headers = headers

    updateChannel('webhook', enabled, Object.keys(config).length > 0 ? JSON.stringify(config) : undefined)
}

/** 加载通用系统设置 */
function loadSystemSettings(): void {
    const apiPort = env('KING_API_PORT')
    if (apiPort) settingsDb.set('api_port', apiPort)

    const apiToken = env('KING_API_TOKEN')
    if (apiToken) settingsDb.set('api_token', apiToken)

    const apiEnabled = envBool('KING_API_ENABLED')
    if (apiEnabled !== undefined) settingsDb.set('api_enabled', String(apiEnabled))

    const schedulerInterval = env('KING_SCHEDULER_INTERVAL')
    if (schedulerInterval) settingsDb.set('scheduler_interval', schedulerInterval)
}

/**
 * 从环境变量加载所有配置
 * 仅在 headless 模式（Docker 部署）下生效，避免影响 Windows 桌面端
 * 应在数据库初始化完成后调用
 */
export function loadEnvConfig(): void {
    // 非 headless 模式（Windows 桌面端）不加载环境变量配置
    if (!process.argv.includes('--headless')) return

    const hasKingEnv = Object.keys(process.env).some(k => k.startsWith('KING_'))
    if (!hasKingEnv) return

    console.log('[EnvConfig] 检测到 KING_* 环境变量，正在加载配置...')
    if (OVERRIDE) {
        console.log('[EnvConfig] 覆盖模式已启用 (KING_CONFIG_OVERRIDE=true)')
    }

    // 通用设置
    loadSystemSettings()

    // 通知渠道
    loadEmailConfig()
    loadTelegramConfig()
    loadWeChatWorkConfig()
    loadWeChatWorkWebhookConfig()
    loadWeChatTestConfig()
    loadWeChatBotConfig()
    loadDingTalkConfig()
    loadFeishuConfig()
    loadBarkConfig()
    loadDiscordConfig()
    loadWebhookConfig()

    console.log('[EnvConfig] 环境变量配置加载完成')
}
