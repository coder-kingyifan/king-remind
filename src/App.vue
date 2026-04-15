<template>
  <div class="app-root">
    <!-- 首次启动向导 -->
    <SetupWizard v-if="showSetup" @finish="onSetupFinish" />

    <!-- 主界面 -->
    <template v-else>
      <AppLayout>
        <router-view v-slot="{ Component }">
          <keep-alive>
            <component :is="Component"/>
          </keep-alive>
        </router-view>
      </AppLayout>

      <!-- 应用内通知弹窗 -->
      <transition name="notification-slide">
        <div v-if="showNotification" class="in-app-notification" @click="dismissNotification">
          <div class="notif-icon">🔔</div>
          <div class="notif-content">
            <div class="notif-title">{{ notificationData.title }}</div>
            <div class="notif-body">{{ notificationData.body }}</div>
          </div>
          <div class="notif-close" @click.stop="dismissNotification">×</div>
        </div>
      </transition>
    </template>
  </div>
</template>

<script setup lang="ts">
import {onMounted, ref} from 'vue'
import {useRouter} from 'vue-router'
import {useSettingsStore} from '@/stores/settings'
import {useSkillsStore} from '@/stores/skills'
import AppLayout from '@/components/layout/AppLayout.vue'
import SetupWizard from '@/components/setup/SetupWizard.vue'
import {setCachedAppMode} from '@/router'

const router = useRouter()
const settingsStore = useSettingsStore()
const skillsStore = useSkillsStore()
const showNotification = ref(false)
const notificationData = ref({title: '', body: ''})
let notifTimer: any = null

const showSetup = ref(false)

onMounted(async () => {
  await settingsStore.fetchSettings()
  settingsStore.initThemeListener()

  // 缓存 app_mode 供路由守卫使用
  const appMode = settingsStore.settings.app_mode || 'ai'
  setCachedAppMode(appMode)

  const setupDone = settingsStore.settings.setup_done
  if (setupDone !== 'true') {
    showSetup.value = true
    return
  }

  // 根据模式跳转到正确的首页
  if (appMode === 'simple' && router.currentRoute.value.path === '/') {
    router.replace('/dashboard')
  }

  initApp()
})

async function onSetupFinish(data: {
  nickname: string;
  dbPassword: string;
  appMode: string;
}) {
  if (data.nickname) {
    await settingsStore.setSetting('user_nickname', data.nickname)
  }

  // Database encryption - takes effect immediately in current process
  if (data.dbPassword) {
    await window.electronAPI.db.setEncryption(data.dbPassword)
    await settingsStore.setSetting('db_encrypted', 'true')
  }

  // Save app mode
  await settingsStore.setSetting('app_mode', data.appMode)
  setCachedAppMode(data.appMode)

  // Mark setup done - no restart needed, everything works in current process
  await settingsStore.setSetting('setup_done', 'true')

  showSetup.value = false

  // 根据模式跳转到正确的首页
  if (data.appMode === 'simple') {
    await router.replace('/dashboard')
  }

  initApp()
}

function initApp() {
  skillsStore.fetchSkills()

  window.electronAPI.notifications.onShow((data) => {
    notificationData.value = data
    showNotification.value = true
    if (notifTimer) clearTimeout(notifTimer)
    notifTimer = setTimeout(() => {
      showNotification.value = false
    }, 5000)
  })
}

function dismissNotification() {
  showNotification.value = false
  if (notifTimer) clearTimeout(notifTimer)
}
</script>

<style scoped>
.app-root {
  width: 100%;
  height: 100%;
  position: relative;
}

.in-app-notification {
  position: fixed;
  top: 50px;
  right: 16px;
  width: 320px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  box-shadow: var(--shadow-lg);
  z-index: 9999;
  cursor: pointer;
  transition: all 0.3s ease;
}

.in-app-notification:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
}

.notif-icon { font-size: 24px; flex-shrink: 0; }
.notif-content { flex: 1; min-width: 0; }
.notif-title { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.notif-body { font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.notif-close {
  font-size: 18px; color: var(--text-tertiary); cursor: pointer; flex-shrink: 0;
  width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border-radius: 50%;
}
.notif-close:hover { background: var(--bg-hover); color: var(--text-primary); }

.notification-slide-enter-active { transition: all 0.3s ease-out; }
.notification-slide-leave-active { transition: all 0.3s ease-in; }
.notification-slide-enter-from { opacity: 0; transform: translateX(100%); }
.notification-slide-leave-to { opacity: 0; transform: translateX(100%); }
</style>
