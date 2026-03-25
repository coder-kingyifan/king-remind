import { net } from 'electron'
import { notificationConfigsDb } from '../db/notification-configs'
import { NotificationChannel, NotificationMessage } from './types'

export class WebhookNotifier implements NotificationChannel {
  async send(message: NotificationMessage): Promise<void> {
    const config = notificationConfigsDb.getChannelConfig('webhook')

    if (!config.url) {
      throw new Error('Webhook URL 未配置')
    }

    const method = (config.method || 'POST').toUpperCase()

    // 构建请求体
    let bodyTemplate = config.body_template || ''
    let body: string
    if (bodyTemplate) {
      body = bodyTemplate
        .replace(/\{\{title\}\}/g, message.title)
        .replace(/\{\{body\}\}/g, message.body)
        .replace(/\{\{reminder_id\}\}/g, String(message.reminderId))
    } else {
      body = JSON.stringify({
        title: message.title,
        body: message.body,
        reminder_id: message.reminderId,
        timestamp: new Date().toISOString()
      })
    }

    // 解析自定义 Headers
    let headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (config.headers) {
      try {
        const customHeaders = typeof config.headers === 'string'
          ? JSON.parse(config.headers)
          : config.headers
        headers = { ...headers, ...customHeaders }
      } catch {
        // 忽略无效的 headers JSON
      }
    }

    await new Promise<void>((resolve, reject) => {
      const request = net.request({
        method,
        url: config.url
      })

      for (const [key, value] of Object.entries(headers)) {
        request.setHeader(key, value)
      }

      request.on('response', (response) => {
        const status = response.statusCode
        if (status >= 200 && status < 300) {
          resolve()
        } else {
          reject(new Error(`Webhook 请求失败，HTTP 状态码: ${status}`))
        }
        // 消耗响应体防止内存泄漏
        response.on('data', () => {})
      })

      request.on('error', (err) => {
        reject(new Error(`Webhook 请求错误: ${err.message}`))
      })

      if (method !== 'GET' && method !== 'HEAD') {
        request.write(body)
      }
      request.end()
    })
  }
}
