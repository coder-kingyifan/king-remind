import axios from 'axios'
import {settingsDb} from './db/settings'
import {CreateReminderInput, remindersDb} from './db/reminders'
import {modelConfigsDb} from './db/model-configs'
import {notificationConfigsDb} from './db/notification-configs'
import {skillsDb} from './db/skills'
import {ReminderScheduler} from './scheduler'

// ======================== 服务商预设 ========================

export interface ProviderPreset {
    id: string
    name: string
    baseUrl: string
    apiKeyRequired: boolean
    defaultModel: string
    protocol: 'openai' | 'anthropic'
    models: string[]
}

export const PROVIDERS: ProviderPreset[] = [
    {
        id: 'ollama',
        name: 'Ollama（本地）',
        baseUrl: 'http://127.0.0.1:11434/v1',
        apiKeyRequired: false,
        defaultModel: 'qwen3:8b',
        protocol: 'openai',
        models: ['qwen3:8b', 'qwen3:14b', 'qwen3:32b', 'deepseek-r1:8b', 'deepseek-r1:14b', 'llama3.1:8b', 'gemma2:9b', 'mistral:7b', 'codellama:7b', 'phi3:mini']
    },
    {
        id: 'openai',
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        apiKeyRequired: true,
        defaultModel: 'gpt-4o-mini',
        protocol: 'openai',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-mini', 'o3-mini']
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        apiKeyRequired: true,
        defaultModel: 'deepseek-chat',
        protocol: 'openai',
        models: ['deepseek-chat', 'deepseek-reasoner']
    },
    {
        id: 'qwen',
        name: '阿里百炼（通义千问）',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKeyRequired: true,
        defaultModel: 'qwen-plus',
        protocol: 'openai',
        models: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-long', 'qwen-vl-plus', 'qwen-vl-max', 'qwen-coder-plus', 'qwq-plus']
    },
    {
        id: 'kimi',
        name: 'Kimi（月之暗面）',
        baseUrl: 'https://api.moonshot.cn/v1',
        apiKeyRequired: true,
        defaultModel: 'moonshot-v1-8k',
        protocol: 'openai',
        models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k']
    },
    {
        id: 'zhipu',
        name: '智谱 GLM',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        apiKeyRequired: true,
        defaultModel: 'glm-4-flash',
        protocol: 'openai',
        models: ['glm-4-flash', 'glm-4-air', 'glm-4-plus', 'glm-4-long', 'glm-4', 'glm-4v', 'glm-z1-flash']
    },
    {
        id: 'claude',
        name: 'Claude（Anthropic）',
        baseUrl: 'https://api.anthropic.com',
        apiKeyRequired: true,
        defaultModel: 'claude-sonnet-4-20250514',
        protocol: 'anthropic',
        models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250514', 'claude-opus-4-20250514']
    },
    {
        id: 'doubao',
        name: '字节豆包',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        apiKeyRequired: true,
        defaultModel: 'doubao-pro-32k',
        protocol: 'openai',
        models: ['doubao-pro-32k', 'doubao-pro-128k', 'doubao-lite-32k', 'doubao-lite-128k']
    },
    {
        id: 'hunyuan',
        name: '腾讯混元',
        baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
        apiKeyRequired: true,
        defaultModel: 'hunyuan-lite',
        protocol: 'openai',
        models: ['hunyuan-lite', 'hunyuan-standard', 'hunyuan-pro', 'hunyuan-turbo', 'hunyuan-turbos']
    },
    {
        id: 'ernie',
        name: '百度文心一言',
        baseUrl: 'https://qianfan.baidubce.com/v2',
        apiKeyRequired: true,
        defaultModel: 'ernie-4.0-8k',
        protocol: 'openai',
        models: ['ernie-4.0-8k', 'ernie-4.0-turbo-8k', 'ernie-3.5-8k', 'ernie-speed-8k', 'ernie-speed-128k', 'ernie-lite-8k']
    },
    {
        id: 'spark',
        name: '讯飞星火',
        baseUrl: 'https://spark-api-open.xf-yun.com/v1',
        apiKeyRequired: true,
        defaultModel: 'generalv3.5',
        protocol: 'openai',
        models: ['4.0Ultra', 'generalv3.5', 'generalv3', 'generalv2']
    },
    {
        id: 'yi',
        name: '零一万物（Yi）',
        baseUrl: 'https://api.lingyiwanwu.com/v1',
        apiKeyRequired: true,
        defaultModel: 'yi-lightning',
        protocol: 'openai',
        models: ['yi-lightning', 'yi-large', 'yi-medium', 'yi-spark', 'yi-vision']
    },
    {
        id: 'siliconflow',
        name: 'SiliconFlow（硅基流动）',
        baseUrl: 'https://api.siliconflow.cn/v1',
        apiKeyRequired: true,
        defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
        protocol: 'openai',
        models: ['Qwen/Qwen2.5-7B-Instruct', 'Qwen/Qwen2.5-72B-Instruct', 'deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Pro/deepseek-ai/DeepSeek-V3', 'THUDM/glm-4-9b-chat']
    },
    {
        id: 'groq',
        name: 'Groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKeyRequired: true,
        defaultModel: 'llama-3.3-70b-versatile',
        protocol: 'openai',
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it']
    },
    {
        id: 'xiaomi',
        name: '小米',
        baseUrl: 'https://apim-njimx.xiaomi.com/v1',
        apiKeyRequired: true,
        defaultModel: 'MiMo-7B-RL',
        protocol: 'openai',
        models: ['MiMo-7B-RL']
    },
    {
        id: 'custom',
        name: '自定义（OpenAI 兼容）',
        baseUrl: '',
        apiKeyRequired: true,
        defaultModel: '',
        protocol: 'openai',
        models: []
    },
    {
        id: 'custom_anthropic',
        name: '自定义（Anthropic 兼容）',
        baseUrl: '',
        apiKeyRequired: true,
        defaultModel: '',
        protocol: 'anthropic',
        models: []
    },
    // ========== 联网搜索模型 ==========
    {
        id: 'perplexity',
        name: 'Perplexity',
        baseUrl: 'https://api.perplexity.ai',
        apiKeyRequired: true,
        defaultModel: 'sonar',
        protocol: 'openai',
        models: ['sonar', 'sonar-pro', 'sonar-reasoning', 'sonar-reasoning-pro', 'sonar-deep-research']
    },
    {
        id: 'tavily',
        name: 'Tavily',
        baseUrl: 'https://api.tavily.com',
        apiKeyRequired: true,
        defaultModel: 'tavily-search',
        protocol: 'openai',
        models: ['tavily-search', 'tavily-extract']
    },
    {
        id: 'jina',
        name: 'Jina（搜索/阅读）',
        baseUrl: 'https://s.jina.ai',
        apiKeyRequired: true,
        defaultModel: 'jina-search',
        protocol: 'openai',
        models: ['jina-search', 'jina-reader', 'grounding']
    },
    {
        id: 'bochaai',
        name: '博查 AI（搜索）',
        baseUrl: 'https://api.bochaai.com/v1',
        apiKeyRequired: true,
        defaultModel: 'bocha-web-search',
        protocol: 'openai',
        models: ['bocha-web-search', 'bocha-ai-search']
    },
    {
        id: 'exa',
        name: 'Exa（智能搜索）',
        baseUrl: 'https://api.exa.ai',
        apiKeyRequired: true,
        defaultModel: 'exa-search',
        protocol: 'openai',
        models: ['exa-search', 'exa-contents']
    }
]

export function getProviderById(id: string): ProviderPreset {
    return PROVIDERS.find(p => p.id === id) || PROVIDERS[0]
}

// ======================== 配置读取 ========================

function getLLMConfig(configId?: number, modelOverride?: string) {
    const saved = configId ? modelConfigsDb.get(configId) : modelConfigsDb.getDefault()
    if (saved) {
        const provider = getProviderById(saved.provider)
        return {
            provider,
            baseUrl: saved.base_url || provider.baseUrl,
            apiKey: saved.api_key || '',
            model: modelOverride || saved.model || provider.defaultModel,
            modelType: saved.model_type || 'text'
        }
    }
    const providerId = settingsDb.get('llm_provider') || 'ollama'
    const provider = getProviderById(providerId)
    return {
        provider,
        baseUrl: settingsDb.get('llm_base_url') || provider.baseUrl,
        apiKey: settingsDb.get('llm_api_key') || '',
        model: modelOverride || settingsDb.get('llm_model') || provider.defaultModel,
        modelType: 'text' as string
    }
}

// ======================== 工具定义 ========================

const SYSTEM_PROMPT_TEMPLATE = `你是 King 提醒助手的 AI 助手。你可以帮助用户通过自然语言创建提醒。

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
   - lunar_date (可选): 农历日期，格式 "MM-DD"，如 "09-03" 表示农历九月初三
   - icon (可选): emoji 图标
   - active_hours_start (可选): 活跃时段开始 HH:mm
   - active_hours_end (可选): 活跃时段结束 HH:mm
   - channels (必填): 通知渠道数组

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

5. list_skills - 列出可用的技能
   参数: 无

6. execute_skill - 执行一个技能获取结果
   参数:
   - skill_id (必填): 技能ID

请根据用户的自然语言描述，智能提取参数并调用合适的工具。
示例:
- 用户说"每30分钟提醒我喝水" → 调用 create_reminder，remind_type="interval"，interval_value=30，interval_unit="minutes"
- 用户说"明天下午3点开会" → 调用 create_reminder，remind_type="scheduled"，start_time=计算出的时间
- 用户说"每天早上8点给我推送天气" → 先 list_skills 找到天气技能，再 create_reminder 并设置 skill_id
- 用户说"工作日每天早上9点站会" → 调用 create_reminder，remind_type="interval"，interval_unit="days"，workday_only=true，start_time 包含09:00
- 用户说"查看我的提醒" → 调用 list_reminders
- 用户说"删除第3个提醒" → 先 list_reminders 找到第3个的id，再 delete_reminder

重要规则：
- 创建提醒时，channels 只能使用以下已启用的渠道 ID: {{enabled_channels}}。不要推荐未列出的渠道。
- 回复用户时，用中文称呼渠道名称（如 channels 里的 "desktop" 要说成"桌面通知"，"email" 要说成"邮件"，"telegram" 要说成"Telegram"，"wechat_work" 要说成"企业微信"，"wechat_work_webhook" 要说成"企微群机器人"，"webhook" 要说成"Webhook"），不要在回复中出现英文渠道 ID。
- 如果用户提到农历日期（如"九月初三""腊月二十""初一"等），必须设置 lunar_date 参数（格式 "MM-DD"，如 "09-03"），同时设置 remind_type="interval"、interval_unit="years"、interval_value=1，start_time 设为今年或明年该农历日期对应的公历日期。系统会自动在每年按农历日期转换公历来触发提醒。
- 如果用户发送了图片，请识别图片内容，根据图片内容帮助用户创建提醒或回答问题。看到图片后如果用户意图是创建提醒，必须调用 create_reminder 工具，不能只描述图片内容。
- 如果用户只是闲聊，不需要调用工具，直接回复即可。
回复时请用简洁友好的中文。`

const CHANNEL_NAMES: Record<string, string> = {
    desktop: 'desktop(桌面通知)',
    email: 'email(邮件)',
    telegram: 'telegram',
    wechat_work: 'wechat_work(企业微信)',
    wechat_work_webhook: 'wechat_work_webhook(企业微信群机器人)',
    webhook: 'webhook'
}

function buildSystemPrompt(): string {
    const configs = notificationConfigsDb.getAll()
    const enabledChannels: string[] = []
    for (const c of configs) {
        if (c.is_enabled === 1) {
            const name = CHANNEL_NAMES[c.channel] || c.channel
            enabledChannels.push(`"${name}"`)
        }
    }
    if (enabledChannels.length === 0) {
        enabledChannels.push('"desktop"(桌面通知，默认)')
    }
    return SYSTEM_PROMPT_TEMPLATE
        .replace('{{current_time}}', new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'}))
        .replace('{{enabled_channels}}', enabledChannels.join(' / '))
}

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
                    title: {type: 'string', description: '提醒标题'},
                    description: {type: 'string', description: '提醒描述'},
                    remind_type: {
                        type: 'string',
                        enum: ['interval', 'scheduled'],
                        description: 'interval=循环提醒, scheduled=定时提醒'
                    },
                    start_time: {type: 'string', description: '开始时间，ISO 8601格式'},
                    interval_value: {type: 'number', description: '周期间隔数值'},
                    interval_unit: {
                        type: 'string',
                        enum: ['minutes', 'hours', 'days', 'months', 'years'],
                        description: '周期单位'
                    },
                    weekdays: {type: 'array', items: {type: 'number'}, description: '星期几 0=周日~6=周六'},
                    workday_only: {type: 'boolean', description: '仅工作日'},
                    holiday_only: {type: 'boolean', description: '仅节假日'},
                    icon: {type: 'string', description: 'emoji 图标'},
                    active_hours_start: {type: 'string', description: '活跃时段开始 HH:mm'},
                    active_hours_end: {type: 'string', description: '活跃时段结束 HH:mm'},
                    lunar_date: {type: 'string', description: '农历日期，格式 "MM-DD"，如 "09-03" 表示农历九月初三'},
                    channels: {type: 'array', items: {type: 'string'}, description: '通知渠道'},
                    skill_id: {type: 'number', description: '绑定的技能ID，可选。绑定后每次触发时会先执行技能获取动态内容'}
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
                    is_active: {type: 'number', enum: [0, 1], description: '筛选状态'},
                    search: {type: 'string', description: '搜索关键词'}
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
                    id: {type: 'number', description: '提醒ID'}
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
                    id: {type: 'number', description: '提醒ID'}
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_skills',
            description: '列出所有可用的技能',
            parameters: {
                type: 'object',
                properties: {}
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'execute_skill',
            description: '执行一个技能并获取结果内容',
            parameters: {
                type: 'object',
                required: ['skill_id'],
                properties: {
                    skill_id: {type: 'number', description: '要执行的技能ID'}
                }
            }
        }
    }
]

const ANTHROPIC_TOOLS = OPENAI_TOOLS.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters
}))

// ======================== 工具执行 ========================

async function executeTool(name: string, args: Record<string, any>, scheduler: ReminderScheduler | null): Promise<any> {
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
                lunar_date: args.lunar_date || null,
                icon: args.icon,
                active_hours_start: args.active_hours_start,
                active_hours_end: args.active_hours_end,
                channels: args.channels || ['desktop'],
                skill_id: args.skill_id || null
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
        case 'list_skills':
            return skillsDb.getEnabled().map(s => ({
                id: s.id, skill_key: s.skill_key, name: s.name, description: s.description,
                icon: s.icon, category: s.category
            }))
        case 'execute_skill': {
            const {executeSkill} = await import('./skills/executor')
            return executeSkill(args.skill_id)
        }
        default:
            throw new Error(`Unknown tool: ${name}`)
    }
}

function getToolDisplayName(name: string): string {
    switch (name) {
        case 'create_reminder':
            return '创建提醒'
        case 'list_reminders':
            return '查询提醒列表'
        case 'delete_reminder':
            return '删除提醒'
        case 'toggle_reminder':
            return '切换提醒状态'
        case 'list_skills':
            return '查询技能列表'
        case 'execute_skill':
            return '执行技能'
        default:
            return name
    }
}

// ======================== 多模态支持 ========================

const VISION_MODEL_PATTERNS = [
    'gpt-4o', 'gpt-4-turbo', 'gpt-4-vision',
    'claude-3', 'claude-4', 'claude-sonnet', 'claude-opus', 'claude-haiku',
    'qwen-vl', 'qwq',
    'glm-4v',
    'gemini',
    'yi-vision',
    'llava', 'bakllava', 'moondream', 'minicpm'
]

function isVisionModel(model: string): boolean {
    const m = model.toLowerCase()
    return VISION_MODEL_PATTERNS.some(p => m.includes(p))
}

function stripImagesFromMessages(messages: Array<Record<string, any>>): Array<Record<string, any>> {
    return messages.map(m => {
        if (m.role === 'user' && Array.isArray(m.content)) {
            const hasImages = m.content.some((b: any) => b.type === 'image_url' || b.type === 'image')
            if (hasImages) {
                const textParts = m.content.filter((b: any) => b.type === 'text')
                return {
                    ...m,
                    content: textParts.length > 0
                        ? textParts.map((b: any) => b.text).join('\n')
                        : '[用户发送了图片，但当前模型不支持图片识别]'
                }
            }
        }
        return m
    })
}

// ======================== 流式事件 ========================

export type StreamEvent =
    | { type: 'status'; text: string }
    | { type: 'chunk'; text: string }
    | { type: 'thinking'; text: string }
    | { type: 'tool_start'; name: string; args: Record<string, any> }
    | { type: 'tool_result'; name: string; result: any }
    | { type: 'done'; reply: string }
    | { type: 'error'; message: string }

// ======================== SSE 解析 ========================

function parseSSEChunk(raw: string, buffer: string): {
    events: Array<{ event?: string; data: string }>
    newBuffer: string
} {
    buffer += raw.replace(/\r\n/g, '\n')
    const events: Array<{ event?: string; data: string }> = []

    while (true) {
        const idx = buffer.indexOf('\n\n')
        if (idx === -1) break
        const block = buffer.substring(0, idx)
        buffer = buffer.substring(idx + 2)

        let event: string | undefined
        let data = ''
        for (const line of block.split('\n')) {
            const t = line.trim()
            if (t.startsWith('event:')) event = t.substring(6).trim()
            else if (t.startsWith('data:')) data += t.substring(5).trim()
        }
        if (data) events.push({event, data})
    }

    return {events, newBuffer: buffer}
}

// ======================== 结果构建 ========================

function extractTextContent(content: any): string {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
        return content
            .filter((b: any) => b.type === 'text' && b.text)
            .map((b: any) => b.text)
            .join('\n')
    }
    return ''
}

function buildResult(
    allMessages: Array<Record<string, any>>,
    lastReply: string
): { reply: string; messages: Array<{ role: string; content: string }> } {
    const filtered = allMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({role: m.role, content: extractTextContent(m.content).trim()}))
        .filter(m => m.content)
    return {reply: lastReply, messages: filtered}
}

// ======================== OpenAI 流式协议 ========================

async function chatOpenAIStream(
    config: ReturnType<typeof getLLMConfig>,
    allMessages: Array<Record<string, any>>,
    scheduler: ReminderScheduler | null,
    onEvent: (event: StreamEvent) => void
): Promise<{ reply: string; messages: Array<{ role: string; content: string }> }> {
    const url = `${config.baseUrl}/chat/completions`
    const headers: Record<string, string> = {'Content-Type': 'application/json'}
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`

    // Detect strict VL models (e.g., qwen-vl) that don't support system role and require array content
    const modelLower = config.model.toLowerCase()
    const isStrictVL = modelLower.includes('qwen-vl') || modelLower.includes('qwenvl')
    let vlStrictDetected = false

    if (isStrictVL || vlStrictDetected) {
        // Merge system message into first user message
        const systemIdx = allMessages.findIndex((m: any) => m.role === 'system')
        if (systemIdx >= 0) {
            const sysMsg = allMessages.splice(systemIdx, 1)[0]
            const sysText = typeof sysMsg.content === 'string'
                ? sysMsg.content
                : Array.isArray(sysMsg.content)
                    ? sysMsg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
                    : ''
            const firstUser = allMessages.find((m: any) => m.role === 'user')
            if (firstUser && sysText) {
                const existingText = typeof firstUser.content === 'string'
                    ? firstUser.content
                    : Array.isArray(firstUser.content)
                        ? firstUser.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
                        : ''
                firstUser.content = [{type: 'text', text: sysText + '\n\n' + existingText}]
            }
        }
    }

    let lastReply = ''
    let iterations = 0
    const maxIterations = 5
    const executedToolNames: string[] = []

    while (iterations < maxIterations) {
        iterations++
        onEvent({type: 'status', text: iterations > 1 ? '继续处理中...' : '正在思考...'})

        // Build request messages: convert for strict VL models
        const requestMessages = allMessages.map((m: any) => {
            if ((isStrictVL || vlStrictDetected) && m.role !== 'tool') {
                let role = m.role
                let content = m.content
                // Convert assistant to user for strict VL models
                if (role === 'assistant') {
                    role = 'user'
                    const text = typeof content === 'string' ? content
                        : Array.isArray(content) ? content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
                        : ''
                    content = text ? [{type: 'text', text: `[AI]: ${text}`}] : []
                } else if (typeof content === 'string') {
                    content = content ? [{type: 'text', text: content}] : []
                }
                return {...m, role, content}
            }
            return m
        })

        const isReasoningModel = config.model.includes('o1') || config.model.includes('o3') || config.model.includes('reasoner') || config.model.toLowerCase().includes('r1')

        const body: any = {
            model: config.model,
            messages: requestMessages,
            stream: true
        }

        if (!isReasoningModel) {
            body.tools = OPENAI_TOOLS
            body.max_tokens = 4096
        }

        let res: any
        try {
            res = await axios.post(url, body, {headers, timeout: 120000, responseType: 'stream'})
        } catch (e: any) {
            let errorMsg = e.message || '请求失败'
            if (e.response?.data) {
                try {
                    const errData = e.response.data
                    if (typeof errData.on === 'function') {
                        let errBody = ''
                        for await (const chunk of errData) {
                            errBody += chunk.toString()
                        }
                        const parsed = JSON.parse(errBody)
                        errorMsg = parsed.error?.message || parsed.message || errorMsg
                    } else if (typeof errData === 'object') {
                        errorMsg = errData.error?.message || errData.message || errorMsg
                    }
                } catch {
                }
            }
            throw new Error(errorMsg)
        }

        let buffer = ''
        let content = ''
        const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>()
        const stream: any = res.data

        try {
            for await (const chunk of stream) {
                const text = chunk.toString()
                const {events, newBuffer} = parseSSEChunk(text, buffer)
                buffer = newBuffer

                for (const evt of events) {
                    if (evt.data === '[DONE]') continue
                    try {
                        const parsed = JSON.parse(evt.data)

                        // Handle error responses from provider
                        if (parsed.error) {
                            const errMsg = parsed.error.message || parsed.error.msg || JSON.stringify(parsed.error)
                            console.error('[LLM/OpenAI Stream] API error in stream:', errMsg)
                            // Auto-detect strict VL format requirements and retry
                            if (!isStrictVL && !vlStrictDetected && isVisionModel(config.model) &&
                                (errMsg.includes("should be 'user'") || errMsg.includes('valid list') || errMsg.includes('role'))) {
                                vlStrictDetected = true
                                console.log('[LLM/OpenAI Stream] Detected strict VL format, retrying...')
                                break
                            }
                            throw new Error(errMsg)
                        }

                        // Handle non-standard response formats
                        const delta = parsed.choices?.[0]?.delta || parsed.output?.choices?.[0]?.delta
                        if (!delta) continue

                        if (delta.content) {
                            content += delta.content
                            onEvent({type: 'chunk', text: delta.content})
                        }

                        if (delta.tool_calls) {
                            for (const tc of delta.tool_calls) {
                                const idx = tc.index ?? 0
                                if (!toolCallsMap.has(idx)) {
                                    toolCallsMap.set(idx, {id: tc.id || '', name: '', arguments: ''})
                                }
                                const existing = toolCallsMap.get(idx)!
                                if (tc.id) existing.id = tc.id
                                if (tc.function?.name) existing.name = tc.function.name
                                if (tc.function?.arguments) existing.arguments += tc.function.arguments
                            }
                        }
                    } catch {
                    }
                }
            }
        } catch (e) {
            stream.destroy?.()
            throw e
        }

        // If strict VL format was detected during streaming, retry this iteration
        if (vlStrictDetected && !content && toolCallsMap.size === 0) {
            iterations--  // Don't count the failed iteration
            continue
        }

        // Non-streaming fallback: API returned plain JSON
        if (!content && toolCallsMap.size === 0 && buffer.trim()) {
            try {
                const parsed = JSON.parse(buffer)
                const choice = parsed.choices?.[0]?.message
                if (choice) {
                    content = choice.content || ''
                    if (choice.tool_calls) {
                        for (const tc of choice.tool_calls) {
                            toolCallsMap.set(tc.index ?? 0, {
                                id: tc.id, name: tc.function.name, arguments: tc.function.arguments
                            })
                        }
                    }
                    if (content) onEvent({type: 'chunk', text: content})
                }
            } catch {
            }
        }

        // Build assistant message
        const assistantMsg: any = {role: 'assistant', content: content || ''}
        if (toolCallsMap.size > 0) {
            assistantMsg.tool_calls = Array.from(toolCallsMap.values()).map(tc => ({
                id: tc.id, type: 'function' as const, function: {name: tc.name, arguments: tc.arguments}
            }))
        }
        allMessages.push(assistantMsg)

        if (toolCallsMap.size > 0) {
            for (const tc of toolCallsMap.values()) {
                let fnArgs: Record<string, any> = {}
                try {
                    fnArgs = JSON.parse(tc.arguments)
                } catch {
                }

                console.log(`[LLM/OpenAI Stream] 调用工具: ${tc.name}`, JSON.stringify(fnArgs))
                executedToolNames.push(getToolDisplayName(tc.name))
                onEvent({type: 'status', text: `正在${getToolDisplayName(tc.name)}...`})
                onEvent({type: 'tool_start', name: tc.name, args: fnArgs})

                let result: any
                try {
                    result = await executeTool(tc.name, fnArgs, scheduler)
                } catch (e: any) {
                    result = {error: e.message}
                }

                onEvent({type: 'tool_result', name: tc.name, result})
                allMessages.push({role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result)})
            }
            continue
        }

        lastReply = content
        break
    }

    // Fallback: if tools were executed but no final text, summarize what was done
    if (!lastReply && executedToolNames.length > 0) {
        lastReply = `${executedToolNames.join('、')}完成`
    }

    return buildResult(allMessages, lastReply)
}

// ======================== Anthropic 流式协议 ========================

async function chatAnthropicStream(
    config: ReturnType<typeof getLLMConfig>,
    allMessages: Array<Record<string, any>>,
    scheduler: ReminderScheduler | null,
    onEvent: (event: StreamEvent) => void
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
    const executedToolNames: string[] = []

    while (iterations < maxIterations) {
        iterations++
        onEvent({type: 'status', text: iterations > 1 ? '继续处理中...' : '正在思考...'})

        // Convert messages for Anthropic API
        const apiMessages: any[] = []
        for (const m of chatMsgs) {
            if (m.role === 'tool') continue
            if (m.role === 'user' && Array.isArray(m.content)) {
                const converted = m.content.map((block: any) => {
                    if (block.type === 'image_url' && block.image_url?.url) {
                        const matches = block.image_url.url.match(/^data:(image\/[^;]+);base64,(.+)$/)
                        return {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: matches?.[1] || 'image/png',
                                data: matches?.[2] || ''
                            }
                        }
                    }
                    return block
                })
                apiMessages.push({role: m.role, content: converted})
            } else {
                apiMessages.push(m)
            }
        }

        const body: any = {
            model: config.model,
            max_tokens: 4096,
            system: systemContent,
            messages: apiMessages,
            tools: ANTHROPIC_TOOLS,
            stream: true
        }

        // Enable extended thinking for Claude sonnet/opus models
        if (config.model.includes('claude') && (config.model.includes('sonnet') || config.model.includes('opus') || config.model.includes('3.5'))) {
            body.thinking = {type: 'enabled', budget_tokens: 4096}
            body.max_tokens = 16000
        }

        let res: any
        try {
            res = await axios.post(url, body, {headers, timeout: 120000, responseType: 'stream'})
        } catch (e: any) {
            let errorMsg = e.message || '请求失败'
            if (e.response?.data) {
                try {
                    const errData = e.response.data
                    if (typeof errData.on === 'function') {
                        let errBody = ''
                        for await (const chunk of errData) {
                            errBody += chunk.toString()
                        }
                        const parsed = JSON.parse(errBody)
                        errorMsg = parsed.error?.message || parsed.message || errorMsg
                    } else if (typeof errData === 'object') {
                        errorMsg = errData.error?.message || errData.message || errorMsg
                    }
                } catch {
                }
            }
            throw new Error(errorMsg)
        }

        let buffer = ''
        let textReply = ''
        let thinkingText = ''
        const toolUseBlocks: Array<{ id: string; name: string; inputJson: string }> = []
        const stream: any = res.data

        try {
            for await (const chunk of stream) {
                const text = chunk.toString()
                const {events, newBuffer} = parseSSEChunk(text, buffer)
                buffer = newBuffer

                for (const evt of events) {
                    try {
                        const parsed = JSON.parse(evt.data)

                        if (parsed.type === 'content_block_start') {
                            if (parsed.content_block?.type === 'tool_use') {
                                toolUseBlocks.push({
                                    id: parsed.content_block.id,
                                    name: parsed.content_block.name,
                                    inputJson: ''
                                })
                            }
                        } else if (parsed.type === 'content_block_delta') {
                            const delta = parsed.delta
                            if (delta?.type === 'text_delta' && delta.text) {
                                textReply += delta.text
                                onEvent({type: 'chunk', text: delta.text})
                            } else if (delta?.type === 'thinking_delta' && delta.thinking) {
                                thinkingText += delta.thinking
                                onEvent({type: 'thinking', text: delta.thinking})
                            } else if (delta?.type === 'input_json_delta' && delta.partial_json) {
                                const lastTool = toolUseBlocks[toolUseBlocks.length - 1]
                                if (lastTool) lastTool.inputJson += delta.partial_json
                            }
                        }
                    } catch {
                    }
                }
            }
        } catch (e) {
            stream.destroy?.()
            throw e
        }

        // Non-streaming fallback
        if (!textReply && toolUseBlocks.length === 0 && buffer.trim()) {
            try {
                const parsed = JSON.parse(buffer)
                if (parsed.content) {
                    for (const block of parsed.content) {
                        if (block.type === 'text') {
                            textReply += block.text
                            onEvent({type: 'chunk', text: block.text})
                        } else if (block.type === 'thinking') {
                            thinkingText += block.thinking || ''
                            onEvent({type: 'thinking', text: block.thinking || ''})
                        } else if (block.type === 'tool_use') {
                            toolUseBlocks.push({
                                id: block.id,
                                name: block.name,
                                inputJson: JSON.stringify(block.input || {})
                            })
                        }
                    }
                }
            } catch {
            }
        }

        // Build assistant message
        chatMsgs.push({
            role: 'assistant',
            content: textReply || thinkingText || ''
        })

        if (toolUseBlocks.length > 0) {
            const toolResults: any[] = []
            for (const tu of toolUseBlocks) {
                let toolInput: Record<string, any> = {}
                try {
                    toolInput = JSON.parse(tu.inputJson)
                } catch {
                }

                console.log(`[LLM/Anthropic Stream] 调用工具: ${tu.name}`, JSON.stringify(toolInput))
                executedToolNames.push(getToolDisplayName(tu.name))
                onEvent({type: 'status', text: `正在${getToolDisplayName(tu.name)}...`})
                onEvent({type: 'tool_start', name: tu.name, args: toolInput})

                let result: any
                try {
                    result = await executeTool(tu.name, toolInput, scheduler)
                } catch (e: any) {
                    result = {error: e.message}
                }

                onEvent({type: 'tool_result', name: tu.name, result})
                toolResults.push({type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result)})
            }
            chatMsgs.push({role: 'user', content: toolResults})
            continue
        }

        lastReply = textReply
        break
    }

    // Fallback: if tools were executed but no final text, summarize what was done
    if (!lastReply && executedToolNames.length > 0) {
        lastReply = `${executedToolNames.join('、')}完成`
    }

    const displayMessages: Array<{ role: string; content: string }> = []
    for (const m of chatMsgs) {
        if (typeof m.content === 'string' && m.content.trim()) {
            if (m.role === 'assistant' || m.role === 'user') {
                displayMessages.push({role: m.role, content: m.content.trim()})
            }
        }
    }

    return {reply: lastReply, messages: displayMessages}
}

// ======================== 统一入口 ========================

export async function chatWithLLM(
    messages: Array<{ role: string; content: any }>,
    scheduler: ReminderScheduler | null,
    configId?: number,
    modelOverride?: string,
    onEvent?: (event: StreamEvent) => void
): Promise<{ reply: string; messages: Array<{ role: string; content: string }> }> {
    const config = getLLMConfig(configId, modelOverride)
    const systemMsg = buildSystemPrompt()

    let allMessages: Array<Record<string, any>> = [
        {role: 'system', content: systemMsg},
        ...messages
    ]

    // Strip images if model doesn't support vision
    const supportsVision = isVisionModel(config.model) || config.modelType === 'multimodal'
    if (!supportsVision) {
        allMessages = stripImagesFromMessages(allMessages)
    }

    const eventHandler = onEvent || (() => {
    })

    try {
        if (config.provider.protocol === 'anthropic') {
            return await chatAnthropicStream(config, allMessages, scheduler, eventHandler)
        }
        return await chatOpenAIStream(config, allMessages, scheduler, eventHandler)
    } catch (e: any) {
        const errorMsg = e.message || '请求失败'
        eventHandler({type: 'error', message: errorMsg})
        return {reply: `请求失败: ${errorMsg}`, messages: []}
    }
}

// ======================== 会话标题生成 ========================

export async function generateSessionTitle(
    configId: number,
    firstUserMsg: string,
    firstAiReply: string
): Promise<string> {
    const config = getLLMConfig(configId)
    const prompt = `根据以下对话内容，生成一个简短的标题（不超过15个字，不要标点符号和引号，只输出标题本身）：\n\n用户：${firstUserMsg.substring(0, 200)}\n助手：${firstAiReply.substring(0, 200)}`

    try {
        if (config.provider.protocol === 'anthropic') {
            const url = `${config.baseUrl}/v1/messages`
            const res = await axios.post(url, {
                model: config.model,
                max_tokens: 50,
                messages: [{role: 'user', content: prompt}]
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': config.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                timeout: 30000
            })
            const text = res.data?.content?.find((b: any) => b.type === 'text')?.text || ''
            return text.trim().replace(/["""'"]/g, '').substring(0, 20) || firstUserMsg.substring(0, 20)
        } else {
            const url = `${config.baseUrl}/chat/completions`
            const headers: Record<string, string> = {'Content-Type': 'application/json'}
            if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`
            const res = await axios.post(url, {
                model: config.model,
                max_tokens: 50,
                messages: [{role: 'user', content: prompt}],
                stream: false
            }, {headers, timeout: 30000})
            const text = (res.data?.choices?.[0]?.message?.content || '').trim().replace(/["""'"]/g, '').substring(0, 20)
            return text || firstUserMsg.substring(0, 20)
        }
    } catch {
        return firstUserMsg.substring(0, 20) + (firstUserMsg.length > 20 ? '...' : '')
    }
}

// ======================== 模型连接测试 ========================

export async function testModelConnection(data: {
    provider: string
    base_url: string
    api_key: string
    model: string
}): Promise<{ ok: boolean; message: string; reply?: string }> {
    try {
        const provider = getProviderById(data.provider)
        const baseUrl = data.base_url || provider.baseUrl
        if (!baseUrl) {
            return {ok: false, message: '请填写 API 地址'}
        }
        if (!data.model) {
            return {ok: false, message: '请填写至少一个模型名称'}
        }

        if (provider.protocol === 'anthropic') {
            const url = `${baseUrl}/v1/messages`
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'x-api-key': data.api_key,
                'anthropic-version': '2023-06-01'
            }
            const body = {
                model: data.model,
                max_tokens: 32,
                messages: [{role: 'user', content: '你好，请回复"测试成功"'}]
            }
            const res = await axios.post(url, body, {headers, timeout: 30000})
            const text = res.data?.content?.find((b: any) => b.type === 'text')?.text || ''
            return {ok: true, message: '连接成功', reply: text}
        } else {
            const url = `${baseUrl}/chat/completions`
            const headers: Record<string, string> = {'Content-Type': 'application/json'}
            if (data.api_key) headers['Authorization'] = `Bearer ${data.api_key}`
            const body = {
                model: data.model,
                messages: [{role: 'user', content: '你好，请回复"测试成功"'}],
                max_tokens: 32,
                stream: false
            }
            const res = await axios.post(url, body, {headers, timeout: 30000})
            const reply = res.data?.choices?.[0]?.message?.content || ''
            return {ok: true, message: '连接成功', reply}
        }
    } catch (e: any) {
        const msg = e.response?.data?.error?.message || e.response?.data?.message || e.message || '连接失败'
        return {ok: false, message: msg}
    }
}
