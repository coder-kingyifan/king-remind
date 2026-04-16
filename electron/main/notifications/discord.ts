import {net} from 'electron'
import {notificationConfigsDb} from '../db/notification-configs'
import {NotificationChannel, NotificationMessage} from './types'
import {buildTemplateVars, getTemplate, renderTemplate} from './template'

export class DiscordNotifier implements NotificationChannel {
    async send(message: NotificationMessage): Promise<void> {
        const config = notificationConfigsDb.getChannelConfig('discord')

        if (!config.webhook_url) {
            throw new Error('Discord Webhook URL 未配置')
        }

        const vars = buildTemplateVars(message)
        const template = getTemplate(config, 'discord', 'message_template')
        const content = template ? renderTemplate(template, vars) : `${vars.icon} **${vars.title}**\n\n${vars.body}\n\n_${vars.app_name} · ${vars.time}_`

        const payload: any = {
            content,
            username: config.username || 'king提醒助手'
        }

        if (config.avatar_url) {
            payload.avatar_url = config.avatar_url
        }

        await this.request(config.webhook_url, payload)
    }

    private request(url: string, payload: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const request = net.request({method: 'POST', url})
            request.setHeader('Content-Type', 'application/json')

            let responseBody = ''

            request.on('response', (response) => {
                response.on('data', (chunk) => {
                    responseBody += chunk.toString()
                })

                response.on('end', () => {
                    // Discord 返回 204 No Content 表示成功
                    if (response.statusCode >= 200 && response.statusCode < 300) {
                        resolve()
                    } else {
                        reject(new Error(`Discord Webhook 请求失败，HTTP 状态码: ${response.statusCode}: ${responseBody}`))
                    }
                })
            })

            request.on('error', (err) => {
                reject(new Error(`Discord Webhook 请求错误: ${err.message}`))
            })

            request.write(JSON.stringify(payload))
            request.end()
        })
    }
}
