import nodemailer from 'nodemailer'
import { notificationConfigsDb } from '../db/notification-configs'
import { NotificationChannel, NotificationMessage } from './types'
import { buildTemplateVars, renderTemplate, getTemplate } from './template'

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

    const vars = buildTemplateVars(message)
    const subject = renderTemplate(getTemplate(config, 'email', 'subject_template'), vars)
    const html = renderTemplate(getTemplate(config, 'email', 'body_template'), vars)

    await transporter.sendMail({
      from: config.from_address || config.smtp_user,
      to: toAddresses,
      subject,
      html
    })
  }
}
