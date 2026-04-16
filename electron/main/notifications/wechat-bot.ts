import {weChatBot} from '../wechat-bot/wechat-bot'
import {notificationConfigsDb} from '../db/notification-configs'
import {NotificationChannel, NotificationMessage} from './types'
import {buildTemplateVars, getTemplate, renderTemplate} from './template'

export class WeChatBotNotifier implements NotificationChannel {
    async send(message: NotificationMessage): Promise<void> {
        const config = notificationConfigsDb.getChannelConfig('wechat_bot')
        const vars = buildTemplateVars(message)
        const template = getTemplate(config, 'wechat_bot', 'message_template')
        const content = renderTemplate(template, vars)

        await weChatBot.sendReminderMessage(content)
    }
}
