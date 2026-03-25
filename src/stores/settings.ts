import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Record<string, string>>({})
  const theme = ref<'light' | 'dark' | 'system'>('system')
  const currentTheme = ref<'light' | 'dark'>('light')

  async function fetchSettings() {
    settings.value = await window.electronAPI.settings.getAll()
    theme.value = (settings.value.theme as any) || 'system'
    const systemTheme = await window.electronAPI.theme.get()
    applyTheme(theme.value === 'system' ? systemTheme : theme.value)
  }

  async function setSetting(key: string, value: string) {
    await window.electronAPI.settings.set(key, value)
    settings.value[key] = value

    if (key === 'theme') {
      theme.value = value as any
      if (value === 'system') {
        const systemTheme = await window.electronAPI.theme.get()
        applyTheme(systemTheme)
      } else {
        applyTheme(value as 'light' | 'dark')
      }
    }
  }

  function applyTheme(t: 'light' | 'dark') {
    currentTheme.value = t
    document.documentElement.setAttribute('data-theme', t)
    // 同时设置 Element Plus 暗色模式
    if (t === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  function initThemeListener() {
    window.electronAPI.theme.onChange((isDark) => {
      if (theme.value === 'system') {
        applyTheme(isDark ? 'dark' : 'light')
      }
    })
  }

  return {
    settings,
    theme,
    currentTheme,
    fetchSettings,
    setSetting,
    applyTheme,
    initThemeListener
  }
})
