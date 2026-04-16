export interface NotificationConfig {
    id: number
    channel: string
    is_enabled: number
    config_json: string
    created_at: string
    updated_at: string
}

export interface ChannelInfo {
    key: string
    name: string
    icon: string
    description: string
}

export const CHANNELS: ChannelInfo[] = [
    {key: 'desktop', name: '桌面通知', icon: '🖥️', description: '系统桌面浮窗通知'},
    {key: 'email', name: '邮件', icon: '📧', description: 'SMTP邮件推送'},
    {key: 'telegram', name: 'Telegram', icon: '✈️', description: 'Telegram Bot消息'},
    {key: 'wechat_work', name: '企业微信', icon: '💬', description: '企业微信应用消息'},
    {key: 'wechat_work_webhook', name: '企微群消息推送', icon: '🤖', description: '企业微信群消息推送 Webhook'},
    {key: 'wechat_test', name: '测试公众号', icon: '📱', description: '微信公众平台测试号消息推送'},
    {key: 'wechat_bot', name: '微信', icon: '🤖', description: '通过微信机器人主动发送提醒消息'},
    {key: 'dingtalk', name: '钉钉群机器人', icon: '🔵', description: '钉钉群聊自定义机器人'},
    {key: 'feishu', name: '飞书群机器人', icon: '🟢', description: '飞书群聊自定义机器人'},
    {key: 'bark', name: 'Bark', icon: '🍎', description: 'iOS 推送（Bark App）'},
    {key: 'discord', name: 'Discord', icon: '🎮', description: 'Discord Webhook 消息'},
    {key: 'webhook', name: 'Webhook', icon: '🔗', description: '自定义 HTTP 回调请求'}
]
