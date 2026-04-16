import {net} from 'electron'
import {notificationConfigsDb} from '../db/notification-configs'
import {NotificationChannel, NotificationMessage} from './types'
import {buildTemplateVars, getTemplate, renderTemplate} from './template'

export class FeishuNotifier implements NotificationChannel {
    async send(message: NotificationMessage): Promise<void> {
        const config = notificationConfigsDb.getChannelConfig('feishu')

        if (!config.webhook_url) {
            throw new Error('飞书群机器人 Webhook URL 未配置')
        }

        const vars = buildTemplateVars(message)
        const msgType = config.msg_type || 'text'

        let payload: any

        if (msgType === 'interactive') {
            // 飞书富文本/卡片消息
            const template = getTemplate(config, 'feishu', 'message_template')
            const content = renderTemplate(template, vars)
            payload = {
                msg_type: 'interactive',
                card: {elements: [{tag: 'div', text: {tag: 'lark_md', content}}]}
            }
        } else {
            const template = getTemplate(config, 'feishu', 'message_template')
            const content = renderTemplate(template, vars)
            payload = {
                msg_type: 'text',
                content: {text: content}
            }
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
                    try {
                        const result = JSON.parse(responseBody)
                        if (result.code !== 0) {
                            reject(new Error(`飞书群机器人发送失败: ${result.msg}`))
                        } else {
                            resolve()
                        }
                    } catch {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            resolve()
                        } else {
                            reject(new Error(`飞书群机器人请求失败，HTTP 状态码: ${response.statusCode}`))
                        }
                    }
                })
            })

            request.on('error', (err) => {
                reject(new Error(`飞书群机器人请求错误: ${err.message}`))
            })

            request.write(JSON.stringify(payload))
            request.end()
        })
    }
}
