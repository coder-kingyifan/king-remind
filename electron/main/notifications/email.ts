import nodemailer from 'nodemailer'
import { notificationConfigsDb } from '../db/notification-configs'
import { NotificationChannel, NotificationMessage } from './types'

export class EmailNotifier implements NotificationChannel {
  async send(message: NotificationMessage): Promise<void> {
    const config = notificationConfigsDb.getChannelConfig('email')

    if (!config.smtp_host || !config.smtp_user) {
      throw new Error('邮件配置不完整，请先配置SMTP信息')
    }

    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port || 587,
      secure: config.smtp_secure || false,
      auth: {
        user: config.smtp_user,
        pass: config.smtp_pass
      }
    })

    const toAddresses = Array.isArray(config.to_addresses)
      ? config.to_addresses.filter(Boolean).join(',')
      : config.to_addresses

    if (!toAddresses) {
      throw new Error('未配置收件人地址')
    }

    await transporter.sendMail({
      from: config.from_address || config.smtp_user,
      to: toAddresses,
      subject: `[king提醒助手] ${message.title}`,
      html: `
        <div style="font-family: 'Microsoft YaHei', sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #409EFF, #53a8ff); color: white; padding: 20px; border-radius: 12px 12px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">🔔 ${message.title}</h2>
          </div>
          <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 12px 12px; border: 1px solid #eee; border-top: none;">
            <p style="color: #333; font-size: 14px; line-height: 1.6; margin: 0;">${message.body}</p>
            <p style="color: #999; font-size: 12px; margin-top: 16px; margin-bottom: 0;">
              来自 king提醒助手 · ${new Date().toLocaleString('zh-CN')}
            </p>
          </div>
        </div>
      `
    })
  }
}
