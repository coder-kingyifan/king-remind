import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'
import type { Reminder, CreateReminderInput, ReminderStats } from '@/types/reminder'

// Vue 3 Proxy 对象无法通过 contextBridge 的 structured clone
// 必须在调用 IPC 前转为纯 JS 对象
function plain<T>(obj: T): T {
  return JSON.parse(JSON.stringify(toRaw(obj)))
}

export const useRemindersStore = defineStore('reminders', () => {
  const reminders = ref<Reminder[]>([])
  const stats = ref<ReminderStats>({ total: 0, active: 0, triggeredToday: 0 })
  const loading = ref(false)

  async function fetchReminders(filters?: { is_active?: number; search?: string }) {
    loading.value = true
    try {
      reminders.value = await window.electronAPI.reminders.list(filters ? plain(filters) : undefined)
    } finally {
      loading.value = false
    }
  }

  async function fetchStats() {
    stats.value = await window.electronAPI.reminders.stats()
  }

  async function createReminder(data: CreateReminderInput) {
    const result = await window.electronAPI.reminders.create(plain(data))
    await fetchReminders()
    await fetchStats()
    return result
  }

  async function updateReminder(id: number, data: Partial<CreateReminderInput>) {
    const result = await window.electronAPI.reminders.update(id, plain(data))
    await fetchReminders()
    await fetchStats()
    return result
  }

  async function deleteReminder(id: number) {
    await window.electronAPI.reminders.delete(id)
    await fetchReminders()
    await fetchStats()
  }

  async function toggleReminder(id: number) {
    await window.electronAPI.reminders.toggle(id)
    await fetchReminders()
    await fetchStats()
  }

  return {
    reminders,
    stats,
    loading,
    fetchReminders,
    fetchStats,
    createReminder,
    updateReminder,
    deleteReminder,
    toggleReminder
  }
})
