import {defineStore} from 'pinia'
import {ref} from 'vue'
import type {StoreSkillWithStatus} from '@/types/skill'

function getLocalDateTimeStr(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d}T${h}:${min}:${s}`
}

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
            lastFetchedAt.value = getLocalDateTimeStr()
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
