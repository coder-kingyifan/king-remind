import {net} from 'electron'
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
 * 从 GitHub 获取商店清单（加随机参数绕过 CDN 缓存）
 */
export async function fetchStoreManifest(): Promise<StoreManifest> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)

    try {
        const url = `${STORE_URL}?_t=${Date.now()}`
        const response = await net.fetch(url, {
            signal: controller.signal,
            headers: {'Accept': 'application/json'}
        })
        if (response.status === 404) {
            throw new Error('商店数据源未找到（404），请确保仓库中存在 skill-store.json 文件')
        }
        if (!response.ok) {
            throw new Error(`GitHub 返回状态码 ${response.status}`)
        }
        return await response.json() as StoreManifest
    } catch (e: any) {
        if (e.message?.includes('商店数据源未找到')) {
            throw e
        }
        if (e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED' || e.code === 'ECONNRESET' || e.code === 'ETIMEDOUT' || e.code === 'ERR_NETWORK') {
            throw new Error('无法访问 GitHub，请检查网络连接或网络代理设置')
        }
        throw new Error('无法访问 GitHub，请检查网络连接或网络代理设置')
    } finally {
        clearTimeout(timer)
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
