import { NotificationMessage } from './types'

export interface TemplateVars {
  title: string
  body: string
  icon: string
  time: string
  app_name: string
}

/** 从 NotificationMessage 构造模板变量 */
export function buildTemplateVars(message: NotificationMessage): TemplateVars {
  return {
    title: message.title,
    body: message.body,
    icon: message.icon || '🔔',
    time: new Date().toLocaleString('zh-CN'),
    app_name: 'king提醒助手'
  }
}

/** 将模板中的 {{var}} 替换为实际值 */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{\{title\}\}/g, vars.title)
    .replace(/\{\{body\}\}/g, vars.body)
    .replace(/\{\{icon\}\}/g, vars.icon)
    .replace(/\{\{time\}\}/g, vars.time)
    .replace(/\{\{app_name\}\}/g, vars.app_name)
}

// 各渠道默认模板
export const DEFAULT_TEMPLATES: Record<string, Record<string, string>> = {
  email: {
    subject_template: '{{icon}} {{title}} - {{app_name}}',
    body_template: `<div style="font-family: -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px 0;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 28px 24px; border-radius: 16px 16px 0 0;">
    <div style="font-size: 28px; margin-bottom: 8px;">{{icon}}</div>
    <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #fff; letter-spacing: 0.5px;">{{title}}</h2>
  </div>
  <div style="background: #ffffff; padding: 24px; border: 1px solid #e8e8ed; border-top: none;">
    <p style="color: #1d1d1f; font-size: 15px; line-height: 1.7; margin: 0; white-space: pre-wrap;">{{body}}</p>
  </div>
  <div style="background: #fafafa; padding: 16px 24px; border-radius: 0 0 16px 16px; border: 1px solid #e8e8ed; border-top: none;">
    <p style="color: #86868b; font-size: 12px; margin: 0;">
      {{app_name}} · {{time}}
    </p>
  </div>
</div>`
  },
  telegram: {
    message_template: `{{icon}} <b>{{title}}</b>

{{body}}

<i>{{app_name}} · {{time}}</i>`
  },
  wechat_work: {
    message_template: `{{icon}} {{title}}

{{body}}

{{app_name}} · {{time}}`,
    markdown_template: `# {{icon}} {{title}}

{{body}}

> {{app_name}} · {{time}}`
  },
  wechat_work_webhook: {
    message_template: `{{icon}} {{title}}

{{body}}

{{app_name}} · {{time}}`,
    markdown_template: `# {{icon}} {{title}}

{{body}}

> <font color="comment">{{app_name}} · {{time}}</font>`
  }
}

/** 获取渠道模板，优先用用户自定义的，否则用默认的 */
export function getTemplate(config: Record<string, any>, channel: string, key: string): string {
  if (config[key] && typeof config[key] === 'string' && config[key].trim()) {
    return config[key]
  }
  return DEFAULT_TEMPLATES[channel]?.[key] || ''
}
