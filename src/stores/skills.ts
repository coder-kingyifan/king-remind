import {defineStore} from 'pinia'
import {ref, toRaw} from 'vue'
import type {Skill} from '@/types/skill'

function plain<T>(obj: T): T {
    return JSON.parse(JSON.stringify(toRaw(obj)))
}

export const useSkillsStore = defineStore('skills', () => {
    const skills = ref<Skill[]>([])
    const loading = ref(false)
    const loaded = ref(false)

    async function fetchSkills() {
        if (loaded.value) return
        if (loading.value) return
        loading.value = true
        try {
            skills.value = await window.electronAPI.skills.list()
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

    async function executeSkill(id: number, options?: { skipEnabledCheck?: boolean }): Promise<string> {
        return await window.electronAPI.skills.execute(id, options)
    }

    async function updateConfig(id: number, userConfig: string) {
        const result = await window.electronAPI.skills.updateConfig(id, userConfig)
        await refreshSkills()
        return result
    }

    async function refreshSkills() {
        loaded.value = false
        loading.value = false
        skills.value = await window.electronAPI.skills.list()
        loaded.value = true
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
