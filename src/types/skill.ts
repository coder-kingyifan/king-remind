export interface Skill {
    id: number
    skill_key: string
    name: string
    description: string
    icon: string
    category: string
    action_type: 'builtin' | 'api_call' | 'ai_prompt'
    action_config: string
    config_schema: string
    user_config: string
    is_builtin: number
    is_enabled: number
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
    action_type: 'api_call' | 'ai_prompt'
    action_config: string
    config_schema?: string
    user_config?: string
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

// 内置技能定义（静态数据，不需要从数据库加载）
export const BUILTIN_SKILLS: {
    skill_key: string
    name: string
    description: string
    icon: string
    category: string
    action_type: 'builtin'
    action_config: string
    config_schema: string
}[] = [
    {
        skill_key: 'weather',
        name: '天气查询',
        description: '查询指定城市的实时天气信息，包括温度、湿度、风速和天气状况',
        icon: '🌤️',
        category: 'weather',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: '[{"key":"city","label":"城市","type":"string","default":"北京","required":true,"placeholder":"请输入城市名称"},{"key":"unit","label":"温度单位","type":"select","default":"celsius","options":[{"label":"摄氏度","value":"celsius"},{"label":"华氏度","value":"fahrenheit"}]}]'
    },
    {
        skill_key: 'daily_quote',
        name: '每日一言',
        description: '每天随机展示一条励志名言或优美句子，给你满满的正能量',
        icon: '💬',
        category: 'daily',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: '[{"key":"type","label":"内容类型","type":"select","default":"mixed","options":[{"label":"混合","value":"mixed"},{"label":"励志","value":"motivational"},{"label":"哲理","value":"philosophy"},{"label":"唯美","value":"aesthetic"}]}]'
    },
    {
        skill_key: 'countdown',
        name: '倒计日',
        description: '计算距离重要日期还有多少天，如生日、考试、假期等',
        icon: '⏳',
        category: 'tools',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: '[{"key":"target_date","label":"目标日期","type":"string","required":true,"placeholder":"如：2025-12-31"},{"key":"event_name","label":"事件名称","type":"string","required":true,"placeholder":"如：新年"}]'
    },
    {
        skill_key: 'water_reminder',
        name: '喝水提醒',
        description: '智能提醒你喝水，包含当前时间和喝水建议',
        icon: '💧',
        category: 'health',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: '[{"key":"cup_ml","label":"杯容量(ml)","type":"number","default":250}]'
    },
    {
        skill_key: 'poetry',
        name: '每日诗词',
        description: '每天欣赏一首优美的古诗词，品味传统文化之美',
        icon: '📜',
        category: 'study',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: '[]'
    },
    {
        skill_key: 'health_tip',
        name: '健康小贴士',
        description: '根据季节和时间段提供实用的健康养生建议',
        icon: '🍎',
        category: 'health',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: '[]'
    },
    {
        skill_key: 'exercise',
        name: '运动建议',
        description: '根据天气和时间段推荐适合的运动方式',
        icon: '🏃',
        category: 'health',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: '[]'
    },
    {
        skill_key: 'english',
        name: '每日英语',
        description: '每天学习一个实用英语表达，附中文翻译和例句',
        icon: '📚',
        category: 'study',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: '[]'
    },
    {
        skill_key: 'joke',
        name: '每日笑话',
        description: '每天一个轻松幽默的笑话，让你开心一整天',
        icon: '😄',
        category: 'daily',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: '[]'
    },
    {
        skill_key: 'horoscope',
        name: '星座运势',
        description: '查看今日十二星座运势，包含综合、爱情、事业运势',
        icon: '⭐',
        category: 'daily',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: '[{"key":"sign","label":"星座","type":"select","default":"aries","options":[{"label":"白羊座","value":"aries"},{"label":"金牛座","value":"taurus"},{"label":"双子座","value":"gemini"},{"label":"巨蟹座","value":"cancer"},{"label":"狮子座","value":"leo"},{"label":"处女座","value":"virgo"},{"label":"天秤座","value":"libra"},{"label":"天蝎座","value":"scorpio"},{"label":"射手座","value":"sagittarius"},{"label":"摩羯座","value":"capricorn"},{"label":"水瓶座","value":"aquarius"},{"label":"双鱼座","value":"pisces"}]}]'
    },
    {
        skill_key: 'lunar_info',
        name: '农历信息',
        description: '显示今日农历日期、节气、宜忌等传统信息',
        icon: '🌙',
        category: 'daily',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: '[]'
    },
    {
        skill_key: 'work_report',
        name: '工作小结',
        description: '定时提醒你总结工作进度，梳理待办事项',
        icon: '📝',
        category: 'tools',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: '[]'
    }
]
