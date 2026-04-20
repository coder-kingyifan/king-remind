<template>
  <nav class="sidebar">
    <div class="sidebar-logo">
      <img class="logo-icon" :src="logoIcon" alt="logo"/>
    </div>

    <div class="sidebar-nav">
      <div
          v-for="item in currentNavItems"
          :key="item.path"
          class="nav-item"
          :class="{ active: route.path === item.path || (item.path === '/' && route.path === '/') }"
          @click="router.push(item.path)"
      >
        <el-tooltip :content="item.title" placement="right" :show-after="400">
          <el-icon :size="20">
            <component :is="item.icon"/>
          </el-icon>
        </el-tooltip>
      </div>
    </div>

    <div class="sidebar-bottom">
      <div class="nav-item theme-toggle" @click="toggleTheme">
        <el-tooltip :content="themeTooltip" placement="right" :show-after="400">
          <el-icon :size="20">
            <Sunny v-if="settingsStore.currentTheme === 'dark'"/>
            <Moon v-else/>
          </el-icon>
        </el-tooltip>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import {computed} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {useSettingsStore} from '@/stores/settings'
import {Bell, ChatDotRound, Cpu, MagicStick, Message, Moon, Odometer, Setting, Sunny, HomeFilled, List} from '@element-plus/icons-vue'
import logoIcon from '../../../resources/icon.png'

const route = useRoute()
const router = useRouter()
const settingsStore = useSettingsStore()

// AI 提醒模式 - 全功能导航
const aiNavItems = [
  {path: '/', title: 'AI 助手', icon: ChatDotRound},
  {path: '/dashboard', title: '数据概览', icon: Odometer},
  {path: '/reminders', title: '提醒管理', icon: Bell},
  {path: '/todos', title: '待办事项', icon: List},
  {path: '/notifications', title: '通知渠道', icon: Message},
  {path: '/model-config', title: '模型配置', icon: Cpu},
  {path: '/skills', title: '技能中心', icon: MagicStick},
  {path: '/settings', title: '系统设置', icon: Setting}
]

// 普通模式 - 简洁导航
const simpleNavItems = [
  {path: '/', title: '导览', icon: HomeFilled},
  {path: '/reminders', title: '创建提醒', icon: Bell},
  {path: '/todos', title: '待办事项', icon: List},
  {path: '/notifications', title: '消息渠道', icon: Message},
  {path: '/settings', title: '设置', icon: Setting}
]

const currentNavItems = computed(() => {
  const mode = settingsStore.settings.app_mode
  return mode === 'simple' ? simpleNavItems : aiNavItems
})

const themeTooltip = computed(() => {
  return settingsStore.currentTheme === 'dark' ? '切换亮色' : '切换暗色'
})

function toggleTheme() {
  const newTheme = settingsStore.currentTheme === 'dark' ? 'light' : 'dark'
  settingsStore.setSetting('theme', newTheme)
}
</script>

<style scoped>
.sidebar {
  width: 64px;
  height: 100%;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color-light);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 0 16px;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.sidebar-logo {
  width: 100%;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.logo-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
}

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.sidebar-bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  -webkit-app-region: no-drag;
}

.nav-item {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.nav-item.active {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 16px;
  background: var(--color-primary);
  border-radius: 0 2px 2px 0;
}
</style>
