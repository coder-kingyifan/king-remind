import {BrowserWindow} from 'electron'
import {notificationConfigsDb} from '../db/notification-configs'
import {reminderLogsDb} from '../db/reminder-logs'
import {Reminder} from '../db/reminders'
import {DesktopNotifier} from './desktop'
import {EmailNotifier} from './email'
import {TelegramNotifier} from './telegram'
import {WeChatWorkNotifier} from './wechat-work'
import {WeChatWorkWebhookNotifier} from './wechat-work-webhook'
import {WeChatTestNotifier} from './wechat-test'
import {WeChatBotNotifier} from './wechat-bot'
import {WebhookNotifier} from './webhook'
import {DingTalkNotifier} from './dingtalk'
import {FeishuNotifier} from './feishu'
import {BarkNotifier} from './bark'
import {DiscordNotifier} from './discord'
import {NotificationChannel, NotificationMessage} from './types'

export class NotificationDispatcher {
    private channels: Map<string, NotificationChannel>

    constructor(mainWindow: BrowserWindow | null) {
        this.channels = new Map([
            ['desktop', new DesktopNotifier(mainWindow)],
            ['email', new EmailNotifier()],
            ['telegram', new TelegramNotifier()],
            ['wechat_work', new WeChatWorkNotifier()],
            ['wechat_work_webhook', new WeChatWorkWebhookNotifier()],
            ['wechat_test', new WeChatTestNotifier()],
            ['wechat_bot', new WeChatBotNotifier()],
            ['webhook', new WebhookNotifier()],
            ['dingtalk', new DingTalkNotifier()],
            ['feishu', new FeishuNotifier()],
            ['bark', new BarkNotifier()],
            ['discord', new DiscordNotifier()]
        ])
    }

    async dispatch(reminder: Reminder, skillResult?: string): Promise<void> {
        let channelIds: string[]
        try {
            channelIds = JSON.parse(reminder.channels)
        } catch {
            channelIds = ['desktop']
        }

        for (const channelId of channelIds) {
            // 检查渠道是否已启用（桌面通知始终允许）
            if (channelId !== 'desktop' && !notificationConfigsDb.isChannelEnabled(channelId)) {
                continue
            }

            const channel = this.channels.get(channelId)
            if (!channel) continue

            // Parse structured skill result (JSON with title/content)
            let messageTitle = reminder.title
            let messageBody = reminder.description || reminder.title
            if (skillResult) {
                try {
                    const parsed = JSON.parse(skillResult)
                    if (parsed && typeof parsed === 'object') {
                        if (parsed.title) messageTitle = String(parsed.title)
                        if (parsed.content) {
                            messageBody = parsed.content
                        } else if (parsed.body) {
                            messageBody = String(parsed.body)
                        }
                    } else {
                        messageBody = `${reminder.description || reminder.title}\n\n${skillResult}`
                    }
                } catch {
                    // Not JSON, use as plain text
                    messageBody = `${reminder.description || reminder.title}\n\n${skillResult}`
                }
            }

            const message: NotificationMessage = {
                title: messageTitle,
                body: messageBody,
                icon: reminder.icon,
                color: reminder.color,
                reminderId: reminder.id
            }

            try {
                await channel.send(message)
                reminderLogsDb.create(reminder.id, channelId, 'sent', undefined, reminder.title, reminder.icon)
            } catch (error: any) {
                console.error(`[${channelId}] 发送通知失败:`, error.message)
                reminderLogsDb.create(reminder.id, channelId, 'failed', error.message, reminder.title, reminder.icon)
            }
        }
    }

    async sendToChannels(channelIds: string[], message: NotificationMessage): Promise<void> {
        for (const channelId of channelIds) {
            if (channelId !== 'desktop' && !notificationConfigsDb.isChannelEnabled(channelId)) continue
            const channel = this.channels.get(channelId)
            if (!channel) continue
            try {
                await channel.send(message)
                reminderLogsDb.create(message.reminderId, channelId, 'sent')
            } catch (error: any) {
                console.error(`[${channelId}] 发送通知失败:`, error.message)
                reminderLogsDb.create(message.reminderId, channelId, 'failed', error.message)
            }
        }
    }

    async testChannel(channelId: string): Promise<{ success: boolean; error?: string }> {
        const channel = this.channels.get(channelId)
        if (!channel) {
            return {success: false, error: '未知的通知渠道'}
        }

        const testMessage: NotificationMessage = {
            title: '测试通知',
            body: '这是一条来自 king提醒助手的测试通知，如果您收到此消息，说明该通知渠道配置成功！',
            icon: '🔔',
            reminderId: 0
        }

        try {
            await channel.send(testMessage)
            return {success: true}
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    }
}
