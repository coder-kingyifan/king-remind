import axios from 'axios'
import {skillsDb} from '../db/skills'
import {modelConfigsDb} from '../db/model-configs'
import {callSearchAPI, hasTextModelConfigured, simpleLLMCall} from '../llm'

function getLocalDateStr(date: Date = new Date()): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

// ======================== AI Mode Helper ========================

const STRUCTURED_FORMAT_INSTRUCTION = `\n\n请严格按照以下 JSON 格式返回，不要返回其他内容：\n{"title": "简短标题（不超过20字）", "content": "正文内容"}\n如果无法严格 JSON，请确保输出包含明确的标题和正文。`

/** 获取文本模型配置 ID，避免调用联网搜索模型导致 404 */
function getTextModelConfigId(): number | undefined {
    const allConfigs = modelConfigsDb.list()
    const textConfig = allConfigs.find(c => c.model_type === 'text' && c.is_default === 1)
        || allConfigs.find(c => c.model_type === 'text')
        || allConfigs.find(c => c.is_default === 1 && c.model_type !== 'web_search')
        || allConfigs.find(c => c.model_type !== 'web_search')
    return textConfig ? textConfig.id : undefined
}

async function generateWithAI(prompt: string): Promise<string | null> {
    if (!hasTextModelConfigured()) {
        return '尚未配置文本模型，请先前往「模型配置」页面添加并配置一个文本模型。'
    }
    try {
        const result = await simpleLLMCall(getTextModelConfigId(), prompt)
        return result || null
    } catch {
        return null
    }
}

// ======================== Skill Executors ========================

async function executeApiCall(actionConfig: Record<string, any>, userConfig: Record<string, any>): Promise<string> {
    const url = actionConfig.url
    if (!url) return 'API 地址未配置'

    try {
        const method = (actionConfig.method || 'GET').toLowerCase()
        const headers = typeof actionConfig.headers === 'string' ? JSON.parse(actionConfig.headers) : (actionConfig.headers || {})

        let finalUrl = url
        for (const [key, value] of Object.entries(userConfig)) {
            finalUrl = finalUrl.replace(`{{${key}}}`, String(value))
        }

        const res = await axios({ method, url: finalUrl, headers, timeout: 10000 })
        const data = res.data

        let apiResult: string
        if (actionConfig.response_template) {
            let template = actionConfig.response_template
            if (typeof data === 'object') {
                const flatten = (obj: any, prefix = ''): Record<string, string> => {
                    const result: Record<string, string> = {}
                    for (const [k, v] of Object.entries(obj)) {
                        const key = prefix ? `${prefix}.${k}` : k
                        if (typeof v === 'object' && v !== null) {
                            Object.assign(result, flatten(v, key))
                        } else {
                            result[key] = String(v)
                        }
                    }
                    return result
                }
                const flat = flatten(data)
                for (const [k, v] of Object.entries(flat)) {
                    template = template.replace(`{{${k}}}`, v)
                }
            }
            apiResult = template
        } else {
            const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
            apiResult = text.length > 500 ? text.substring(0, 500) + '...' : text
        }

        if (actionConfig.enable_ai_summary) {
            const summaryPrompt = actionConfig.summary_prompt || '请根据以下 API 返回的数据，提取关键信息并用简洁的中文总结'
            const fullPrompt = `${summaryPrompt}${STRUCTURED_FORMAT_INSTRUCTION}\n\n---\nAPI 返回数据：\n${apiResult}`
            try {
                const result = await simpleLLMCall(getTextModelConfigId(), fullPrompt)
                if (result) return result
            } catch (e: any) {
                console.error('[技能执行器] API AI 总结失败:', e.message)
            }
        }

        return apiResult
    } catch (e: any) {
        return `API 调用失败: ${e.message}`
    }
}

async function executeAiPrompt(actionConfig: Record<string, any>, userConfig: Record<string, any>): Promise<string> {
    const promptTemplate = actionConfig.prompt_template || actionConfig.prompt || ''
    if (!promptTemplate) return 'AI 提示词未配置'

    if (!hasTextModelConfigured()) {
        return '尚未配置文本模型，请先前往「模型配置」页面添加并配置一个文本模型。'
    }

    let prompt = promptTemplate
    for (const [key, value] of Object.entries(userConfig)) {
        prompt = prompt.replace(`{{${key}}}`, String(value))
    }
    const now = new Date()
    prompt = prompt.replace('{{date}}', getLocalDateStr(now))
    prompt = prompt.replace('{{time}}', now.toLocaleTimeString('zh-CN'))

    try {
        const result = await simpleLLMCall(getTextModelConfigId(), prompt)
        return result || 'AI 未返回结果'
    } catch (e: any) {
        return `AI 生成失败: ${e.message}`
    }
}

async function executeSearchAndSummarize(actionConfig: Record<string, any>, userConfig: Record<string, any>): Promise<string> {
    const searchQuery = actionConfig.search_query || ''
    if (!searchQuery) return '搜索问题未配置'

    if (!hasTextModelConfigured()) {
        return '尚未配置文本模型，请先前往「模型配置」页面添加并配置一个文本模型。'
    }

    // 解析搜索模型：优先使用 action_config 中指定的，否则自动选择第一个 web_search 模型
    let searchModelId: number | undefined = actionConfig.search_model_id
    if (!searchModelId || !modelConfigsDb.get(searchModelId)) {
        const webSearchConfig = modelConfigsDb.list().find(c => c.model_type === 'web_search')
        if (!webSearchConfig) {
            return '您还没有配置联网搜索模型，请先前往「模型配置」页面添加'
        }
        searchModelId = webSearchConfig.id
    }

    // 替换 userConfig 变量
    let query = searchQuery
    for (const [key, value] of Object.entries(userConfig)) {
        query = query.replace(`{{${key}}}`, String(value))
    }
    const now = new Date()
    query = query.replace('{{date}}', getLocalDateStr(now))
    query = query.replace('{{time}}', now.toLocaleTimeString('zh-CN'))

    const searchConfig = modelConfigsDb.get(searchModelId)!

    console.log(`[技能执行器] 联网搜索: "${query}"，使用模型: ${searchConfig.name}`)
    let searchResult: string
    try {
        searchResult = await callSearchAPI(searchModelId, query)
        if (!searchResult) return '联网搜索未返回结果'
    } catch (e: any) {
        return `联网搜索失败: ${e.message}`
    }

    let summaryPrompt = actionConfig.summary_prompt || '请根据以下搜索结果，用简洁的中文进行总结，提炼关键信息'
    for (const [key, value] of Object.entries(userConfig)) {
        summaryPrompt = summaryPrompt.replace(`{{${key}}}`, String(value))
    }
    const fullPrompt = `${summaryPrompt}${STRUCTURED_FORMAT_INSTRUCTION}\n\n---\n搜索结果：\n${searchResult}`

    console.log('[技能执行器] AI 总结中...')
    try {
        const result = await simpleLLMCall(getTextModelConfigId(), fullPrompt)
        return result || searchResult
    } catch (e: any) {
        console.error('[技能执行器] AI 总结失败，返回原始搜索结果:', e.message)
        return searchResult
    }
}

// ======================== Main Execution Entry ========================

export async function executeSkill(skillId: number, options?: { skipEnabledCheck?: boolean }): Promise<string> {
    const skill = skillsDb.get(skillId)
    if (!skill) return ''
    if (!skill.is_enabled && !options?.skipEnabledCheck) return ''

    let userConfig: Record<string, any> = {}
    try {
        userConfig = JSON.parse(skill.user_config || '{}')
    } catch { /* ignore */ }

    try {
        let actionConfig: Record<string, any> = {}
        try {
            actionConfig = JSON.parse(skill.action_config || '{}')
        } catch { /* ignore */ }

        if (skill.action_type === 'api_call') {
            return await executeApiCall(actionConfig, userConfig)
        } else if (skill.action_type === 'ai_prompt') {
            return await executeAiPrompt(actionConfig, userConfig)
        } else if (skill.action_type === 'search_and_summarize') {
            return await executeSearchAndSummarize(actionConfig, userConfig)
        }

        return `未知技能类型: ${skill.action_type}`
    } catch (e: any) {
        console.error(`[技能执行器] 技能"${skill.name}"执行失败:`, e.message)
        return `技能"${skill.name}"执行失败: ${e.message}`
    }
}

export async function executeSkillByKey(skillKey: string): Promise<string> {
    const skill = skillsDb.getByKey(skillKey)
    if (!skill) return ''
    return executeSkill(skill.id)
}
