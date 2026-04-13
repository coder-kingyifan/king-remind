import axios from 'axios'
import {skillsDb} from './db/skills'

// 默认技能商店 URL（GitHub 仓库 raw 文件地址）
const DEFAULT_STORE_URL = 'https://raw.githubusercontent.com/coder-kingyifan/king-remind-skill-store/main/skill-store.json'

export interface StoreSkill {
    skill_key: string
    name: string
    description: string
    icon: string
    category: string
    action_type: 'builtin' | 'api_call' | 'ai_prompt' | 'search_and_summarize'
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
export async function fetchStoreManifest(storeUrl?: string): Promise<StoreManifest> {
    const url = storeUrl || DEFAULT_STORE_URL
    try {
        const response = await axios.get<StoreManifest>(url, {
            timeout: 15000,
            headers: {'Accept': 'application/json'}
        })
        return response.data
    } catch (e: any) {
        if (e.response?.status === 404) {
            throw new Error('商店数据源未找到（404），请在系统设置中检查商店地址配置，或确保仓库中存在 skill-store.json 文件')
        }
        throw e
    }
}

/**
 * 获取带有安装状态的商店技能列表
 */
export function getStoreSkillsWithStatus(
    manifest: StoreManifest,
    storeUrl?: string
): StoreSkillWithStatus[] {
    const localSkills = skillsDb.list()
    const source = storeUrl || DEFAULT_STORE_URL

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
export function installStoreSkill(
    storeSkill: StoreSkill,
    storeUrl?: string
): any {
    const source = storeUrl || DEFAULT_STORE_URL
    const existing = skillsDb.getByKey(storeSkill.skill_key)

    if (existing) {
        // 更新已有技能，保留 user_config 和 is_enabled
        return skillsDb.update(existing.id, {
            name: storeSkill.name,
            description: storeSkill.description,
            icon: storeSkill.icon,
            category: storeSkill.category,
            action_config: storeSkill.action_config,
            config_schema: storeSkill.config_schema,
            store_version: storeSkill.version,
            store_source: source
        })
    }

    // 新建技能
    const isBuiltin = storeSkill.action_type === 'builtin' ? 1 : 0
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
        is_builtin: isBuiltin,
        store_version: storeSkill.version,
        store_source: source
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

export {DEFAULT_STORE_URL}
