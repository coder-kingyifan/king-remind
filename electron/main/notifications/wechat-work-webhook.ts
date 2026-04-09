import { net } from 'electron'
import { notificationConfigsDb } from '../db/notification-configs'
import { NotificationChannel, NotificationMessage } from './types'

export class WeChatWorkWebhookNotifier implements NotificationChannel {
  async send(message: NotificationMessage): Promise<void> {
    const config = notificationConfigsDb.getChannelConfig('wechat_work_webhook')

    if (!config.webhook_url) {
      throw new Error('企业微信群消息推送 Webhook URL 未配置')
    }

    const { title, body } = message
    const content = `🔔 ${title}\n\n${body}\n\n来自 king提醒助手`

    const payload = JSON.stringify({
      msgtype: 'text',
      text: { content }
    })

    await new Promise<void>((resolve, reject) => {
      const request = net.request({
        method: 'POST',
        url: config.webhook_url
      })

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
              reject(new Error(`企业微信群消息推送发送失败: ${result.errmsg}`))
            } else {
              resolve()
            }
          } catch {
            if (response.statusCode >= 200 && response.statusCode < 300) {
              resolve()
            } else {
              reject(new Error(`企业微信群消息推送请求失败，HTTP 状态码: ${response.statusCode}`))
            }
          }
        })
      })

      request.on('error', (err) => {
        reject(new Error(`企业微信群消息推送请求错误: ${err.message}`))
      })

      request.write(payload)
      request.end()
    })
  }
}
