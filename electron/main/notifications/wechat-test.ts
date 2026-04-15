import axios from 'axios'
import {notificationConfigsDb} from '../db/notification-configs'
import {NotificationChannel, NotificationMessage} from './types'
import {buildTemplateVars, getTemplate, renderTemplate} from './template'

export class WeChatTestNotifier implements NotificationChannel {
    private accessToken: string | null = null
    private tokenExpiry: number = 0

    async send(message: NotificationMessage): Promise<void> {
        const config = notificationConfigsDb.getChannelConfig('wechat_test')

        if (!config.app_id || !config.app_secret) {
            throw new Error('测试公众号配置不完整，请先配置 AppID 和 AppSecret')
        }

        const token = await this.getAccessToken(config)
        const vars = buildTemplateVars(message)
        const msgType = config.msg_type || 'text'

        if (msgType === 'template' && config.template_id) {
            await this.sendTemplateMessage(token, config, vars)
        } else {
            await this.sendCustomMessage(token, config, vars)
        }
    }

    private async sendCustomMessage(
        token: string,
        config: Record<string, any>,
        vars: ReturnType<typeof buildTemplateVars>
    ): Promise<void> {
        const template = getTemplate(config, 'wechat_test', 'message_template')
        const content = renderTemplate(template, vars)

        const openIds = this.parseOpenIds(config.to_openid)

        const errors: string[] = []
        for (const openId of openIds) {
            try {
                const response = await axios.post(
                    `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${token}`,
                    {
                        touser: openId,
                        msgtype: 'text',
                        text: {content}
                    },
                    {timeout: 10000}
                )
                if (response.data.errcode !== 0) {
                    errors.push(`测试公众号[${openId}]: ${response.data.errmsg}`)
                }
            } catch (error: any) {
                errors.push(error.message)
            }
        }

        if (errors.length > 0 && errors.length === openIds.length) {
            throw new Error(errors.join('; '))
        }
    }

    private async sendTemplateMessage(
        token: string,
        config: Record<string, any>,
        vars: ReturnType<typeof buildTemplateVars>
    ): Promise<void> {
        const openIds = this.parseOpenIds(config.to_openid)

        const templateData: Record<string, { value: string; color?: string }> = {}
        const fields: Array<{key: string; value: string; color?: string}> = config.template_fields || []

        if (fields.length > 0) {
            for (const field of fields) {
                if (!field.key) continue
                const rendered = renderTemplate(field.value || '', vars)
                const entry: { value: string; color?: string } = {value: rendered}
                if (field.color) entry.color = field.color
                templateData[field.key] = entry
            }
        } else {
            templateData['first'] = {value: `${vars.icon} ${vars.title}`}
            templateData['keyword1'] = {value: vars.body}
            templateData['remark'] = {value: `${vars.app_name} · ${vars.time}`}
        }

        const errors: string[] = []
        for (const openId of openIds) {
            try {
                const response = await axios.post(
                    `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`,
                    {
                        touser: openId,
                        template_id: config.template_id,
                        url: config.template_url || '',
                        data: templateData
                    },
                    {timeout: 10000}
                )
                if (response.data.errcode !== 0) {
                    errors.push(`测试公众号[${openId}]: ${response.data.errmsg}`)
                }
            } catch (error: any) {
                errors.push(error.message)
            }
        }

        if (errors.length > 0 && errors.length === openIds.length) {
            throw new Error(errors.join('; '))
        }
    }

    private parseOpenIds(toOpenid: string): string[] {
        if (!toOpenid) return []
        return toOpenid.split(',').map((s: string) => s.trim()).filter(Boolean)
    }

    private async getAccessToken(config: Record<string, any>): Promise<string> {
        if (this.accessToken && Date.now() < this.tokenExpiry) {
            return this.accessToken
        }

        const response = await axios.get(
            'https://api.weixin.qq.com/cgi-bin/token',
            {
                params: {
                    grant_type: 'client_credential',
                    appid: config.app_id,
                    secret: config.app_secret
                },
                timeout: 10000
            }
        )

        if (response.data.errcode) {
            throw new Error(`获取测试公众号Token失败: ${response.data.errmsg}`)
        }

        this.accessToken = response.data.access_token
        this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000
        return this.accessToken!
    }
}
