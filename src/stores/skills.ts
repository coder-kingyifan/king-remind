import {defineStore} from 'pinia'
import {computed, ref, toRaw} from 'vue'
import {BUILTIN_SKILLS} from '@/types/skill'
import type {Skill} from '@/types/skill'

function plain<T>(obj: T): T {
    return JSON.parse(JSON.stringify(toRaw(obj)))
}

// 内置技能从静态常量初始化（瞬间可用，无需 IPC）
function initBuiltinSkills(): Skill[] {
    return BUILTIN_SKILLS.map(s => ({
        ...s,
        id: 0,
        is_builtin: 1,
        is_enabled: 0,
        user_config: '{}',
        created_at: '',
        updated_at: ''
    }))
}

export const useSkillsStore = defineStore('skills', () => {
    const builtinSkills = ref<Skill[]>(initBuiltinSkills())
    const customSkills = ref<Skill[]>([])
    const loading = ref(false)
    const loaded = ref(false)

    const skills = computed(() => [...builtinSkills.value, ...customSkills.value])

    async function fetchSkills(filters?: { category?: string; is_enabled?: number; search?: string }) {
        if (loaded.value && !filters) return
        if (loading.value) return
        loading.value = true
        try {
            const dbSkills = await window.electronAPI.skills.list(filters ? plain(filters) : undefined)

            // 用数据库状态更新内置技能
            const dbBuiltinMap = new Map(
                dbSkills.filter(s => s.is_builtin).map(s => [s.skill_key, s])
            )
            builtinSkills.value = BUILTIN_SKILLS.map(s => {
                const db = dbBuiltinMap.get(s.skill_key)
                return {
                    ...s,
                    id: db?.id ?? 0,
                    is_builtin: 1,
                    is_enabled: db?.is_enabled ?? 0,
                    user_config: db?.user_config ?? '{}',
                    created_at: db?.created_at ?? '',
                    updated_at: db?.updated_at ?? ''
                }
            })

            customSkills.value = dbSkills.filter(s => !s.is_builtin)
            loaded.value = true
        } finally {
            loading.value = false
        }
    }

    async function createSkill(data: {
        name: string
        description?: string
        icon?: string
        category?: string
        action_type: string
        action_config: string
        config_schema?: string
        user_config?: string
    }) {
        const result = await window.electronAPI.skills.create(plain(data))
        await refreshSkills()
        return result
    }

    async function updateSkill(id: number, data: {
        name?: string
        description?: string
        icon?: string
        category?: string
        action_config?: string
        config_schema?: string
        user_config?: string
        is_enabled?: number
    }) {
        const result = await window.electronAPI.skills.update(id, plain(data))
        await refreshSkills()
        return result
    }

    async function deleteSkill(id: number) {
        await window.electronAPI.skills.delete(id)
        await refreshSkills()
    }

    async function toggleSkill(id: number) {
        await window.electronAPI.skills.toggle(id)
        await refreshSkills()
    }

    async function executeSkill(id: number): Promise<string> {
        return await window.electronAPI.skills.execute(id)
    }

    async function updateConfig(id: number, userConfig: string) {
        const result = await window.electronAPI.skills.updateConfig(id, userConfig)
        await refreshSkills()
        return result
    }

    async function refreshSkills() {
        loaded.value = false
        loading.value = false
        await fetchSkills()
    }

    return {
        skills,
        loading,
        loaded,
        fetchSkills,
        createSkill,
        updateSkill,
        deleteSkill,
        toggleSkill,
        executeSkill,
        updateConfig,
        refreshSkills
    }
})
