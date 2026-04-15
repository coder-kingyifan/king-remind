import axios from 'axios'
import {skillsDb} from './db/skills'

// 技能商店 URL（GitHub 仓库 raw 文件地址）
const STORE_URL = 'https://raw.githubusercontent.com/coder-kingyifan/king-remind-skill-store/main/skill-store.json'

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

export interface StoreManifest {
    version: number
    updated_at: string
    skills: StoreSkill[]
}

export interface StoreSkillWithStatus extends StoreSkill {
    installed: boolean
    hasUpdate: boolean
    localVersion?: string
}

/**
 * 从 GitHub 获取商店清单
 */
export async function fetchStoreManifest(): Promise<StoreManifest> {
    try {
        const response = await axios.get<StoreManifest>(STORE_URL, {
            timeout: 15000,
            headers: {'Accept': 'application/json'}
        })
        return response.data
    } catch (e: any) {
        if (e.response?.status === 404) {
            throw new Error('商店数据源未找到（404），请确保仓库中存在 skill-store.json 文件')
        }
        throw e
    }
}

/**
 * 获取带有安装状态的商店技能列表
 */
export function getStoreSkillsWithStatus(manifest: StoreManifest): StoreSkillWithStatus[] {
    const localSkills = skillsDb.list()

    return manifest.skills.map(storeSkill => {
        const localMatch = localSkills.find(s => s.skill_key === storeSkill.skill_key)
        const installed = !!localMatch
        const hasUpdate = installed && !!localMatch!.store_version && localMatch!.store_version !== storeSkill.version
        return {
            ...storeSkill,
            installed,
            hasUpdate,
            localVersion: localMatch?.store_version || undefined
        }
    })
}

/**
 * 从商店安装技能（如果已存在则更新）
 */
export function installStoreSkill(storeSkill: StoreSkill): any {
    const existing = skillsDb.getByKey(storeSkill.skill_key)

    if (existing) {
        // 更新已有技能，保留 user_config 和 is_enabled
        return skillsDb.update(existing.id, {
            name: storeSkill.name,
            description: storeSkill.description,
            icon: storeSkill.icon,
            category: storeSkill.category,
            action_type: storeSkill.action_type,
            action_config: storeSkill.action_config,
            config_schema: storeSkill.config_schema,
            store_version: storeSkill.version,
            store_source: STORE_URL
        })
    }

    // 新建技能
    return skillsDb.createFromStore({
        skill_key: storeSkill.skill_key,
        name: storeSkill.name,
        description: storeSkill.description,
        icon: storeSkill.icon,
        category: storeSkill.category,
        action_type: storeSkill.action_type,
        action_config: storeSkill.action_config,
        config_schema: storeSkill.config_schema,
        user_config: '{}',
        store_version: storeSkill.version,
        store_source: STORE_URL
    })
}

/**
 * 卸载商店安装的技能
 */
export function uninstallStoreSkill(skillKey: string): boolean {
    const existing = skillsDb.getByKey(skillKey)
    if (!existing) return false
    skillsDb.delete(existing.id)
    return true
}

// ======================== 默认内置技能 ========================

const DEFAULT_SKILLS: Array<{
    skill_key: string
    name: string
    description: string
    icon: string
    category: string
    action_type: 'ai_prompt' | 'api_call'
    action_config: string
    config_schema: string
}> = [
    {
        skill_key: 'weather',
        name: '天气',
        description: '获取当前城市的天气信息，包含温度、湿度、风力等',
        icon: '🌤️',
        category: 'weather',
        action_type: 'ai_prompt',
        action_config: JSON.stringify({
            prompt_template: '请告诉我今天{{city}}的天气情况，包括温度、湿度、天气状况和风力。如果无法获取实时数据，请根据当前季节和城市给出合理的天气参考。当前日期：{{date}}',
            enable_ai_summary: false
        }),
        config_schema: JSON.stringify([
            {key: 'city', label: '城市', type: 'string', default: '北京', placeholder: '如：北京、上海、广州'}
        ])
    },
    {
        skill_key: 'daily_quote',
        name: '每日一言',
        description: '每天推送一句励志名言或经典语录',
        icon: '💬',
        category: 'daily',
        action_type: 'ai_prompt',
        action_config: JSON.stringify({
            prompt_template: '请给我一句今日励志名言，要求：1）来自中外知名人物；2）简短有力，不超过30字；3）附上作者名。格式：名言 —— 作者。每天尽量不同。',
            enable_ai_summary: false
        }),
        config_schema: '[]'
    },
    {
        skill_key: 'daily_poem',
        name: '每日诗词',
        description: '每天推荐一首经典古诗词',
        icon: '📜',
        category: 'daily',
        action_type: 'ai_prompt',
        action_config: JSON.stringify({
            prompt_template: '请推荐一首经典古诗词，要求：1）先给出诗名和作者；2）再给出完整诗文；3）最后用一句话赏析。每天尽量推荐不同的诗词。当前日期：{{date}}',
            enable_ai_summary: false
        }),
        config_schema: '[]'
    },
    {
        skill_key: 'daily_english',
        name: '每日英语',
        description: '每天学习一句实用英语表达',
        icon: '🔤',
        category: 'study',
        action_type: 'ai_prompt',
        action_config: JSON.stringify({
            prompt_template: '请教我一句实用英语表达，要求：1）给出英文原句；2）给出中文翻译；3）标注关键词汇和用法；4）给出一个简短的例句。主题可以涵盖日常对话、职场、旅行等，每天尽量不同。',
            enable_ai_summary: false
        }),
        config_schema: '[]'
    },
    {
        skill_key: 'exercise_tip',
        name: '运动建议',
        description: '根据时间给出今日运动建议',
        icon: '🏃',
        category: 'health',
        action_type: 'ai_prompt',
        action_config: JSON.stringify({
            prompt_template: '请根据当前时间给出今日运动建议，包括：1）推荐的运动类型和时长；2）运动注意事项；3）热身建议。考虑当前时间段是否适合运动。当前时间：{{date}} {{time}}',
            enable_ai_summary: false
        }),
        config_schema: '[]'
    },
    {
        skill_key: 'daily_joke',
        name: '每日笑话',
        description: '每天一个轻松幽默的笑话',
        icon: '😄',
        category: 'daily',
        action_type: 'ai_prompt',
        action_config: JSON.stringify({
            prompt_template: '请讲一个轻松幽默的笑话，要求：1）简短有趣，不超过100字；2）内容健康积极；3）风格多样，可以是冷笑话、谐音梗、生活趣事等。每天尽量不同。',
            enable_ai_summary: false
        }),
        config_schema: '[]'
    },
    {
        skill_key: 'horoscope',
        name: '星座运势',
        description: '查看今日星座运势',
        icon: '⭐',
        category: 'daily',
        action_type: 'ai_prompt',
        action_config: JSON.stringify({
            prompt_template: '请给出{{constellation}}今日运势，包括：1）综合运势（1-5星）；2）爱情运势；3）事业运势；4）幸运数字和颜色。内容仅供娱乐参考。当前日期：{{date}}',
            enable_ai_summary: false
        }),
        config_schema: JSON.stringify([
            {key: 'constellation', label: '星座', type: 'select', default: '白羊座', options: [
                {label: '白羊座', value: '白羊座'}, {label: '金牛座', value: '金牛座'}, {label: '双子座', value: '双子座'},
                {label: '巨蟹座', value: '巨蟹座'}, {label: '狮子座', value: '狮子座'}, {label: '处女座', value: '处女座'},
                {label: '天秤座', value: '天秤座'}, {label: '天蝎座', value: '天蝎座'}, {label: '射手座', value: '射手座'},
                {label: '摩羯座', value: '摩羯座'}, {label: '水瓶座', value: '水瓶座'}, {label: '双鱼座', value: '双鱼座'}
            ]}
        ])
    },
    {
        skill_key: 'tech_news',
        name: '科技资讯',
        description: '获取今日科技行业热点资讯',
        icon: '💻',
        category: 'daily',
        action_type: 'ai_prompt',
        action_config: JSON.stringify({
            prompt_template: '请总结今日科技行业的重要新闻和热点，包括AI、互联网、硬件等领域，给出3-5条简要资讯。当前日期：{{date}}',
            enable_ai_summary: false
        }),
        config_schema: '[]'
    },
    {
        skill_key: 'daily_news',
        name: '每日新闻',
        description: '获取今日重要新闻摘要',
        icon: '📰',
        category: 'daily',
        action_type: 'ai_prompt',
        action_config: JSON.stringify({
            prompt_template: '请总结今日国内外重要新闻，涵盖政治、经济、社会等领域，给出3-5条简要新闻摘要。当前日期：{{date}}',
            enable_ai_summary: false
        }),
        config_schema: '[]'
    },
    {
        skill_key: 'diet_tip',
        name: '饮食建议',
        description: '根据时间段给出健康饮食建议',
        icon: '🥗',
        category: 'health',
        action_type: 'ai_prompt',
        action_config: JSON.stringify({
            prompt_template: '请根据当前时间段给出饮食建议，包括：1）推荐的食物和饮品；2）应避免的食物；3）简单的健康食谱推荐。当前时间：{{date}} {{time}}',
            enable_ai_summary: false
        }),
        config_schema: '[]'
    },
    {
        skill_key: 'water_reminder',
        name: '喝水提醒',
        description: '提醒喝水并给出每日饮水建议',
        icon: '💧',
        category: 'health',
        action_type: 'ai_prompt',
        action_config: JSON.stringify({
            prompt_template: '请提醒我喝水！给出一条简短的喝水提醒，包含：1）温馨提醒语；2）当前时间段的建议饮水量；3）一个小贴士（如水温、饮水速度等）。每次提醒尽量不同。当前时间：{{time}}',
            enable_ai_summary: false
        }),
        config_schema: '[]'
    },
    {
        skill_key: 'stock_price',
        name: '股票查股价',
        description: '查询指定股票的最新价格信息',
        icon: '📈',
        category: 'finance',
        action_type: 'ai_prompt',
        action_config: JSON.stringify({
            prompt_template: '请查询{{stock_name}}的最新股价信息，包括：1）当前价格；2）涨跌幅；3）今日最高最低价。如果无法获取实时数据，请说明并建议查看实时行情软件。当前日期：{{date}}',
            enable_ai_summary: false
        }),
        config_schema: JSON.stringify([
            {key: 'stock_name', label: '股票名称/代码', type: 'string', default: '上证指数', placeholder: '如：上证指数、贵州茅台、000001'}
        ])
    }
]

/**
 * 安装默认内置技能（仅在技能表为空时执行）
 */
export function installDefaultSkills(): void {
    const existing = skillsDb.list()
    if (existing.length > 0) return

    for (const skill of DEFAULT_SKILLS) {
        skillsDb.createFromStore({
            skill_key: skill.skill_key,
            name: skill.name,
            description: skill.description,
            icon: skill.icon,
            category: skill.category,
            action_type: skill.action_type,
            action_config: skill.action_config,
            config_schema: skill.config_schema,
            user_config: '{}',
            store_version: '1.0.0',
            store_source: 'builtin'
        })
    }
    console.log(`[技能] 已安装 ${DEFAULT_SKILLS.length} 个默认技能`)
}
