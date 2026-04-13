import {defineStore} from 'pinia'
import {ref} from 'vue'
import type {StoreSkillWithStatus} from '@/types/skill'

export const useSkillStoreStore = defineStore('skill-store', () => {
    const storeSkills = ref<StoreSkillWithStatus[]>([])
    const fetching = ref(false)
    const fetchError = ref<string | null>(null)
    const lastFetchedAt = ref<string | null>(null)

    async function fetchStoreData() {
        fetching.value = true
        fetchError.value = null
        try {
            const result = await window.electronAPI.skillStore.fetch()
            storeSkills.value = result
            lastFetchedAt.value = new Date().toISOString()
        } catch (e: any) {
            fetchError.value = e.message || '获取技能商店数据失败'
        } finally {
            fetching.value = false
        }
    }

    async function installSkill(skillKey: string) {
        await window.electronAPI.skillStore.install(skillKey)
        await fetchStoreData()
    }

    async function updateSkill(skillKey: string) {
        await window.electronAPI.skillStore.install(skillKey)
        await fetchStoreData()
    }

    async function uninstallSkill(skillKey: string) {
        await window.electronAPI.skillStore.uninstall(skillKey)
        await fetchStoreData()
    }

    return {
        storeSkills,
        fetching,
        fetchError,
        lastFetchedAt,
        fetchStoreData,
        installSkill,
        updateSkill,
        uninstallSkill
    }
})
