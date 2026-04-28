<template>
  <div class="settings-page">
    <div class="settings-header">
      <h1 class="settings-title">设置</h1>
    </div>

    <!-- 二级菜单 -->
    <div class="settings-tabs">
      <div
        v-for="tab in tabs"
        :key="tab.key"
        class="settings-tab"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <el-icon :size="16"><component :is="tab.icon"/></el-icon>
        <span>{{ tab.label }}</span>
      </div>
    </div>

    <!-- 模型配置 -->
    <div v-if="activeTab === 'models'" class="tab-content">
      <ModelConfigSection/>
    </div>

    <!-- 通知渠道 -->
    <div v-if="activeTab === 'notifications'" class="tab-content">
      <NotificationSection/>
    </div>

    <!-- 系统设置 -->
    <div v-if="activeTab === 'system'" class="tab-content">
      <SystemSection/>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {Bell, Setting, Cpu} from '@element-plus/icons-vue'
import ModelConfigSection from './settings/ModelConfigSection.vue'
import NotificationSection from './settings/NotificationSection.vue'
import SystemSection from './settings/SystemSection.vue'

const route = useRoute()
const router = useRouter()

const tabs = [
  {key: 'models', label: '模型配置', icon: Cpu},
  {key: 'notifications', label: '通知渠道', icon: Bell},
  {key: 'system', label: '系统设置', icon: Setting}
]

const activeTab = ref('models')

// 从路由 query 读取初始 tab
watch(() => route.query.tab, (tab) => {
  if (tab && tabs.some(t => t.key === tab)) {
    activeTab.value = tab as string
  }
}, {immediate: true})

// 切换 tab 时更新 URL
watch(activeTab, (tab) => {
  router.replace({path: '/settings', query: {tab}})
})
</script>

<style scoped>
.settings-page {
  max-width: 860px;
}

.settings-header {
  margin-bottom: 20px;
}

.settings-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
}

.settings-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--border-color-light);
  padding-bottom: 0;
}

.settings-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--text-tertiary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all 0.2s;
}

.settings-tab:hover {
  color: var(--text-secondary);
}

.settings-tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 500;
}

.tab-content {
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
