import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'
import type { NotificationConfig } from '@/types/notification'

function plain<T>(obj: T): T {
  return JSON.parse(JSON.stringify(toRaw(obj)))
}

export const useNotificationsStore = defineStore('notifications', () => {
  const configs = ref<NotificationConfig[]>([])
  const loading = ref(false)

  async function fetchConfigs() {
    loading.value = true
    try {
      configs.value = await window.electronAPI.notifications.getConfigs()
    } finally {
      loading.value = false
    }
  }

  async function updateConfig(channel: string, data: { is_enabled?: number; config_json?: string }) {
    await window.electronAPI.notifications.updateConfig(channel, plain(data))
    await fetchConfigs()
  }

  async function testChannel(channel: string): Promise<{ success: boolean; error?: string }> {
    return await window.electronAPI.notifications.test(channel)
  }

  function getConfig(channel: string): NotificationConfig | undefined {
    return configs.value.find(c => c.channel === channel)
  }

  function isEnabled(channel: string): boolean {
    const config = getConfig(channel)
    return config ? config.is_enabled === 1 : false
  }

  return {
    configs,
    loading,
    fetchConfigs,
    updateConfig,
    testChannel,
    getConfig,
    isEnabled
  }
})
