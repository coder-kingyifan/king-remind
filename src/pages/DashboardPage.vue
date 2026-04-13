<template>
  <div class="dashboard">
    <div class="page-header">
      <h1 class="page-title">数据概览</h1>
      <p class="page-subtitle">{{ greeting }}，这是你的应用全景</p>
    </div>

    <!-- 核心指标 -->
    <div class="stats-row">
      <div class="stat-card" @click="router.push('/reminders')">
        <div class="stat-icon" style="background: rgba(64, 158, 255, 0.1); color: #409EFF;">
          <el-icon :size="22"><Bell/></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ dashStats.totalReminders }}</div>
          <div class="stat-label">提醒总数</div>
        </div>
        <div class="stat-extra" v-if="dashStats.activeReminders > 0">
          <span class="stat-tag active">{{ dashStats.activeReminders }} 进行中</span>
        </div>
      </div>

      <div class="stat-card" @click="router.push('/')">
        <div class="stat-icon" style="background: rgba(144, 89, 246, 0.1); color: #9059F6;">
          <el-icon :size="22"><ChatDotRound/></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ dashStats.chatSessionCount }}</div>
          <div class="stat-label">对话次数</div>
        </div>
        <div class="stat-extra" v-if="dashStats.chatMessageCount > 0">
          <span class="stat-tag">{{ dashStats.chatMessageCount }} 条消息</span>
        </div>
      </div>

      <div class="stat-card" @click="router.push('/model-config')">
        <div class="stat-icon" style="background: rgba(230, 162, 60, 0.1); color: #E6A23C;">
          <el-icon :size="22"><Cpu/></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ dashStats.modelCount }}</div>
          <div class="stat-label">模型配置</div>
        </div>
      </div>

      <div class="stat-card" @click="router.push('/notifications')">
        <div class="stat-icon" style="background: rgba(103, 194, 58, 0.1); color: #67C23A;">
          <el-icon :size="22"><Message/></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ dashStats.enabledChannels }}</div>
          <div class="stat-label">通知渠道</div>
        </div>
        <div class="stat-extra" v-if="dashStats.totalChannels > 0">
          <span class="stat-tag">{{ dashStats.enabledChannels }}/{{ dashStats.totalChannels }} 已启用</span>
        </div>
      </div>
    </div>

    <!-- 第二行指标 -->
    <div class="stats-row secondary">
      <div class="stat-card small" @click="router.push('/skills')">
        <div class="stat-icon" style="background: rgba(236, 105, 92, 0.1); color: #EC695C;">
          <el-icon :size="20"><MagicStick/></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ dashStats.skillCount }}</div>
          <div class="stat-label">技能</div>
        </div>
        <div class="stat-extra" v-if="dashStats.enabledSkillCount > 0">
          <span class="stat-tag active">{{ dashStats.enabledSkillCount }} 已启用</span>
        </div>
      </div>

      <div class="stat-card small">
        <div class="stat-icon" style="background: rgba(230, 162, 60, 0.1); color: #E6A23C;">
          <el-icon :size="20"><Finished/></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ dashStats.triggeredToday }}</div>
          <div class="stat-label">今日触发</div>
        </div>
      </div>

      <div class="stat-card small">
        <div class="stat-icon" style="background: rgba(64, 158, 255, 0.1); color: #409EFF;">
          <el-icon :size="20"><Timer/></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ nextReminderText }}</div>
          <div class="stat-label">下次提醒</div>
        </div>
      </div>
    </div>

    <!-- 活跃提醒 + 最近通知 -->
    <div class="two-col">
      <!-- 活跃提醒 -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">活跃提醒</h2>
          <el-button type="primary" size="small" plain @click="router.push('/reminders')">
            查看全部
          </el-button>
        </div>

        <div v-if="activeReminders.length === 0" class="empty-state small">
          <p class="empty-text">暂无活跃提醒</p>
          <el-button type="primary" plain size="small" @click="router.push('/reminders')">
            创建提醒
          </el-button>
        </div>

        <div v-else class="reminder-list">
          <div
              v-for="reminder in activeReminders.slice(0, 6)"
              :key="reminder.id"
              class="reminder-item"
              :style="{ borderLeftColor: reminder.color }"
          >
            <div class="reminder-item-left">
              <span class="reminder-icon">{{ reminder.icon }}</span>
              <div class="reminder-item-info">
                <span class="reminder-title">{{ reminder.title }}</span>
                <span class="reminder-meta">
                  <el-tag
                      :type="reminder.remind_type === 'scheduled' ? 'warning' : 'primary'"
                      size="small"
                      effect="plain"
                  >{{ reminder.remind_type === 'scheduled' ? '定时' : '循环' }}
                  </el-tag>
                  <template v-if="reminder.remind_type === 'interval'">
                    每 {{ reminder.interval_value }} {{ unitLabel(reminder.interval_unit) }}
                  </template>
                  <template v-else>
                    {{ formatTime(reminder.start_time) }}
                  </template>
                </span>
              </div>
            </div>
            <div class="reminder-item-right">
              <div class="channel-badges">
                <span v-for="ch in parseChannels(reminder.channels)" :key="ch" class="channel-badge">
                  {{ channelIcon(ch) }}
                </span>
              </div>
              <el-switch
                  :model-value="reminder.is_active === 1"
                  size="small"
                  @change="() => remindersStore.toggleReminder(reminder.id)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 最近通知 -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">最近通知</h2>
        </div>

        <div v-if="recentLogs.length === 0" class="empty-state small">
          <p class="empty-text">暂无通知记录</p>
        </div>

        <div v-else class="log-list">
          <div v-for="log in recentLogs" :key="log.id" class="log-item-wrapper">
            <div class="log-item">
              <span class="log-status" :class="log.status">
                {{ log.status === 'sent' ? '✓' : '✗' }}
              </span>
              <span class="log-title">{{ log.reminder_title || '未知' }}</span>
              <span class="log-channel">{{ channelIcon(log.channel) }}</span>
              <span class="log-time">{{ formatTime(log.sent_at) }}</span>
              <span
                  v-if="log.status === 'failed' && log.error_message"
                  class="log-expand-arrow"
                  :class="{ expanded: expandedErrors[log.id] }"
                  @click="toggleLogError(log.id)"
              >
                <el-icon :size="14"><ArrowDown/></el-icon>
              </span>
            </div>
            <div v-if="log.status === 'failed' && log.error_message && expandedErrors[log.id]" class="log-error-detail">
              {{ log.error_message }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, onUnmounted, onActivated, onDeactivated, reactive, ref} from 'vue'
import {useRouter} from 'vue-router'
import {useRemindersStore} from '@/stores/reminders'
import {useSettingsStore} from '@/stores/settings'
import {ArrowDown, Bell, ChatDotRound, Cpu, Finished, MagicStick, Message, Timer} from '@element-plus/icons-vue'
import {CHANNELS} from '@/types/notification'

const router = useRouter()
const remindersStore = useRemindersStore()
const settingsStore = useSettingsStore()
const recentLogs = ref<any[]>([])
const expandedErrors = reactive<Record<number, boolean>>({})
let refreshTimer: any = null

const dashStats = ref({
  totalReminders: 0,
  activeReminders: 0,
  triggeredToday: 0,
  chatSessionCount: 0,
  chatMessageCount: 0,
  modelCount: 0,
  skillCount: 0,
  enabledSkillCount: 0,
  enabledChannels: 0,
  totalChannels: 0
})

function toggleLogError(id: number) {
  expandedErrors[id] = !expandedErrors[id]
}

async function refreshData() {
  await remindersStore.fetchReminders()
  try {
    const stats = await window.electronAPI.dashboard.stats()
    dashStats.value = stats
  } catch { /* ignore */ }
  try {
    recentLogs.value = await window.electronAPI.logs.recent(10)
  } catch { /* ignore */ }
}

const activeReminders = computed(() =>
    remindersStore.reminders.filter(r => r.is_active === 1)
)

const greeting = computed(() => {
  const hour = new Date().getHours()
  let timeGreeting = ''
  if (hour < 6) timeGreeting = '凌晨好'
  else if (hour < 12) timeGreeting = '上午好'
  else if (hour < 18) timeGreeting = '下午好'
  else timeGreeting = '晚上好'

  const nickname = settingsStore.settings.user_nickname
  return nickname ? `${timeGreeting}，${nickname}` : timeGreeting
})

const nextReminderText = computed(() => {
  const active = activeReminders.value
      .filter(r => r.next_trigger_at)
      .sort((a, b) => new Date(a.next_trigger_at!).getTime() - new Date(b.next_trigger_at!).getTime())

  if (active.length === 0) return '--'

  const next = new Date(active[0].next_trigger_at!)
  const now = new Date()
  const diff = next.getTime() - now.getTime()

  if (diff < 0) return '即将触发'
  if (diff < 60000) return '< 1分钟'
  if (diff < 3600000) return `${Math.round(diff / 60000)}分钟`
  if (diff < 86400000) return `${Math.round(diff / 3600000)}小时`
  return `${Math.round(diff / 86400000)}天`
})

function unitLabel(unit: string): string {
  const map: Record<string, string> = {minutes: '分钟', hours: '小时', days: '天', months: '月', years: '年'}
  return map[unit] || unit
}

function parseChannels(channels: string): string[] {
  try {
    return JSON.parse(channels)
  } catch {
    return ['desktop']
  }
}

function channelIcon(key: string): string {
  const ch = CHANNELS.find(c => c.key === key)
  return ch?.icon || '📌'
}

function channelName(key: string): string {
  const ch = CHANNELS.find(c => c.key === key)
  return ch?.name || key
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})
  }
  return d.toLocaleString('zh-CN', {month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'})
}

onMounted(async () => {
  await refreshData()
  window.electronAPI.notifications.onShow(() => {
    refreshData()
  })
})

onActivated(() => {
  refreshData()
  if (!refreshTimer) {
    refreshTimer = setInterval(refreshData, 30000)
  }
})

onDeactivated(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
.dashboard {
  max-width: 960px;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 13px;
  color: var(--text-tertiary);
}

/* 统计卡片 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 14px;
}

.stats-row.secondary {
  grid-template-columns: repeat(3, 1fr);
}

.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: 12px;
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  transition: all 0.2s ease;
  cursor: pointer;
  position: relative;
}

.stat-card.small {
  padding: 14px 18px;
}

.stat-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--border-color);
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-card.small .stat-icon {
  width: 38px;
  height: 38px;
}

.stat-info {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-card.small .stat-value {
  font-size: 18px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.stat-extra {
  position: absolute;
  top: 10px;
  right: 12px;
}

.stat-tag {
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--bg-secondary);
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.stat-tag.active {
  color: #67C23A;
  background: rgba(103, 194, 58, 0.08);
}

/* 两栏布局 */
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

/* 段落 */
.section {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

/* 提醒列表 */
.reminder-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reminder-item {
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-left: 3px solid;
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  transition: all 0.2s ease;
}

.reminder-item:hover {
  box-shadow: var(--shadow-sm);
}

.reminder-item-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.reminder-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.reminder-item-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.reminder-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reminder-meta {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.reminder-item-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.channel-badges {
  display: flex;
  gap: 2px;
}

.channel-badge {
  font-size: 13px;
}

/* 空状态 */
.empty-state {
  background: var(--bg-card);
  border: 1px dashed var(--border-color);
  border-radius: 12px;
  padding: 40px;
  text-align: center;
}

.empty-state.small {
  padding: 28px;
}

.empty-text {
  color: var(--text-tertiary);
  font-size: 13px;
  margin-bottom: 12px;
}

/* 日志列表 */
.log-list {
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: 10px;
  overflow: hidden;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  font-size: 13px;
}

.log-status {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  flex-shrink: 0;
}

.log-status.sent {
  background: rgba(103, 194, 58, 0.1);
  color: #67C23A;
}

.log-status.failed {
  background: rgba(245, 108, 108, 0.1);
  color: #F56C6C;
}

.log-title {
  flex: 1;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.log-channel {
  font-size: 13px;
  flex-shrink: 0;
}

.log-time {
  color: var(--text-tertiary);
  font-size: 11px;
  white-space: nowrap;
  flex-shrink: 0;
}

.log-expand-arrow {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  flex-shrink: 0;
  color: var(--text-tertiary);
  transition: all 0.2s ease;
}

.log-expand-arrow:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.log-expand-arrow .el-icon {
  transition: transform 0.2s ease;
}

.log-expand-arrow.expanded .el-icon {
  transform: rotate(180deg);
}

.log-item-wrapper {
  border-bottom: 1px solid var(--border-color-light);
}

.log-item-wrapper:last-child {
  border-bottom: none;
}

.log-error-detail {
  padding: 6px 14px 10px 40px;
  font-size: 12px;
  color: #F56C6C;
  background: rgba(245, 108, 108, 0.04);
  line-height: 1.5;
  word-break: break-all;
}

@media (max-width: 800px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .stats-row.secondary {
    grid-template-columns: repeat(3, 1fr);
  }
  .two-col {
    grid-template-columns: 1fr;
  }
}
</style>
