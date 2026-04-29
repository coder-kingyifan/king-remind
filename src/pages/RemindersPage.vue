<template>
  <div class="reminders-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">提醒管理</h1>
        <p class="page-subtitle">创建和管理您的提醒事项</p>
      </div>
      <el-button type="primary" @click="openCreateDialog">
        <el-icon>
          <Plus/>
        </el-icon>
        新建提醒
      </el-button>
    </div>

    <!-- 过滤栏 -->
    <div class="filter-bar">
      <el-input
          v-model="searchText"
          placeholder="搜索提醒..."
          prefix-icon="Search"
          clearable
          style="width: 240px;"
          @input="handleSearch"
      />
      <el-segmented v-model="statusFilter" :options="filterOptions" @change="handleFilterChange"/>
    </div>

    <!-- 提醒列表 -->
    <div v-if="remindersStore.loading" class="state-wrap">
      <el-icon class="loading-icon" :size="26"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <div v-else-if="remindersStore.reminders.length === 0" class="state-wrap empty">
      <div class="empty-illustration" aria-hidden="true">
        <div class="empty-bell"></div>
        <div class="empty-ring"></div>
      </div>
      <strong>设置提醒，不再错过重要事项</strong>
      <p>支持定时和循环提醒，可推送到桌面或企业微信。</p>
    </div>

    <div v-else class="reminder-list">
      <div
          v-for="reminder in remindersStore.reminders"
          :key="reminder.id"
          class="reminder-row"
          :class="{ inactive: reminder.is_active === 0 }"
      >
        <div class="row-left">
          <span class="row-icon" :style="{ background: reminder.color + '20', color: reminder.color }">
            {{ reminder.icon }}
          </span>
          <div class="row-info">
            <div class="row-title">{{ reminder.title }}</div>
            <div class="row-meta">
              <el-tag v-if="!isSimpleMode && reminder.skill_id" size="small" effect="plain" type="success" style="margin-right: 6px;">
                ⚡ {{ getSkillName(reminder.skill_id) }}
              </el-tag>
              <el-tag
                  :type="reminder.remind_type === 'scheduled' ? 'warning' : 'primary'"
                  size="small"
                  effect="plain"
                  style="margin-right: 6px;"
              >{{ reminder.remind_type === 'scheduled' ? '定时' : '循环' }}
              </el-tag>
              <span v-if="reminder.remind_type === 'interval'">每 {{
                  reminder.interval_value
                }} {{ unitLabel(reminder.interval_unit) }}</span>
              <span v-else>{{ formatTime(reminder.start_time) }}</span>
              <span v-if="reminder.active_hours_start && reminder.active_hours_end" class="meta-divider">
                · {{ reminder.active_hours_start }} - {{ reminder.active_hours_end }}
              </span>
              <span v-if="reminder.next_trigger_at" class="meta-divider">
                · 下次 {{ formatTime(reminder.next_trigger_at) }}
              </span>
            </div>
          </div>
        </div>

        <div class="row-right">
          <div class="channel-badges">
            <span
                v-for="ch in parseChannels(reminder.channels)"
                :key="ch"
                class="channel-badge"
                :title="channelName(ch)"
            >
              <img v-if="ch === 'wechat_work'" :src="wechatWorkIcon" class="channel-badge-img"/>
              <img v-else-if="ch === 'wechat_test'" :src="wechatTestIcon" class="channel-badge-img"/>
              <img v-else-if="ch === 'wechat_bot'" :src="wechatTestIcon" class="channel-badge-img"/>
              <img v-else-if="ch === 'dingtalk'" :src="dingtalkIcon" class="channel-badge-img"/>
              <img v-else-if="ch === 'feishu'" :src="feishuIcon" class="channel-badge-img"/>
              <template v-else>{{ channelIcon(ch) }}</template>
            </span>
          </div>
          <el-switch
              :model-value="reminder.is_active === 1"
              size="small"
              @change="() => handleToggle(reminder.id)"
          />
          <el-dropdown trigger="click" @command="(cmd: string) => handleCommand(cmd, reminder)">
            <el-button text circle>
              <el-icon>
                <MoreFilled/>
              </el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="edit">
                  <el-icon>
                    <Edit/>
                  </el-icon>
                  编辑
                </el-dropdown-item>
                <el-dropdown-item command="delete" divided>
                  <el-icon color="#F56C6C">
                    <Delete/>
                  </el-icon>
                  <span style="color: #F56C6C;">删除</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>

    <!-- 创建/编辑对话框 -->
    <ReminderForm
        v-model:visible="formVisible"
        :reminder="editingReminder"
        @saved="handleSaved"
    />
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'
import {useRemindersStore} from '@/stores/reminders'
import {useSkillsStore} from '@/stores/skills'
import {useSettingsStore} from '@/stores/settings'
import {Delete, Edit, Loading, MoreFilled, Plus} from '@element-plus/icons-vue'
import {CHANNELS} from '@/types/notification'
import type {Reminder} from '@/types/reminder'
import ReminderForm from '@/components/reminder/ReminderForm.vue'
import {ElMessage, ElMessageBox} from 'element-plus'
import wechatWorkIcon from '@/../resources/wechat-work.png'
import wechatTestIcon from '@/../resources/wechat.png'
import dingtalkIcon from '@/../resources/dingding.ico'
import feishuIcon from '@/../resources/feishu.png'

const remindersStore = useRemindersStore()
const skillsStore = useSkillsStore()
const settingsStore = useSettingsStore()
const isSimpleMode = computed(() => settingsStore.settings.app_mode === 'simple')
const searchText = ref('')
const statusFilter = ref('all')
const formVisible = ref(false)
const editingReminder = ref<Reminder | null>(null)

const filterOptions = [
  {label: '全部', value: 'all'},
  {label: '进行中', value: 'active'},
  {label: '已暂停', value: 'paused'}
]

function openCreateDialog() {
  editingReminder.value = null
  formVisible.value = true
}

function handleSearch() {
  const filters: any = {}
  if (searchText.value) filters.search = searchText.value
  if (statusFilter.value === 'active') filters.is_active = 1
  else if (statusFilter.value === 'paused') filters.is_active = 0
  remindersStore.fetchReminders(filters)
}

function handleFilterChange() {
  handleSearch()
}

function handleCommand(cmd: string, reminder: Reminder) {
  if (cmd === 'edit') {
    editingReminder.value = reminder
    formVisible.value = true
  } else if (cmd === 'delete') {
    ElMessageBox.confirm(
        `确定要删除提醒「${reminder.title}」吗？此操作不可恢复。`,
        '删除确认',
        {confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning'}
    ).then(() => {
      remindersStore.deleteReminder(reminder.id)
      ElMessage.success('删除成功')
    }).catch(() => {
    })
  }
}

function handleToggle(id: number) {
  const filters: any = {}
  if (searchText.value) filters.search = searchText.value
  if (statusFilter.value === 'active') filters.is_active = 1
  else if (statusFilter.value === 'paused') filters.is_active = 0
  remindersStore.toggleReminder(id, filters)
}

function handleSaved() {
  handleSearch()
}

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
  return CHANNELS.find(c => c.key === key)?.icon || '📌'
}

function channelName(key: string): string {
  return CHANNELS.find(c => c.key === key)?.name || key
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})
  }
  return d.toLocaleString('zh-CN', {month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'})
}

onMounted(() => {
  remindersStore.fetchReminders()
  skillsStore.fetchSkills()
})

function getSkillName(skillId: number): string {
  const skill = skillsStore.skills.find(s => s.id === skillId)
  return skill?.name || '未知技能'
}
</script>

<style scoped>
.reminders-page {
  max-width: 900px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
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

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

/* 提醒列表 */
.reminder-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reminder-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: 10px;
  padding: 14px 18px;
  transition: all 0.2s ease;
}

.reminder-row:hover {
  box-shadow: var(--shadow-md);
}

.reminder-row.inactive {
  opacity: 0.55;
}

.row-left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.row-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.row-info {
  min-width: 0;
}

.row-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-meta {
  font-size: 12px;
  color: var(--text-tertiary);
}

.meta-divider {
  margin-left: 2px;
}

.row-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.channel-badges {
  display: flex;
  gap: 2px;
}

.channel-badge {
  font-size: 14px;
}

.channel-badge-img {
  width: 14px;
  height: 14px;
  border-radius: 2px;
  vertical-align: middle;
}

/* 空/加载状态 */
.state-wrap {
  display: flex;
  min-height: 420px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px 84px;
  color: var(--text-tertiary);
  font-size: 13px;
  text-align: center;
}

.loading-icon {
  margin-bottom: 10px;
  animation: rotate 1s linear infinite;
}

.empty strong {
  margin-top: 16px;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
}

.empty p {
  margin-top: 8px;
  color: var(--text-tertiary);
  line-height: 1.5;
}

.empty-illustration {
  position: relative;
  width: 112px;
  height: 100px;
}

.empty-bell {
  position: absolute;
  left: 50%;
  top: 10px;
  width: 40px;
  height: 36px;
  border: 2.5px solid rgba(230, 162, 60, .45);
  border-radius: 20px 20px 0 0;
  background: rgba(230, 162, 60, .06);
  transform: translateX(-50%);
}

.empty-bell::before {
  position: absolute;
  top: -10px;
  left: 50%;
  width: 12px;
  height: 10px;
  border: 2.5px solid rgba(230, 162, 60, .45);
  border-bottom: 0;
  border-radius: 6px 6px 0 0;
  transform: translateX(-50%);
  content: '';
}

.empty-bell::after {
  position: absolute;
  bottom: -8px;
  left: 50%;
  width: 10px;
  height: 6px;
  border-radius: 0 0 5px 5px;
  background: rgba(230, 162, 60, .45);
  transform: translateX(-50%);
  content: '';
}

.empty-ring {
  position: absolute;
  right: 6px;
  top: 6px;
  width: 28px;
  height: 28px;
  border: 2px solid rgba(230, 162, 60, .25);
  border-radius: 50%;
}

.empty-ring::before {
  position: absolute;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
  border: 1.5px solid rgba(230, 162, 60, .15);
  border-radius: 50%;
  content: '';
}

@keyframes rotate {
  to {
    transform: rotate(360deg);
  }
}
</style>
