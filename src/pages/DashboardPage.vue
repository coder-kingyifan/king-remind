<template>
  <div class="dashboard">
    <div class="page-header">
      <h1 class="page-title">{{ greeting }}</h1>
    </div>

    <!-- 提醒 & 待办 -->
    <div class="section">
      <div class="section-head">
        <span class="section-icon">🔔</span>
        <span class="section-name">提醒 & 待办</span>
      </div>
      <div class="metric-row">
        <div class="metric" @click="router.push('/reminders')">
          <span class="metric-val">{{ dashStats.activeReminders }}</span>
          <span class="metric-lbl">活跃提醒</span>
        </div>
        <div class="metric" @click="router.push('/todos')">
          <span class="metric-val">{{ dashStats.todoPending }}</span>
          <span class="metric-lbl">待办待完成</span>
        </div>
        <div class="metric" v-if="dashStats.todoOverdue > 0" @click="router.push('/todos')">
          <span class="metric-val warn">{{ dashStats.todoOverdue }}</span>
          <span class="metric-lbl">逾期</span>
        </div>
        <div class="metric">
          <span class="metric-val">{{ dashStats.triggeredToday }}</span>
          <span class="metric-lbl">今日触发</span>
        </div>
        <div class="metric">
          <span class="metric-val dim">{{ nextReminderText }}</span>
          <span class="metric-lbl">下次提醒</span>
        </div>
      </div>
      <!-- 待办进度 -->
      <div v-if="dashStats.todoTotal > 0" class="progress-row">
        <div class="progress-bar">
          <div class="progress-fill" :style="{width: todoPercent + '%'}"></div>
        </div>
        <span class="progress-label">待办完成 {{ dashStats.todoCompleted }}/{{ dashStats.todoTotal }}</span>
      </div>
    </div>

    <!-- 会议 -->
    <div class="section">
      <div class="section-head">
        <span class="section-icon">📋</span>
        <span class="section-name">会议</span>
      </div>
      <div class="metric-row">
        <div class="metric" @click="router.push('/meetings')">
          <span class="metric-val">{{ dashStats.meetingTotal }}</span>
          <span class="metric-lbl">总会议</span>
        </div>
        <div class="metric" @click="router.push('/meetings')">
          <span class="metric-val">{{ dashStats.meetingOngoing }}</span>
          <span class="metric-lbl">进行中</span>
        </div>
        <div class="metric">
          <span class="metric-val">{{ dashStats.meetingToday }}</span>
          <span class="metric-lbl">今日会议</span>
        </div>
        <div class="metric">
          <span class="metric-val">{{ dashStats.meetingPending }}</span>
          <span class="metric-lbl">未开始</span>
        </div>
      </div>
    </div>

    <!-- AI & 系统 -->
    <div v-if="!isSimpleMode" class="section">
      <div class="section-head">
        <span class="section-icon">🤖</span>
        <span class="section-name">AI & 系统</span>
      </div>
      <div class="metric-row">
        <div class="metric" @click="router.push('/')">
          <span class="metric-val">{{ dashStats.chatSessionCount }}</span>
          <span class="metric-lbl">对话次数</span>
        </div>
        <div class="metric" @click="router.push('/model-config')">
          <span class="metric-val">{{ dashStats.modelCount }}</span>
          <span class="metric-lbl">模型配置</span>
        </div>
        <div class="metric" @click="router.push('/reminders')">
          <span class="metric-val">{{ dashStats.skillCount }}</span>
          <span class="metric-lbl">技能</span>
        </div>
        <div class="metric" @click="router.push('/notifications')">
          <span class="metric-val">{{ dashStats.enabledChannels }}<span class="dim">/{{
              dashStats.totalChannels
            }}</span></span>
          <span class="metric-lbl">通知渠道</span>
        </div>
      </div>
    </div>

    <!-- 活跃提醒 + 最近通知 -->
    <div class="two-col">
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">活跃提醒</h2>
          <el-button type="primary" size="small" plain @click="router.push('/reminders')">查看全部</el-button>
        </div>
        <div v-if="activeReminders.length === 0" class="empty-state small">
          <p class="empty-text">暂无活跃提醒</p>
          <el-button type="primary" plain size="small" @click="router.push('/reminders')">创建提醒</el-button>
        </div>
        <div v-else class="reminder-list">
          <div v-for="reminder in activeReminders.slice(0, 6)" :key="reminder.id" class="reminder-item"
               :style="{ borderLeftColor: reminder.color }">
            <div class="reminder-item-left">
              <span class="reminder-icon">{{ reminder.icon }}</span>
              <div class="reminder-item-info">
                <span class="reminder-title">{{ reminder.title }}</span>
                <span class="reminder-meta">
                  <el-tag :type="reminder.remind_type === 'scheduled' ? 'warning' : 'primary'" size="small"
                          effect="plain">{{ reminder.remind_type === 'scheduled' ? '定时' : '循环' }}</el-tag>
                  <template v-if="reminder.remind_type === 'interval'">每 {{
                      reminder.interval_value
                    }} {{ unitLabel(reminder.interval_unit) }}</template>
                  <template v-else>{{ formatTime(reminder.start_time) }}</template>
                </span>
              </div>
            </div>
            <div class="reminder-item-right">
              <div class="channel-badges"><span v-for="ch in parseChannels(reminder.channels)" :key="ch"
                                                class="channel-badge">
                <img v-if="ch === 'wechat_work'" :src="wechatWorkIcon" class="channel-badge-img"/>
                <img v-else-if="ch === 'wechat_test'" :src="wechatTestIcon" class="channel-badge-img"/>
                <img v-else-if="ch === 'wechat_bot'" :src="wechatTestIcon" class="channel-badge-img"/>
                <img v-else-if="ch === 'dingtalk'" :src="dingtalkIcon" class="channel-badge-img"/>
                <img v-else-if="ch === 'feishu'" :src="feishuIcon" class="channel-badge-img"/>
                <template v-else>{{ channelIcon(ch) }}</template>
              </span></div>
              <el-switch :model-value="reminder.is_active === 1" size="small"
                         @change="() => remindersStore.toggleReminder(reminder.id)"/>
            </div>
          </div>
        </div>
      </div>
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">最近通知</h2>
        </div>
        <div v-if="recentLogs.length === 0" class="empty-state small"><p class="empty-text">暂无通知记录</p></div>
        <div v-else class="log-list">
          <div v-for="log in recentLogs" :key="log.id" class="log-item-wrapper">
            <div class="log-item">
              <span class="log-status" :class="log.status">{{
                  log.reminder_icon || (log.status === 'sent' ? '✓' : '✗')
                }}</span>
              <span class="log-title">{{ log.reminder_title || '未知' }}</span>
              <span class="log-channel">
                <img v-if="log.channel === 'wechat_work'" :src="wechatWorkIcon" class="channel-badge-img"/>
                <img v-else-if="log.channel === 'wechat_test'" :src="wechatTestIcon" class="channel-badge-img"/>
                <img v-else-if="log.channel === 'wechat_bot'" :src="wechatTestIcon" class="channel-badge-img"/>
                <img v-else-if="log.channel === 'dingtalk'" :src="dingtalkIcon" class="channel-badge-img"/>
                <img v-else-if="log.channel === 'feishu'" :src="feishuIcon" class="channel-badge-img"/>
                <template v-else>{{ channelIcon(log.channel) }}</template>
              </span>
              <span class="log-time">{{ formatTime(log.sent_at) }}</span>
              <span v-if="log.status === 'failed' && log.error_message" class="log-expand-arrow"
                    :class="{ expanded: expandedErrors[log.id] }" @click="toggleLogError(log.id)">
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
import {computed, onActivated, onDeactivated, onMounted, onUnmounted, reactive, ref} from 'vue'
import {useRouter} from 'vue-router'
import {useRemindersStore} from '@/stores/reminders'
import {useSettingsStore} from '@/stores/settings'
import {ArrowDown} from '@element-plus/icons-vue'
import {CHANNELS} from '@/types/notification'
import wechatWorkIcon from '@/../resources/wechat-work.png'
import wechatTestIcon from '@/../resources/wechat.png'
import dingtalkIcon from '@/../resources/dingding.ico'
import feishuIcon from '@/../resources/feishu.png'

const router = useRouter()
const remindersStore = useRemindersStore()
const settingsStore = useSettingsStore()
const recentLogs = ref<any[]>([])
const expandedErrors = reactive<Record<number, boolean>>({})
let refreshTimer: any = null

const isSimpleMode = computed(() => settingsStore.settings.app_mode === 'simple')

const dashStats = ref({
  totalReminders: 0, activeReminders: 0, triggeredToday: 0,
  chatSessionCount: 0, chatMessageCount: 0,
  modelCount: 0, skillCount: 0, enabledSkillCount: 0,
  enabledChannels: 0, totalChannels: 0,
  todoTotal: 0, todoCompleted: 0, todoPending: 0, todoOverdue: 0,
  meetingTotal: 0, meetingPending: 0, meetingOngoing: 0, meetingCompleted: 0, meetingToday: 0
})

const todoPercent = computed(() => {
  const {todoTotal, todoCompleted} = dashStats.value
  return todoTotal === 0 ? 0 : Math.round((todoCompleted / todoTotal) * 100)
})

function toggleLogError(id: number) {
  expandedErrors[id] = !expandedErrors[id]
}

async function refreshData() {
  await remindersStore.fetchReminders()
  try {
    dashStats.value = await window.electronAPI.dashboard.stats()
  } catch {
  }
  try {
    recentLogs.value = await window.electronAPI.logs.recent(10)
  } catch {
  }
}

const activeReminders = computed(() => remindersStore.reminders.filter(r => r.is_active === 1))

const greeting = computed(() => {
  const hour = new Date().getHours()
  let g = ''
  if (hour < 6) g = '凌晨好'
  else if (hour < 12) g = '上午好'
  else if (hour < 18) g = '下午好'
  else g = '晚上好'
  const n = settingsStore.settings.user_nickname
  return n ? `${g}，${n}` : g
})

const nextReminderText = computed(() => {
  const next = activeReminders.value
    .map(r => parseReminderDate(r.next_trigger_at))
    .filter((time): time is Date => !!time && !Number.isNaN(time.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())[0]
  if (!next) return '--'

  const diff = next.getTime() - Date.now()
  if (diff < 0) return '即将'
  if (diff < 60000) return '< 1分'
  if (diff < 3600000) return `${Math.ceil(diff / 60000)}分后`
  return formatReminderDue(next)
})

function unitLabel(unit: string): string {
  return ({minutes: '分钟', hours: '小时', days: '天', months: '月', years: '年'} as any)[unit] || unit
}

function parseChannels(channels: string): string[] {
  try {
    return JSON.parse(channels)
  } catch {
    return ['desktop']
  }
}

function channelIcon(key: string): string {
  return CHANNELS.find(c => c.key === key)?.icon || '📌'
}

function parseReminderDate(value?: string | null): Date | null {
  if (!value) return null
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) return new Date(value)
  return new Date(value.replace(' ', 'T'))
}

function isSameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit', hour12: false})
}

function formatReminderDue(date: Date): string {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (isSameDate(date, now)) return `今天 ${formatClock(date)}`
  if (isSameDate(date, tomorrow)) return `明天 ${formatClock(date)}`
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

function formatTime(iso: string): string {
  const d = parseReminderDate(iso) || new Date(iso), now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
  return d.toLocaleString('zh-CN', {month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'})
}

onMounted(async () => {
  await refreshData();
  window.electronAPI.notifications.onShow(() => refreshData())
})
onActivated(() => {
  refreshData();
  if (!refreshTimer) refreshTimer = setInterval(refreshData, 30000)
})
onDeactivated(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
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
  margin: 0;
}

/* 分组 */
.section {
  margin-bottom: 24px;
}

.section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.section-icon {
  font-size: 16px;
}

.section-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

/* 指标行 - Linear 风格 */
.metric-row {
  display: flex;
  gap: 32px;
  flex-wrap: wrap;
  padding-left: 24px;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  min-width: 60px;
}

.metric:hover .metric-val {
  color: var(--color-primary);
}

.metric-val {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
  transition: color .15s;
}

.metric-val.warn {
  color: var(--color-danger);
}

.metric-val.dim {
  color: var(--text-secondary);
  font-size: 20px;
}

.metric-val .dim {
  font-size: 14px;
  font-weight: 400;
  color: var(--text-tertiary);
}

.metric-lbl {
  font-size: 12px;
  color: var(--text-tertiary);
}

/* 进度条 */
.progress-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-left: 24px;
  margin-top: 12px;
}

.progress-bar {
  width: 200px;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), #67C23A);
  border-radius: 2px;
  transition: width .4s;
}

.progress-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

/* 两栏 */
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
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

.channel-badge-img {
  width: 14px;
  height: 14px;
  border-radius: 2px;
  vertical-align: middle;
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
  .two-col {
    grid-template-columns: 1fr;
  }

  .metric-row {
    gap: 20px;
  }
}
</style>
