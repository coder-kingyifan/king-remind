import axios from 'axios'
import { notificationConfigsDb } from '../db/notification-configs'
import { NotificationChannel, NotificationMessage } from './types'
import { buildTemplateVars, renderTemplate, getTemplate } from './template'

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

    const axiosConfig: any = { timeout: 15000 }

    // 代理配置
    if (config.proxy_url) {
      try {
        const url = new URL(config.proxy_url)
        axiosConfig.proxy = {
          protocol: url.protocol.replace(':', ''),
          host: url.hostname,
          port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 1080)
        }
        if (url.username) {
          axiosConfig.proxy.auth = {
            username: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password || '')
          }
        }
      } catch {
        throw new Error(`代理地址格式无效: ${config.proxy_url}`)
      }
    }

    // 支持多个 Chat ID（逗号分隔）
    const chatIds = String(config.chat_id).split(',').map((s: string) => s.trim()).filter(Boolean)
    const errors: string[] = []

    for (const chatId of chatIds) {
      try {
        await axios.post(
          `https://api.telegram.org/bot${config.bot_token}/sendMessage`,
          { chat_id: chatId, text, parse_mode: 'HTML' },
          axiosConfig
        )
      } catch (error: any) {
        const desc = error.response?.data?.description
        errors.push(desc ? `Telegram[${chatId}]: ${desc}` : error.message)
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
}
