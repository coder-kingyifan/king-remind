<template>
  <div class="app-root">
    <!-- 首次启动向导 -->
    <SetupWizard v-if="showSetup" @finish="onSetupFinish" />

    <!-- 主界面 -->
    <template v-else>
      <AppLayout>
        <router-view v-slot="{ Component }">
          <component :is="Component"/>
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
import {useSettingsStore} from '@/stores/settings'
import {useSkillsStore} from '@/stores/skills'
import AppLayout from '@/components/layout/AppLayout.vue'
import SetupWizard from '@/components/setup/SetupWizard.vue'

const settingsStore = useSettingsStore()
const skillsStore = useSkillsStore()
const showNotification = ref(false)
const notificationData = ref({title: '', body: ''})
let notifTimer: any = null

// 首次启动向导
const showSetup = ref(false)

onMounted(async () => {
  await settingsStore.fetchSettings()
  settingsStore.initThemeListener()

  // 检查是否首次启动
  const setupDone = settingsStore.settings.setup_done
  if (!setupDone) {
    showSetup.value = true
    return
  }

  initApp()
})

async function onSetupFinish(data: {
  nickname: string;
  apiEnabled: boolean;
  apiPort: number;
  apiToken: string;
  apiHost: string
}) {
  // 保存称呼
  if (data.nickname) {
    await settingsStore.setSetting('user_nickname', data.nickname)
  }

  // 保存 API 配置
  await settingsStore.setSetting('api_enabled', data.apiEnabled ? 'true' : 'false')
  await settingsStore.setSetting('api_port', String(data.apiPort))
  await settingsStore.setSetting('api_token', data.apiToken)
  await settingsStore.setSetting('api_host', data.apiHost)

  // 标记设置完成
  await settingsStore.setSetting('setup_done', 'true')

  showSetup.value = false

  // 如果启用了 API，提示需要重启
  if (data.apiEnabled) {
    // 给一点时间让主界面渲染
    setTimeout(async () => {
      try {
        const { ElMessageBox } = await import('element-plus')
        await ElMessageBox.confirm(
          'API 接口配置已保存，需要重启应用才能生效。是否立即重启？',
          '提示',
          { confirmButtonText: '重启', cancelButtonText: '稍后', type: 'info' }
        )
        // 重启应用
        window.electronAPI.settings.set('api_enabled', 'true')
        window.electronAPI.app.restart()
      } catch { /* 用户取消 */ }
    }, 500)
  }

  initApp()
}

function initApp() {
  // 后台预加载技能数据（不阻塞页面）
  skillsStore.fetchSkills()

  // 监听来自主进程的通知
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

/* 应用内通知弹窗 */
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

.notif-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.notif-content {
  flex: 1;
  min-width: 0;
}

.notif-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.notif-body {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notif-close {
  font-size: 18px;
  color: var(--text-tertiary);
  cursor: pointer;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.notif-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.notification-slide-enter-active {
  transition: all 0.3s ease-out;
}

.notification-slide-leave-active {
  transition: all 0.3s ease-in;
}

.notification-slide-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-slide-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
