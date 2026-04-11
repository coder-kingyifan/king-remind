import axios from 'axios'
import { notificationConfigsDb } from '../db/notification-configs'
import { NotificationChannel, NotificationMessage } from './types'
import { buildTemplateVars, renderTemplate, getTemplate } from './template'

export class WeChatWorkNotifier implements NotificationChannel {
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  async send(message: NotificationMessage): Promise<void> {
    const config = notificationConfigsDb.getChannelConfig('wechat_work')

    if (!config.corp_id || !config.corp_secret || !config.agent_id) {
      throw new Error('企业微信配置不完整，请先配置企业ID、应用Secret和AgentId')
    }

    const token = await this.getAccessToken(config)
    const vars = buildTemplateVars(message)
    const msgType = config.msg_type || 'text'

    let body: any

    if (msgType === 'markdown') {
      const template = getTemplate(config, 'wechat_work', 'markdown_template')
      const content = renderTemplate(template, vars)
      body = {
        touser: config.to_user || '@all',
        msgtype: 'markdown',
        agentid: parseInt(config.agent_id),
        markdown: { content }
      }
    } else {
      const template = getTemplate(config, 'wechat_work', 'message_template')
      const content = renderTemplate(template, vars)
      body = {
        touser: config.to_user || '@all',
        msgtype: 'text',
        agentid: parseInt(config.agent_id),
        text: { content }
      }
    }

    // 支持多个接收人（| 分隔）
    const toUsers = String(body.touser).split('|').map((s: string) => s.trim()).filter(Boolean)
    const errors: string[] = []

    for (const toUser of toUsers) {
      try {
        const response = await axios.post(
          `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`,
          { ...body, touser: toUser },
          { timeout: 10000 }
        )
        if (response.data.errcode !== 0) {
          errors.push(`企业微信[${toUser}]: ${response.data.errmsg}`)
        }
      } catch (error: any) {
        errors.push(error.message)
      }
    }

    if (errors.length > 0 && errors.length === toUsers.length) {
      throw new Error(errors.join('; '))
    }
  }

  private async getAccessToken(config: Record<string, any>): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    const response = await axios.get(
      'https://qyapi.weixin.qq.com/cgi-bin/gettoken',
      {
        params: {
          corpid: config.corp_id,
          corpsecret: config.corp_secret
        },
        timeout: 10000
      }
    )

    if (response.data.errcode !== 0) {
      throw new Error(`获取企业微信Token失败: ${response.data.errmsg}`)
    }

    this.accessToken = response.data.access_token
    this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000
    return this.accessToken!
  }
}
