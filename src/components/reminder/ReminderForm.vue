<template>
  <el-dialog
    :model-value="visible"
    :title="isEdit ? '编辑提醒' : '新建提醒'"
    width="520px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
    @open="initForm"
    class="reminder-dialog"
  >
    <div class="dialog-scroll-body">
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" size="default">
      <el-form-item label="标题" prop="title">
        <el-input v-model="form.title" placeholder="例如：喝水、吃药、休息、XX生日" maxlength="50" show-word-limit />
      </el-form-item>

      <el-form-item label="描述" prop="description">
        <el-input v-model="form.description" type="textarea" :rows="2" placeholder="可选，补充说明" maxlength="200" />
      </el-form-item>

      <div class="form-row">
        <el-form-item label="图标" class="form-item-sm">
          <el-popover placement="bottom-start" :width="240" trigger="click">
            <template #reference>
              <el-button plain class="icon-picker-btn">{{ form.icon }}</el-button>
            </template>
            <div class="icon-grid">
              <span
                v-for="emoji in commonEmojis"
                :key="emoji"
                class="icon-option"
                :class="{ active: form.icon === emoji }"
                @click="form.icon = emoji"
              >{{ emoji }}</span>
            </div>
          </el-popover>
        </el-form-item>

        <el-form-item label="颜色" class="form-item-sm">
          <el-color-picker v-model="form.color" :predefine="presetColors" size="default" />
        </el-form-item>
      </div>

      <!-- 提醒类型选择 -->
      <el-form-item label="提醒类型" prop="remind_type">
        <el-radio-group v-model="form.remind_type" @change="handleTypeChange">
          <el-radio-button value="interval">
            <el-icon style="vertical-align: -2px; margin-right: 4px;"><Refresh /></el-icon>
            循环提醒
          </el-radio-button>
          <el-radio-button value="scheduled">
            <el-icon style="vertical-align: -2px; margin-right: 4px;"><Calendar /></el-icon>
            定时提醒
          </el-radio-button>
        </el-radio-group>
        <div class="form-tip">
          {{ form.remind_type === 'interval' ? '按固定间隔循环提醒（如每60分钟喝水）' : '在指定时间提醒一次（如生日、纪念日）' }}
        </div>
      </el-form-item>

      <!-- 循环提醒：间隔设置 -->
      <template v-if="form.remind_type === 'interval'">
        <div class="form-row">
          <el-form-item label="提醒间隔" prop="interval_value" class="flex-1">
            <div class="interval-picker">
              <el-input-number v-model="form.interval_value" :min="1" :max="9999" controls-position="right" style="width: 120px;" />
              <el-select v-model="form.interval_unit" style="width: 100px;">
                <el-option label="分钟" value="minutes" />
                <el-option label="小时" value="hours" />
                <el-option label="天" value="days" />
                <el-option label="月" value="months" />
                <el-option label="年" value="years" />
              </el-select>
            </div>
          </el-form-item>
        </div>

        <!-- 选择执行日 -->
        <el-form-item label="选择执行日">
          <el-radio-group v-model="executionDayMode" @change="handleExecutionDayChange">
            <el-radio value="all">全部提醒</el-radio>
            <el-radio value="weekdays">按星期</el-radio>
            <el-radio value="workday">仅工作日</el-radio>
            <el-radio value="holiday">仅节假日</el-radio>
          </el-radio-group>

          <!-- 星期选择（仅在"按星期"模式下显示） -->
          <template v-if="executionDayMode === 'weekdays'">
            <el-checkbox-group v-model="form.weekdays" style="margin-top: 8px;">
              <el-checkbox v-for="d in weekdayOptions" :key="d.value" :value="d.value">{{ d.label }}</el-checkbox>
            </el-checkbox-group>
          </template>
          <div class="form-tip">
            {{ executionDayTip }}
          </div>
        </el-form-item>

        <el-form-item label="开始时间" prop="start_time">
          <el-date-picker
            v-model="form.start_time"
            type="datetime"
            placeholder="选择开始时间"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DDTHH:mm:ss"
            style="width: 100%;"
          />
        </el-form-item>

        <el-form-item label="结束时间（可选）">
          <el-date-picker
            v-model="form.end_time"
            type="datetime"
            placeholder="不设置则永久循环"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DDTHH:mm:ss"
            style="width: 100%;"
            clearable
          />
        </el-form-item>

        <el-form-item label="活跃时段（可选）">
          <div class="time-range">
            <el-time-picker v-model="activeStart" placeholder="开始" format="HH:mm" value-format="HH:mm" clearable style="width: 48%;" />
            <span class="time-separator">至</span>
            <el-time-picker v-model="activeEnd" placeholder="结束" format="HH:mm" value-format="HH:mm" clearable style="width: 48%;" />
          </div>
          <div class="form-tip">设置后只在该时段内发送提醒，例如 08:00 - 22:00</div>
        </el-form-item>
      </template>

      <!-- 定时提醒：指定时间 -->
      <template v-else>
        <!-- 农历提醒选项 -->
        <el-form-item label="日期类型">
          <el-radio-group v-model="form.is_lunar" @change="handleLunarChange">
            <el-radio :value="false">公历</el-radio>
            <el-radio :value="true">农历</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 公历提醒时间 -->
        <template v-if="!form.is_lunar">
          <el-form-item label="提醒日期" prop="scheduled_date">
            <el-date-picker
              v-model="scheduledDate"
              type="date"
              placeholder="选择日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              style="width: 100%;"
            />
          </el-form-item>
          <el-form-item label="提醒时间" prop="scheduled_time">
            <el-time-picker
              v-model="scheduledTime"
              placeholder="选择时间"
              format="HH:mm"
              value-format="HH:mm"
              style="width: 100%;"
            />
          </el-form-item>
          <el-form-item>
            <el-checkbox v-model="form.solar_repeat">每年此日提醒</el-checkbox>
            <div class="form-tip">开启后每年到达该日期自动提醒（如生日、纪念日）</div>
          </el-form-item>
        </template>

        <!-- 农历提醒设置 -->
        <template v-if="form.is_lunar">
          <el-form-item label="农历日期">
            <div class="lunar-picker">
              <el-select v-model="lunarMonth" placeholder="月" style="width: 120px;">
                <el-option v-for="m in lunarMonthOptions" :key="m.value" :label="m.label" :value="m.value" />
              </el-select>
              <el-select v-model="lunarDay" placeholder="日" style="width: 120px;">
                <el-option v-for="d in lunarDayOptions" :key="d.value" :label="d.label" :value="d.value" />
              </el-select>
            </div>
            <div class="form-tip">{{ lunarDateLabel }}</div>
          </el-form-item>
          <el-form-item label="提醒时间">
            <el-time-picker v-model="lunarTime" placeholder="选择时间" format="HH:mm" value-format="HH:mm" style="width: 100%;" />
          </el-form-item>
          <el-form-item>
            <el-checkbox v-model="form.lunar_repeat">每年农历此日提醒</el-checkbox>
            <div class="form-tip">开启后每年到达该农历日期自动提醒（如每年正月初一）</div>
          </el-form-item>
        </template>
      </template>

      <el-form-item label="通知渠道" prop="channels">
        <el-checkbox-group v-model="form.channels">
          <el-checkbox
            v-for="ch in channelOptions"
            :key="ch.key"
            :value="ch.key"
            :disabled="ch.key !== 'desktop' && !notificationsStore.isEnabled(ch.key)"
          >
            <img v-if="ch.key === 'wechat_work'" :src="wechatWorkIcon" class="channel-checkbox-img" />
            <template v-else>{{ ch.icon }}</template>
            {{ ch.name }}
            <span v-if="ch.key !== 'desktop' && !notificationsStore.isEnabled(ch.key)" class="channel-disabled-tip">（未启用）</span>
          </el-checkbox>
        </el-checkbox-group>
      </el-form-item>
    </el-form>
    </div>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">
        {{ isEdit ? '保存修改' : '创建提醒' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRemindersStore } from '@/stores/reminders'
import { useNotificationsStore } from '@/stores/notifications'
import { CHANNELS } from '@/types/notification'
import type { Reminder } from '@/types/reminder'
import { ElMessage } from 'element-plus'
import { Refresh, Calendar } from '@element-plus/icons-vue'
import wechatWorkIcon from '@/../resources/wechat-work.png'

const props = defineProps<{
  visible: boolean
  reminder: Reminder | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: []
}>()

const remindersStore = useRemindersStore()
const notificationsStore = useNotificationsStore()
const formRef = ref()
const saving = ref(false)
const activeStart = ref<string | null>(null)
const activeEnd = ref<string | null>(null)
const scheduledDate = ref('')
const scheduledTime = ref('09:00')

const isEdit = computed(() => props.reminder !== null)

const channelOptions = CHANNELS

// 执行日模式
const executionDayMode = ref<'all' | 'weekdays' | 'workday' | 'holiday'>('all')

const executionDayTip = computed(() => {
  const tips: Record<string, string> = {
    all: '每个周期都会触发提醒',
    weekdays: '仅在选中的星期几触发',
    workday: '仅工作日触发，自动跳过周末和法定节假日',
    holiday: '仅节假日触发（周末及法定节假日）'
  }
  return tips[executionDayMode.value]
})

function handleExecutionDayChange(mode: string | number | boolean) {
  form.value.weekdays = []
  form.value.workday_only = 0
  form.value.holiday_only = 0
  if (mode === 'workday') {
    form.value.workday_only = 1
  } else if (mode === 'holiday') {
    form.value.holiday_only = 1
  }
}

// 农历相关
const lunarMonth = ref(1)
const lunarDay = ref(1)
const lunarTime = ref('09:00')

const lunarMonthNames = [
  '正月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '冬月', '腊月'
]
const lunarDayNames = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
]

const lunarMonthOptions = lunarMonthNames.map((label, i) => ({ label, value: i + 1 }))
const lunarDayOptions = computed(() => {
  const count = lunarMonth.value === 12 ? 30 : 30
  return lunarDayNames.slice(0, count).map((label, i) => ({ label, value: i + 1 }))
})

const lunarDateLabel = computed(() => {
  return `农历${lunarMonthNames[lunarMonth.value - 1]}${lunarDayNames[lunarDay.value - 1]}`
})

function handleLunarChange(val: boolean | string | number) {
  if (val) {
    lunarMonth.value = 1
    lunarDay.value = 1
    lunarTime.value = '09:00'
  }
}

function lunarToSolarStartTime(): string {
  const mm = String(lunarMonth.value).padStart(2, '0')
  const dd = String(lunarDay.value).padStart(2, '0')
  const year = new Date().getFullYear()
  const lunarDateStr = `${year}-${mm}-${dd}`
  try {
    const result = (window as any).electronAPI.lunarToSolar(lunarDateStr)
    if (result) {
      return `${result}T${lunarTime.value || '09:00'}:00`
    }
  } catch { /* ignore */ }
  // 回退：用当年公历近似
  return `${year}-${mm}-${dd}T${lunarTime.value || '09:00'}:00`
}

const weekdayOptions = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 0 }
]

const commonEmojis = [
  '🔔', '💧', '💊', '🏃', '📖', '☕', '🍎', '😴',
  '📧', '📞', '🎯', '✅', '⏰', '🌟', '💪', '🧘',
  '🍽️', '🚿', '👀', '🧠', '💡', '📝', '🎵', '🌸',
  '🎂', '🎁', '🎉', '❤️', '📅', '🏠', '🚗', '✈️'
]

const presetColors = [
  '#409EFF', '#67C23A', '#E6A23C', '#F56C6C',
  '#909399', '#00BCD4', '#9C27B0', '#FF5722'
]

const form = ref({
  title: '',
  description: '',
  icon: '🔔',
  color: '#409EFF',
  remind_type: 'interval' as 'interval' | 'scheduled',
  interval_value: 60,
  interval_unit: 'minutes' as 'minutes' | 'hours' | 'days' | 'months' | 'years',
  weekdays: [] as number[],
  workday_only: 0,
  holiday_only: 0,
  is_lunar: false,
  lunar_repeat: false,
  solar_repeat: false,
  start_time: '',
  end_time: null as string | null,
  channels: ['desktop'] as string[]
})

const rules = {
  title: [{ required: true, message: '请输入提醒标题', trigger: 'blur' }],
  interval_value: [{ required: true, message: '请设置提醒间隔', trigger: 'change' }],
  start_time: [{ required: true, message: '请选择时间', trigger: 'change' }],
  channels: [{ required: true, message: '请选择至少一个通知渠道', trigger: 'change', type: 'array', min: 1 }]
}

function handleTypeChange(type: string | number | boolean) {
  if (type === 'scheduled') {
    form.value.interval_value = 1
    form.value.interval_unit = 'days'
    form.value.end_time = null
    form.value.weekdays = []
    form.value.workday_only = 0
    form.value.holiday_only = 0
    form.value.is_lunar = false
    form.value.lunar_repeat = false
    form.value.solar_repeat = false
    activeStart.value = null
    activeEnd.value = null
    executionDayMode.value = 'all'
    const now = new Date()
    scheduledDate.value = now.toISOString().slice(0, 10)
    scheduledTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  } else {
    form.value.interval_value = 60
    form.value.interval_unit = 'minutes'
    form.value.is_lunar = false
    form.value.lunar_repeat = false
    form.value.solar_repeat = false
  }
}

function initForm() {
  // 加载通知渠道配置
  notificationsStore.fetchConfigs()

  if (props.reminder) {
    const r = props.reminder
    let weekdays: number[] = []
    if (r.weekdays) {
      try { weekdays = JSON.parse(r.weekdays) } catch { /* ignore */ }
    }
    form.value = {
      title: r.title,
      description: r.description,
      icon: r.icon,
      color: r.color,
      remind_type: r.remind_type || 'interval',
      interval_value: r.interval_value,
      interval_unit: r.interval_unit,
      weekdays,
      workday_only: r.workday_only || 0,
      holiday_only: r.holiday_only || 0,
      is_lunar: !!r.lunar_date,
      lunar_repeat: !!r.lunar_date,
      solar_repeat: false,
      start_time: r.start_time,
      end_time: r.end_time,
      channels: (() => { try { return JSON.parse(r.channels) } catch { return ['desktop'] } })()
    }
    activeStart.value = r.active_hours_start
    activeEnd.value = r.active_hours_end

    // 解析公历日期和时间
    if (r.start_time) {
      scheduledDate.value = r.start_time.slice(0, 10)
      scheduledTime.value = r.start_time.slice(11, 16) || '09:00'
    }

    // 恢复执行日模式
    if (r.workday_only) {
      executionDayMode.value = 'workday'
    } else if (r.holiday_only) {
      executionDayMode.value = 'holiday'
    } else if (weekdays.length > 0) {
      executionDayMode.value = 'weekdays'
    } else {
      executionDayMode.value = 'all'
    }

    // 恢复农历日期
    if (r.lunar_date) {
      const parts = r.lunar_date.split('-')
      lunarMonth.value = parseInt(parts[0]) || 1
      lunarDay.value = parseInt(parts[1]) || 1
    }
  } else {
    form.value = {
      title: '',
      description: '',
      icon: '🔔',
      color: '#409EFF',
      remind_type: 'interval',
      interval_value: 1,
      interval_unit: 'minutes',
      weekdays: [],
      workday_only: 0,
      holiday_only: 0,
      is_lunar: false,
      lunar_repeat: false,
      start_time: new Date().toISOString().slice(0, 19),
      end_time: null,
      channels: ['desktop']
    }
    activeStart.value = null
    activeEnd.value = null
    executionDayMode.value = 'all'
    lunarMonth.value = 1
    lunarDay.value = 1
    lunarTime.value = '09:00'
    const now = new Date()
    scheduledDate.value = now.toISOString().slice(0, 10)
    scheduledTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  }
}

async function handleSave() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) return

    saving.value = true
    try {
      const data: any = {
        ...form.value,
        weekdays: form.value.weekdays.length > 0 ? form.value.weekdays : null,
        active_hours_start: form.value.remind_type === 'interval' ? (activeStart.value || null) : null,
        active_hours_end: form.value.remind_type === 'interval' ? (activeEnd.value || null) : null,
        lunar_date: null
      }

      if (form.value.remind_type === 'scheduled') {
        data.end_time = null
        data.active_hours_start = null
        data.active_hours_end = null
        data.weekdays = null

        if (form.value.is_lunar) {
          const mm = String(lunarMonth.value).padStart(2, '0')
          const dd = String(lunarDay.value).padStart(2, '0')
          data.lunar_date = `${mm}-${dd}`

          // 通过 IPC 转换农历到阳历来计算 start_time
          try {
            const solarDate = await window.electronAPI.lunarToSolar(
              `${new Date().getFullYear()}-${mm}-${dd}`
            )
            if (solarDate) {
              data.start_time = `${solarDate}T${lunarTime.value || '09:00'}:00`
            }
          } catch { /* use form start_time as fallback */ }

          if (form.value.lunar_repeat) {
            // 每年农历提醒 = 循环提醒，间隔1年
            data.remind_type = 'interval'
            data.interval_value = 1
            data.interval_unit = 'years'
          }
        } else {
          // 公历：合并日期+时间
          data.start_time = `${scheduledDate.value}T${scheduledTime.value || '09:00'}:00`
          data.workday_only = 0
          data.holiday_only = 0

          if (form.value.solar_repeat) {
            // 每年公历提醒 = 循环提醒，间隔1年
            data.remind_type = 'interval'
            data.interval_value = 1
            data.interval_unit = 'years'
          }
        }
      }

      // 清除不相关字段
      delete data.is_lunar
      delete data.lunar_repeat
      delete data.solar_repeat

      if (isEdit.value && props.reminder) {
        await remindersStore.updateReminder(props.reminder.id, data)
        ElMessage.success('修改成功')
      } else {
        await remindersStore.createReminder(data)
        ElMessage.success('创建成功')
      }

      emit('update:visible', false)
      emit('saved')
    } catch (err: any) {
      ElMessage.error(err.message || '操作失败')
    } finally {
      saving.value = false
    }
  })
}
</script>

<style scoped>
.dialog-scroll-body {
  max-height: 55vh;
  overflow-y: auto;
  padding: 0 4px;
}

.form-row {
  display: flex;
  gap: 16px;
}

.form-item-sm {
  width: auto;
}

.flex-1 {
  flex: 1;
}

.interval-picker {
  display: flex;
  gap: 8px;
}

.icon-picker-btn {
  font-size: 20px;
  width: 40px;
  height: 40px;
  padding: 0;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
}

.icon-option {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 6px;
  font-size: 16px;
  transition: background 0.15s;
}

.icon-option:hover {
  background: var(--bg-hover);
}

.icon-option.active {
  background: var(--color-primary-bg);
}

.time-range {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.time-separator {
  color: var(--text-tertiary);
  font-size: 13px;
  flex-shrink: 0;
}

.form-tip {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.channel-disabled-tip {
  font-size: 11px;
  color: var(--text-placeholder);
}

.channel-checkbox-img {
  width: 14px;
  height: 14px;
  border-radius: 2px;
  vertical-align: middle;
}

.lunar-picker {
  display: flex;
  gap: 8px;
}
</style>
