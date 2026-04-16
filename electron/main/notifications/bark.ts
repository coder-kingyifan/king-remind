import {net} from 'electron'
import {notificationConfigsDb} from '../db/notification-configs'
import {NotificationChannel, NotificationMessage} from './types'
import {buildTemplateVars, getTemplate, renderTemplate} from './template'

export class BarkNotifier implements NotificationChannel {
    async send(message: NotificationMessage): Promise<void> {
        const config = notificationConfigsDb.getChannelConfig('bark')

        if (!config.server_url) {
            throw new Error('Bark 服务器地址未配置')
        }

        const vars = buildTemplateVars(message)
        const template = getTemplate(config, 'bark', 'message_template')
        const body = template ? renderTemplate(template, vars) : vars.body

        // Bark API: POST https://api.day.app/push
        // 或自建: https://your-server/push
        const payload = {
            title: vars.title,
            body,
            icon: vars.icon,
            sound: config.sound || 'alarm',
            group: config.group || 'king-remind',
            url: config.url || ''
        }

        await this.request(`${config.server_url.replace(/\/+$/, '')}/push`, payload)
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
                    try {
                        const result = JSON.parse(responseBody)
                        if (result.code === 200 || result.status === 'ok') {
                            resolve()
                        } else {
                            reject(new Error(`Bark 推送失败: ${result.message || result.msg || responseBody}`))
                        }
                    } catch {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            resolve()
                        } else {
                            reject(new Error(`Bark 请求失败，HTTP 状态码: ${response.statusCode}`))
                        }
                    }
                })
            })

            request.on('error', (err) => {
                reject(new Error(`Bark 请求错误: ${err.message}`))
            })

            request.write(JSON.stringify(payload))
            request.end()
        })
    }
}
