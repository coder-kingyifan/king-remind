import axios from 'axios'
import { settingsDb } from './db/settings'
import { remindersDb, CreateReminderInput } from './db/reminders'
import { modelConfigsDb } from './db/model-configs'
import { ReminderScheduler } from './scheduler'

// ======================== 服务商预设 ========================

export interface ProviderPreset {
  id: string
  name: string
  baseUrl: string
  apiKeyRequired: boolean
  defaultModel: string
  protocol: 'openai' | 'anthropic'
}

export const PROVIDERS: ProviderPreset[] = [
  { id: 'ollama', name: 'Ollama（本地）', baseUrl: 'http://127.0.0.1:11434/v1', apiKeyRequired: false, defaultModel: 'qwen3:8b', protocol: 'openai' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKeyRequired: true, defaultModel: 'gpt-4o-mini', protocol: 'openai' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', apiKeyRequired: true, defaultModel: 'deepseek-chat', protocol: 'openai' },
  { id: 'qwen', name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKeyRequired: true, defaultModel: 'qwen-plus', protocol: 'openai' },
  { id: 'zhipu', name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKeyRequired: true, defaultModel: 'glm-4-flash', protocol: 'openai' },
  { id: 'claude', name: 'Claude', baseUrl: 'https://api.anthropic.com', apiKeyRequired: true, defaultModel: 'claude-sonnet-4-20250514', protocol: 'anthropic' },
  { id: 'custom', name: '自定义（OpenAI 兼容）', baseUrl: '', apiKeyRequired: true, defaultModel: '', protocol: 'openai' }
]

export function getProviderById(id: string): ProviderPreset {
  return PROVIDERS.find(p => p.id === id) || PROVIDERS[0]
}

// ======================== 配置读取 ========================

function getLLMConfig(configId?: number) {
  // 优先从 model_configs 表读取指定配置
  const saved = configId ? modelConfigsDb.get(configId) : modelConfigsDb.getDefault()
  if (saved) {
    const provider = getProviderById(saved.provider)
    return {
      provider,
      baseUrl: saved.base_url || provider.baseUrl,
      apiKey: saved.api_key || '',
      model: saved.model || provider.defaultModel
    }
  }
  // 兼容旧 settings 配置
  const providerId = settingsDb.get('llm_provider') || 'ollama'
  const provider = getProviderById(providerId)
  return {
    provider,
    baseUrl: settingsDb.get('llm_base_url') || provider.baseUrl,
    apiKey: settingsDb.get('llm_api_key') || '',
    model: settingsDb.get('llm_model') || provider.defaultModel
  }
}

// ======================== 工具定义 ========================

const SYSTEM_PROMPT = `你是 King 提醒助手的 AI 助手。你可以帮助用户通过自然语言创建提醒。

当前时间: {{current_time}}

你可以调用以下工具来帮助用户:

1. create_reminder - 创建一个新的提醒
   参数:
   - title (必填): 提醒标题
   - description (可选): 提醒描述
   - remind_type (必填): "interval"（循环提醒）或 "scheduled"（定时提醒）
   - start_time (必填): 开始时间，ISO 8601格式，如 "2025-06-01T10:00:00"
   - interval_value (可选): 周期间隔数值，如 30
   - interval_unit (可选): 周期单位 "minutes"/"hours"/"days"/"months"/"years"
   - weekdays (可选): 星期几触发，0=周日 1=周一 ... 6=周六，如 [1,2,3,4,5]
   - workday_only (可选): 是否仅工作日，true/false
   - icon (可选): emoji 图标
   - active_hours_start (可选): 活跃时段开始 HH:mm
   - active_hours_end (可选): 活跃时段结束 HH:mm
   - channels (必填): 通知渠道数组，可用值: "desktop"(桌面通知) / "email"(邮件) / "telegram" / "wechat_work"(企业微信) / "webhook"

2. list_reminders - 列出提醒
   参数:
   - is_active (可选): 1=仅启用的，0=仅禁用的
   - search (可选): 搜索关键词

3. delete_reminder - 删除提醒
   参数:
   - id (必填): 提醒ID

4. toggle_reminder - 启用/禁用提醒
   参数:
   - id (必填): 提醒ID

请根据用户的自然语言描述，智能提取参数并调用合适的工具。
示例:
- 用户说"每30分钟提醒我喝水" → 调用 create_reminder，remind_type="interval"，interval_value=30，interval_unit="minutes"
- 用户说"明天下午3点开会" → 调用 create_reminder，remind_type="scheduled"，start_time=计算出的时间
- 用户说"工作日每天早上9点站会" → 调用 create_reminder，remind_type="interval"，interval_unit="days"，workday_only=true，start_time 包含09:00
- 用户说"查看我的提醒" → 调用 list_reminders
- 用户说"删除第3个提醒" → 先 list_reminders 找到第3个的id，再 delete_reminder

重要规则：
- 创建提醒时，必须先询问用户想通过哪些渠道接收通知（桌面通知、邮件、Telegram、企业微信、Webhook等）。不要自行假设默认值。如果用户已经明确指定了渠道，则直接使用。
- 如果用户只是闲聊，不需要调用工具，直接回复即可。
回复时请用简洁友好的中文。`

const OPENAI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_reminder',
      description: '创建一个新的提醒',
      parameters: {
        type: 'object',
        required: ['title', 'remind_type', 'start_time', 'channels'],
        properties: {
          title: { type: 'string', description: '提醒标题' },
          description: { type: 'string', description: '提醒描述' },
          remind_type: { type: 'string', enum: ['interval', 'scheduled'], description: 'interval=循环提醒, scheduled=定时提醒' },
          start_time: { type: 'string', description: '开始时间，ISO 8601格式' },
          interval_value: { type: 'number', description: '周期间隔数值' },
          interval_unit: { type: 'string', enum: ['minutes', 'hours', 'days', 'months', 'years'], description: '周期单位' },
          weekdays: { type: 'array', items: { type: 'number' }, description: '星期几 0=周日~6=周六' },
          workday_only: { type: 'boolean', description: '仅工作日' },
          holiday_only: { type: 'boolean', description: '仅节假日' },
          icon: { type: 'string', description: 'emoji 图标' },
          active_hours_start: { type: 'string', description: '活跃时段开始 HH:mm' },
          active_hours_end: { type: 'string', description: '活跃时段结束 HH:mm' },
          channels: { type: 'array', items: { type: 'string' }, description: '通知渠道' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_reminders',
      description: '列出提醒',
      parameters: {
        type: 'object',
        properties: {
          is_active: { type: 'number', enum: [0, 1], description: '筛选状态' },
          search: { type: 'string', description: '搜索关键词' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_reminder',
      description: '删除提醒',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'number', description: '提醒ID' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'toggle_reminder',
      description: '启用或禁用提醒',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'number', description: '提醒ID' }
        }
      }
    }
  }
]

// Anthropic 工具格式（与 OpenAI 略有不同）
const ANTHROPIC_TOOLS = OPENAI_TOOLS.map(t => ({
  name: t.function.name,
  description: t.function.description,
  input_schema: t.function.parameters
}))

// ======================== 工具执行 ========================

function executeTool(name: string, args: Record<string, any>, scheduler: ReminderScheduler | null): any {
  switch (name) {
    case 'create_reminder': {
      const input: CreateReminderInput = {
        title: args.title,
        description: args.description,
        remind_type: args.remind_type,
        start_time: args.start_time,
        interval_value: args.interval_value,
        interval_unit: args.interval_unit,
        weekdays: args.weekdays,
        workday_only: args.workday_only ? 1 : 0,
        holiday_only: args.holiday_only ? 1 : 0,
        icon: args.icon,
        active_hours_start: args.active_hours_start,
        active_hours_end: args.active_hours_end,
        channels: args.channels || ['desktop']
      }
      const reminder = remindersDb.create(input)
      if (scheduler) scheduler.triggerNow()
      return reminder
    }
    case 'list_reminders': {
      const filters: any = {}
      if (args.is_active !== undefined) filters.is_active = args.is_active
      if (args.search) filters.search = args.search
      return remindersDb.list(filters)
    }
    case 'delete_reminder':
      return remindersDb.delete(args.id)
    case 'toggle_reminder':
      return remindersDb.toggleActive(args.id)
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

// ======================== OpenAI 兼容协议 ========================

interface OpenAIChoice {
  message: {
    role: string
    content: string | null
    tool_calls?: Array<{
      id: string
      type: 'function'
      function: { name: string; arguments: string }
    }>
  }
  finish_reason: string
}

async function chatOpenAI(
  config: ReturnType<typeof getLLMConfig>,
  allMessages: Array<Record<string, any>>,
  scheduler: ReminderScheduler | null
): Promise<{ reply: string; messages: Array<{ role: string; content: string }> }> {
  const url = `${config.baseUrl}/chat/completions`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`

  let lastReply = ''
  let iterations = 0
  const maxIterations = 5

  while (iterations < maxIterations) {
    iterations++

    const body: any = {
      model: config.model,
      messages: allMessages,
      tools: OPENAI_TOOLS,
      stream: false
    }

    const res = await axios.post<{ choices: OpenAIChoice[] }>(url, body, {
      headers,
      timeout: 120000
    })

    const choice = res.data.choices?.[0]
    if (!choice?.message) throw new Error('模型返回了空响应')

    const msg = choice.message

    allMessages.push({
      role: 'assistant',
      content: msg.content || '',
      tool_calls: msg.tool_calls
    })

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        const fnName = tc.function.name
        let fnArgs: Record<string, any>
        try {
          fnArgs = JSON.parse(tc.function.arguments)
        } catch {
          fnArgs = {}
        }
        console.log(`[LLM/OpenAI] 调用工具: ${fnName}`, JSON.stringify(fnArgs))

        let result: any
        try {
          result = executeTool(fnName, fnArgs, scheduler)
        } catch (e: any) {
          result = { error: e.message }
        }

        allMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result)
        })
      }
      continue
    }

    lastReply = msg.content || ''
    break
  }

  return buildResult(allMessages, lastReply)
}

// ======================== Anthropic 协议 ========================

async function chatAnthropic(
  config: ReturnType<typeof getLLMConfig>,
  allMessages: Array<Record<string, any>>,
  scheduler: ReminderScheduler | null
): Promise<{ reply: string; messages: Array<{ role: string; content: string }> }> {
  const url = `${config.baseUrl}/v1/messages`
  const systemContent = allMessages.find((m: any) => m.role === 'system')?.content || ''
  const chatMsgs = allMessages.filter((m: any) => m.role !== 'system')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01'
  }

  let lastReply = ''
  let iterations = 0
  const maxIterations = 5

  while (iterations < maxIterations) {
    iterations++

    // 构建消息（把 tool_result 转换为 user 消息中的 content block）
    const apiMessages: any[] = []
    for (const m of chatMsgs) {
      if (m.role === 'tool') continue // tool_result 已嵌入上一轮
      apiMessages.push(m)
    }

    const body: any = {
      model: config.model,
      max_tokens: 4096,
      system: systemContent,
      messages: apiMessages,
      tools: ANTHROPIC_TOOLS,
      stream: false
    }

    const res = await axios.post(url, body, { headers, timeout: 120000 })
    const data = res.data

    if (!data.content) throw new Error('模型返回了空响应')

    // 解析 content blocks
    let textReply = ''
    const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, any> }> = []

    for (const block of data.content) {
      if (block.type === 'text') {
        textReply += block.text
      } else if (block.type === 'tool_use') {
        toolUseBlocks.push({ id: block.id, name: block.name, input: block.input })
      }
    }

    // 添加 assistant 消息到历史
    chatMsgs.push({
      role: 'assistant',
      content: data.content
    })

    if (toolUseBlocks.length > 0) {
      // 构建 tool_result 消息
      const toolResults: any[] = []
      for (const tu of toolUseBlocks) {
        console.log(`[LLM/Anthropic] 调用工具: ${tu.name}`, JSON.stringify(tu.input))

        let result: any
        try {
          result = executeTool(tu.name, tu.input, scheduler)
        } catch (e: any) {
          result = { error: e.message }
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(result)
        })
      }

      // tool_result 必须作为 user 消息发送
      chatMsgs.push({
        role: 'user',
        content: toolResults
      })
      continue
    }

    lastReply = textReply
    break
  }

  // 将 Anthropic 的多轮消息简化为纯文本格式供前端显示
  const displayMessages: Array<{ role: string; content: string }> = []
  for (const m of chatMsgs) {
    if (typeof m.content === 'string' && m.content.trim()) {
      if (m.role === 'assistant' || m.role === 'user') {
        displayMessages.push({ role: m.role, content: m.content.trim() })
      }
    }
  }

  return { reply: lastReply, messages: displayMessages }
}

// ======================== 统一入口 ========================

function buildResult(
  allMessages: Array<Record<string, any>>,
  lastReply: string
): { reply: string; messages: Array<{ role: string; content: string }> } {
  const filtered = allMessages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.trim() }))
  return { reply: lastReply, messages: filtered }
}

export async function chatWithLLM(
  messages: Array<{ role: string; content: string }>,
  scheduler: ReminderScheduler | null,
  configId?: number
): Promise<{ reply: string; messages: Array<{ role: string; content: string }> }> {
  const config = getLLMConfig(configId)
  const systemMsg = SYSTEM_PROMPT.replace('{{current_time}}', new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }))

  const allMessages: Array<Record<string, any>> = [
    { role: 'system', content: systemMsg },
    ...messages
  ]

  if (config.provider.protocol === 'anthropic') {
    return chatAnthropic(config, allMessages, scheduler)
  }
  return chatOpenAI(config, allMessages, scheduler)
}
