import {net} from 'electron'
import {notificationConfigsDb} from '../db/notification-configs'
import {NotificationChannel, NotificationMessage} from './types'
import {buildTemplateVars, getTemplate, renderTemplate} from './template'

export class TelegramNotifier implements NotificationChannel {
    async send(message: NotificationMessage): Promise<void> {
        const config = notificationConfigsDb.getChannelConfig('telegram')

        if (!config.bot_token || !config.chat_id) {
            throw new Error('Telegram配置不完整，请先配置Bot Token和Chat ID')
        }

        const vars = buildTemplateVars(message)
        // 对变量进行 HTML 转义后再渲染模板
        const escapedVars = {
            ...vars,
            title: this.escapeHtml(vars.title),
            body: this.escapeHtml(vars.body)
        }
        const template = getTemplate(config, 'telegram', 'message_template')
        const text = renderTemplate(template, escapedVars)

        // 支持多个 Chat ID（逗号分隔）
        const chatIds = String(config.chat_id).split(',').map((s: string) => s.trim()).filter(Boolean)
        const errors: string[] = []

        for (const chatId of chatIds) {
            try {
                await this.request(
                    `https://api.telegram.org/bot${config.bot_token}/sendMessage`,
                    {chat_id: chatId, text, parse_mode: 'HTML'}
                )
            } catch (error: any) {
                errors.push(`Telegram[${chatId}]: ${error.message}`)
            }
        }

        if (errors.length > 0 && errors.length === chatIds.length) {
            throw new Error(errors.join('; '))
        }
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
    }

    private request(url: string, payload: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const request = net.request({method: 'POST', url})
            request.setHeader('Content-Type', 'application/json')

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
                finish(() => reject(new Error('连接超时，请检查网络代理设置')))
            }, 15000)

            let responseBody = ''
            request.on('response', (response) => {
                response.on('data', (chunk) => {
                    responseBody += chunk.toString()
                })

                response.on('end', () => {
                    finish(() => {
                        try {
                            const result = JSON.parse(responseBody || '{}')
                            if (response.statusCode >= 200 && response.statusCode < 300 && result.ok !== false) {
                                resolve()
                            } else {
                                reject(new Error(result.description || `请求失败，HTTP 状态码: ${response.statusCode}`))
                            }
                        } catch {
                            if (response.statusCode >= 200 && response.statusCode < 300) {
                                resolve()
                            } else {
                                reject(new Error(`请求失败，HTTP 状态码: ${response.statusCode}`))
                            }
                        }
                    })
                })
            })

            request.on('error', (err) => {
                finish(() => reject(new Error(`${err.message}。如需推送 Telegram，请先在系统设置里配置网络代理。`)))
            })

            request.write(JSON.stringify(payload))
            request.end()
        })
    }
}
