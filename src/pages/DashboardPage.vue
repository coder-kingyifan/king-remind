<template>
  <div class="dashboard">
    <div class="page-header">
      <h1 class="page-title">仪表盘</h1>
      <p class="page-subtitle">{{ greeting }}，这是今天的提醒概览</p>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(64, 158, 255, 0.1); color: #409EFF;">
          <el-icon :size="22">
            <Bell/>
          </el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.total }}</div>
          <div class="stat-label">全部提醒</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(103, 194, 58, 0.1); color: #67C23A;">
          <el-icon :size="22">
            <CircleCheck/>
          </el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.active }}</div>
          <div class="stat-label">进行中</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(230, 162, 60, 0.1); color: #E6A23C;">
          <el-icon :size="22">
            <Finished/>
          </el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.triggeredToday }}</div>
          <div class="stat-label">今日已触发</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(144, 147, 153, 0.1); color: #909399;">
          <el-icon :size="22">
            <Timer/>
          </el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ nextReminderText }}</div>
          <div class="stat-label">下次提醒</div>
        </div>
      </div>
    </div>

    <!-- 今日提醒列表 -->
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">活跃提醒</h2>
        <el-button type="primary" size="small" @click="router.push('/reminders')">
          管理提醒
        </el-button>
      </div>

      <div v-if="activeReminders.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <p class="empty-text">暂无活跃提醒</p>
        <el-button type="primary" plain size="small" @click="router.push('/reminders')">
          创建第一个提醒
        </el-button>
      </div>

      <div v-else class="reminder-grid">
        <div
            v-for="reminder in activeReminders"
            :key="reminder.id"
            class="reminder-card"
            :style="{ borderLeftColor: reminder.color }"
        >
          <div class="reminder-card-header">
            <span class="reminder-icon">{{ reminder.icon }}</span>
            <span class="reminder-title">{{ reminder.title }}</span>
            <el-switch
                :model-value="reminder.is_active === 1"
                size="small"
                @change="() => remindersStore.toggleReminder(reminder.id)"
            />
          </div>
          <div class="reminder-card-body">
            <div class="reminder-interval">
              <el-tag
                  :type="reminder.remind_type === 'scheduled' ? 'warning' : 'primary'"
                  size="small"
                  effect="plain"
                  style="margin-right: 6px;"
              >{{ reminder.remind_type === 'scheduled' ? '定时' : '循环' }}
              </el-tag>
              <el-icon :size="14">
                <Timer/>
              </el-icon>
              <template v-if="reminder.remind_type === 'interval'">
                每 {{ reminder.interval_value }} {{ unitLabel(reminder.interval_unit) }}
              </template>
              <template v-else>
                {{ formatTime(reminder.start_time) }}
              </template>
            </div>
            <div v-if="reminder.next_trigger_at" class="reminder-next">
              下次: {{ formatTime(reminder.next_trigger_at) }}
            </div>
          </div>
          <div class="reminder-card-footer">
            <div class="channel-badges">
              <span
                  v-for="ch in parseChannels(reminder.channels)"
                  :key="ch"
                  class="channel-badge"
              >
                {{ channelIcon(ch) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 最近通知日志 -->
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
            <span class="log-channel">{{ channelIcon(log.channel) }} {{ channelName(log.channel) }}</span>
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
</template>

<script setup lang="ts">
import {computed, onMounted, onUnmounted, reactive, ref} from 'vue'
import {useRouter} from 'vue-router'
import {useRemindersStore} from '@/stores/reminders'
import {ArrowDown, Bell, CircleCheck, Finished, Timer} from '@element-plus/icons-vue'
import {CHANNELS} from '@/types/notification'

const router = useRouter()
const remindersStore = useRemindersStore()
const stats = computed(() => remindersStore.stats)
const recentLogs = ref<any[]>([])
const expandedErrors = reactive<Record<number, boolean>>({})
let refreshTimer: any = null

function toggleLogError(id: number) {
  expandedErrors[id] = !expandedErrors[id]
}

async function refreshData() {
  await remindersStore.fetchReminders()
  await remindersStore.fetchStats()
  try {
    recentLogs.value = await window.electronAPI.logs.recent(10)
  } catch { /* ignore */
  }
}

const activeReminders = computed(() =>
    remindersStore.reminders.filter(r => r.is_active === 1)
)

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '凌晨好'
  if (hour < 12) return '上午好'
  if (hour < 18) return '下午好'
  return '晚上好'
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
  // 每30秒自动刷新
  refreshTimer = setInterval(refreshData, 30000)
  // 收到通知时立即刷新
  window.electronAPI.notifications.onShow(() => {
    refreshData()
  })
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
.dashboard {
  max-width: 900px;
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
  gap: 16px;
  margin-bottom: 24px;
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
}

.stat-card:hover {
  box-shadow: var(--shadow-md);
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

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

/* 段落 */
.section {
  margin-bottom: 24px;
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

/* 提醒卡片网格 */
.reminder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.reminder-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-left: 3px solid;
  border-radius: 10px;
  padding: 14px 16px;
  transition: all 0.2s ease;
}

.reminder-card:hover {
  box-shadow: var(--shadow-md);
}

.reminder-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.reminder-icon {
  font-size: 18px;
}

.reminder-title {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reminder-card-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.reminder-interval,
.reminder-next {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.reminder-card-footer {
  display: flex;
  align-items: center;
}

.channel-badges {
  display: flex;
  gap: 4px;
}

.channel-badge {
  font-size: 14px;
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
  padding: 24px;
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
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
  gap: 10px;
  padding: 10px 16px;
  font-size: 13px;
}

.log-status {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
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
}

.log-expand-arrow {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
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
  padding: 6px 16px 10px 46px;
  font-size: 12px;
  color: #F56C6C;
  background: rgba(245, 108, 108, 0.04);
  line-height: 1.5;
  word-break: break-all;
}

.log-channel {
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.log-time {
  color: var(--text-tertiary);
  font-size: 12px;
  white-space: nowrap;
}

@media (max-width: 800px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
