import { net } from 'electron'
import { notificationConfigsDb } from '../db/notification-configs'
import { NotificationChannel, NotificationMessage } from './types'
import { buildTemplateVars, renderTemplate, getTemplate } from './template'

export class WeChatWorkWebhookNotifier implements NotificationChannel {
  async send(message: NotificationMessage): Promise<void> {
    const config = notificationConfigsDb.getChannelConfig('wechat_work_webhook')

    if (!config.webhook_url) {
      throw new Error('企业微信群消息推送 Webhook URL 未配置')
    }

    const vars = buildTemplateVars(message)
    const msgType = config.msg_type || 'text'

    let payload: any

    if (msgType === 'markdown') {
      const template = getTemplate(config, 'wechat_work_webhook', 'markdown_template')
      const content = renderTemplate(template, vars)
      payload = {
        msgtype: 'markdown',
        markdown: { content }
      }
    } else {
      const template = getTemplate(config, 'wechat_work_webhook', 'message_template')
      const content = renderTemplate(template, vars)

      const mentioned_list: string[] = []
      const mentioned_mobile_list: string[] = []

      // 处理@成员配置
      const mentionMode = config.mention_mode || 'none'
      if (mentionMode === 'all') {
        mentioned_list.push('@all')
      } else if (mentionMode === 'custom') {
        const userIds = (config.mention_userids || '').split(',').map((s: string) => s.trim()).filter(Boolean)
        const mobiles = (config.mention_mobiles || '').split(',').map((s: string) => s.trim()).filter(Boolean)
        mentioned_list.push(...userIds)
        mentioned_mobile_list.push(...mobiles)
      }

      payload = {
        msgtype: 'text',
        text: {
          content,
          ...(mentioned_list.length > 0 ? { mentioned_list } : {}),
          ...(mentioned_mobile_list.length > 0 ? { mentioned_mobile_list } : {})
        }
      }
    }

    await this.request(config.webhook_url, payload)
  }

  private request(url: string, payload: any): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const request = net.request({ method: 'POST', url })
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

      request.write(JSON.stringify(payload))
      request.end()
    })
  }
}
