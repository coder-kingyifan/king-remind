import {net} from 'electron'
import {notificationConfigsDb} from '../db/notification-configs'
import {NotificationChannel, NotificationMessage} from './types'
import {buildTemplateVars, getTemplate, renderTemplate} from './template'

export class DingTalkNotifier implements NotificationChannel {
    async send(message: NotificationMessage): Promise<void> {
        const config = notificationConfigsDb.getChannelConfig('dingtalk')

        if (!config.webhook_url) {
            throw new Error('钉钉群机器人 Webhook URL 未配置')
        }

        const vars = buildTemplateVars(message)
        const msgType = config.msg_type || 'text'

        let payload: any

        if (msgType === 'markdown') {
            const template = getTemplate(config, 'dingtalk', 'markdown_template')
            const content = renderTemplate(template, vars)
            payload = {
                msgtype: 'markdown',
                markdown: {title: vars.title, text: content}
            }
        } else {
            const template = getTemplate(config, 'dingtalk', 'message_template')
            const content = renderTemplate(template, vars)

            const atMobiles: string[] = []
            const atUserIds: string[] = []
            let isAtAll = false

            const mentionMode = config.mention_mode || 'none'
            if (mentionMode === 'all') {
                isAtAll = true
            } else if (mentionMode === 'custom') {
                const mobiles = (config.mention_mobiles || '').split(',').map((s: string) => s.trim()).filter(Boolean)
                const userIds = (config.mention_userids || '').split(',').map((s: string) => s.trim()).filter(Boolean)
                atMobiles.push(...mobiles)
                atUserIds.push(...userIds)
            }

            payload = {
                msgtype: 'text',
                text: {content},
                at: {
                    atMobiles,
                    atUserIds,
                    isAtAll
                }
            }
        }

        await this.request(config.webhook_url, payload, config.secret || '')
    }

    private request(url: string, payload: any, secret: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let requestUrl = url
            // 钉钉签名验证
            if (secret) {
                const timestamp = Date.now()
                const crypto = require('crypto')
                const stringToSign = `${timestamp}\n${secret}`
                const hmac = crypto.createHmac('sha256', secret)
                hmac.update(stringToSign)
                const sign = encodeURIComponent(hmac.digest('base64'))
                requestUrl = `${url}&timestamp=${timestamp}&sign=${sign}`
            }

            const request = net.request({method: 'POST', url: requestUrl})
            request.setHeader('Content-Type', 'application/json')

            let responseBody = ''

            request.on('response', (response) => {
                response.on('data', (chunk) => {
                    responseBody += chunk.toString()
                })

                response.on('end', () => {
                    try {
                        const result = JSON.parse(responseBody)
                        if (result.errcode !== 0) {
                            reject(new Error(`钉钉群机器人发送失败: ${result.errmsg}`))
                        } else {
                            resolve()
                        }
                    } catch {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            resolve()
                        } else {
                            reject(new Error(`钉钉群机器人请求失败，HTTP 状态码: ${response.statusCode}`))
                        }
                    }
                })
            })

            request.on('error', (err) => {
                reject(new Error(`钉钉群机器人请求错误: ${err.message}`))
            })

            request.write(JSON.stringify(payload))
            request.end()
        })
    }
}
