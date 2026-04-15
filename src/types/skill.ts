export interface Skill {
    id: number
    skill_key: string
    name: string
    description: string
    icon: string
    category: string
    action_type: 'api_call' | 'ai_prompt' | 'search_and_summarize'
    action_config: string
    config_schema: string
    user_config: string
    is_enabled: number
    store_version: string | null
    store_source: string | null
    created_at: string
    updated_at: string
}

export interface SkillConfigField {
    key: string
    label: string
    type: 'string' | 'number' | 'select'
    default?: string | number
    options?: { label: string; value: string | number }[]
    required?: boolean
    placeholder?: string
}

export interface CreateSkillInput {
    name: string
    description?: string
    icon?: string
    category?: string
    action_type: 'api_call' | 'ai_prompt' | 'search_and_summarize'
    action_config: string
    config_schema?: string
    user_config?: string
}

export interface StoreSkill {
    skill_key: string
    name: string
    description: string
    icon: string
    category: string
    action_type: 'api_call' | 'ai_prompt' | 'search_and_summarize'
    action_config: string
    config_schema: string
    version: string
    author: string
    tags: string[]
}

export interface StoreSkillWithStatus extends StoreSkill {
    installed: boolean
    hasUpdate: boolean
    localVersion?: string
}

export const SKILL_CATEGORIES = [
    { key: 'weather', label: '天气环境', icon: '🌤️' },
    { key: 'daily', label: '每日内容', icon: '📰' },
    { key: 'health', label: '健康生活', icon: '🍎' },
    { key: 'finance', label: '财经理财', icon: '💰' },
    { key: 'study', label: '学习成长', icon: '📚' },
    { key: 'tools', label: '实用工具', icon: '🔧' },
    { key: 'custom', label: '自定义', icon: '⚡' }
] as const
