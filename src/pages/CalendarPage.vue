<template>
  <div class="calendar-page">
    <div class="page-head">
      <div>
        <h1>日历</h1>
        <p class="page-subtitle">{{ monthTitle }}，今天 {{ todayLabel }}</p>
      </div>
      <div class="head-actions">
        <button class="icon-btn" type="button" title="上个月" @click="changeMonth(-1)">
          <el-icon :size="17"><ArrowLeft /></el-icon>
        </button>
        <button class="today-btn" type="button" @click="goToday">本月</button>
        <button class="icon-btn" type="button" title="下个月" @click="changeMonth(1)">
          <el-icon :size="17"><ArrowRight /></el-icon>
        </button>
        <button class="icon-btn" type="button" title="刷新" @click="refresh">
          <el-icon :size="17"><Refresh /></el-icon>
        </button>
      </div>
    </div>

    <section class="month-panel">
      <div class="weekday-row">
        <span v-for="day in weekdays" :key="day">{{ day }}</span>
      </div>

      <div v-if="isLoading" class="state-wrap">
        <el-icon class="loading-icon" :size="26"><Loading /></el-icon>
        <span>加载中...</span>
      </div>

      <div v-else class="month-grid">
        <div
          v-for="day in calendarDays"
          :key="day.key"
          class="day-cell"
          :style="day.gridColumnStart ? {gridColumnStart: day.gridColumnStart} : undefined"
          :class="{
            today: day.key === todayKey,
            selected: day.key === selectedDate
          }"
          role="button"
          tabindex="0"
          @click="handleDayClick(day.key)"
          @keydown.enter.prevent="handleDayClick(day.key)"
        >
          <div class="day-top">
            <span class="day-num">{{ day.day }}</span>
            <span class="cell-add-wrap" @click.stop>
              <el-dropdown trigger="click" placement="bottom-end" @command="(type: CalendarEventType) => openQuickAdd(type, day.key)">
                <button class="cell-add" type="button" title="快速添加">
                  <el-icon :size="13"><Plus /></el-icon>
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="todo">
                      <el-icon><List /></el-icon>
                      待办
                    </el-dropdown-item>
                    <el-dropdown-item command="meeting">
                      <el-icon><Memo /></el-icon>
                      会议
                    </el-dropdown-item>
                    <el-dropdown-item command="reminder">
                      <el-icon><Bell /></el-icon>
                      提醒
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </span>
          </div>

          <div v-if="eventsByDate[day.key]?.length" class="event-stack">
            <div
              v-for="event in eventsByDate[day.key]"
              :key="event.key"
              class="event-pill"
              :class="[event.type, {done: event.done}]"
              :title="`${event.typeLabel}${event.time ? ' ' + event.time : ''}：${event.title}`"
              @click.stop="openEventDetail(event)"
            >
              <span v-if="event.time" class="event-time">{{ event.time }}</span>
              <span class="event-title">{{ event.title }}</span>
            </div>
            <button
              v-if="eventsByDate[day.key].length > visibleEventLimit"
              class="more-count"
              type="button"
              @click.stop="openDayEvents(day.key)"
            >
              +{{ eventsByDate[day.key].length - visibleEventLimit }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <el-dialog v-model="dayEventsVisible" width="420px" :title="dayEventsTitle">
      <div v-if="dayEventGroups.length" class="day-events-list">
        <section v-for="group in dayEventGroups" :key="group.type" class="day-event-group">
          <div class="group-head" :class="group.type">
            <span>{{ group.label }}</span>
            <span>{{ group.events.length }}</span>
          </div>
          <div
            v-for="event in group.events"
            :key="event.key"
            class="day-event-row"
            :class="[event.type, {done: event.done}]"
            role="button"
            tabindex="0"
            @click="openEventDetail(event)"
            @keydown.enter.prevent="openEventDetail(event)"
          >
            <span v-if="event.time" class="row-time">{{ event.time }}</span>
            <span class="row-title">{{ event.title }}</span>
            <span v-if="event.extra" class="row-extra">{{ event.extra }}</span>
            <button
              v-if="event.type === 'todo'"
              class="todo-complete-btn"
              :class="{done: event.done}"
              type="button"
              :title="event.done ? '取消完成' : '完成待办'"
              @click.stop="toggleTodoEvent(event)"
            >
              <el-icon :size="12"><Check /></el-icon>
              <span>{{ event.done ? '已完成' : '完成' }}</span>
            </button>
          </div>
        </section>
      </div>
    </el-dialog>

    <el-dialog v-model="eventDetailVisible" width="460px" destroy-on-close>
      <template #header>
        <div v-if="selectedEvent" class="detail-head" :class="selectedEvent.type">
          <span class="detail-type">{{ selectedEvent.typeLabel }}</span>
          <span v-if="selectedEvent.done" class="detail-state">已完成</span>
        </div>
      </template>

      <div v-if="selectedEvent" class="event-detail">
        <h2>{{ selectedEvent.title }}</h2>
        <div class="detail-meta">
          <span>{{ formatDateLabel(selectedEvent.date) }}</span>
          <span v-if="selectedEvent.time">{{ selectedEvent.time }}</span>
          <span v-if="selectedEvent.extra">{{ selectedEvent.extra }}</span>
        </div>
        <p v-if="selectedEvent.description" class="detail-desc">{{ selectedEvent.description }}</p>
        <div v-else class="detail-empty">暂无备注</div>
      </div>

      <template #footer>
        <el-button size="small" @click="eventDetailVisible = false">关闭</el-button>
        <el-button
          v-if="selectedEvent?.type === 'todo'"
          size="small"
          :type="selectedEvent.done ? 'default' : 'success'"
          @click="toggleTodoEvent(selectedEvent)"
        >
          {{ selectedEvent.done ? '标记未完成' : '标记完成' }}
        </el-button>
        <el-button v-if="selectedEvent" size="small" type="primary" @click="openSource(selectedEvent)">去查看</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {computed, onActivated, onMounted, ref} from 'vue'
import {useRouter} from 'vue-router'
import {useTodosStore} from '@/stores/todos'
import {useMeetingsStore} from '@/stores/meetings'
import {useRemindersStore} from '@/stores/reminders'
import type {Todo} from '@/types/todo'
import type {Meeting} from '@/types/meeting'
import type {Reminder} from '@/types/reminder'
import {ArrowLeft, ArrowRight, Bell, Check, List, Loading, Memo, Plus, Refresh} from '@element-plus/icons-vue'

type CalendarEventType = 'todo' | 'meeting' | 'reminder'

interface CalendarEvent {
  key: string
  id: number
  type: CalendarEventType
  typeLabel: string
  date: string
  time: string
  title: string
  description: string
  extra: string
  done: boolean
}

interface CalendarDay {
  key: string
  day: number
  gridColumnStart?: number
}

const router = useRouter()
const todosStore = useTodosStore()
const meetingsStore = useMeetingsStore()
const remindersStore = useRemindersStore()
const viewDate = ref(startOfMonth(new Date()))
const selectedDate = ref(dateKey(new Date()))
const dayEventsVisible = ref(false)
const dayEventsDate = ref('')
const eventDetailVisible = ref(false)
const selectedEvent = ref<CalendarEvent | null>(null)
const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const visibleEventLimit = 3

const isLoading = computed(() => todosStore.loading || meetingsStore.loading || remindersStore.loading)
const todayKey = computed(() => dateKey(new Date()))
const monthStartKey = computed(() => dateKey(viewDate.value))
const monthEndKey = computed(() => dateKey(endOfMonth(viewDate.value)))
const monthTitle = computed(() => `${viewDate.value.getFullYear()} 年 ${viewDate.value.getMonth() + 1} 月`)
const selectedDateLabel = computed(() => {
  const date = parseDateKey(selectedDate.value)
  return date.toLocaleDateString('zh-CN', {month: 'long', day: 'numeric', weekday: 'long'})
})
const todayLabel = computed(() => {
  return new Date().toLocaleDateString('zh-CN', {month: 'long', day: 'numeric', weekday: 'long'})
})
const dayEvents = computed(() => eventsByDate.value[dayEventsDate.value] || [])
const dayEventGroups = computed(() => {
  const order: Array<{type: CalendarEventType; label: string}> = [
    {type: 'meeting', label: '会议'},
    {type: 'reminder', label: '提醒'},
    {type: 'todo', label: '待办'}
  ]
  return order
    .map(group => ({
      ...group,
      events: dayEvents.value.filter(event => event.type === group.type)
    }))
    .filter(group => group.events.length > 0)
})
const dayEventsTitle = computed(() => {
  if (!dayEventsDate.value) return '全部事项'
  const date = parseDateKey(dayEventsDate.value)
  return date.toLocaleDateString('zh-CN', {month: 'long', day: 'numeric', weekday: 'long'})
})

const monthEvents = computed<CalendarEvent[]>(() => {
  const start = monthStartKey.value
  const end = monthEndKey.value
  return [
    ...todosStore.todos.map(todoToEvent).filter(isEventInRange(start, end)),
    ...meetingsStore.meetings.map(meetingToEvent).filter(isEventInRange(start, end)),
    ...remindersStore.reminders.map(reminderToEvent).filter((event): event is CalendarEvent => {
      return !!event && event.date >= start && event.date <= end
    })
  ].sort(sortEvents)
})

const eventsByDate = computed<Record<string, CalendarEvent[]>>(() => {
  const groups: Record<string, CalendarEvent[]> = {}
  for (const event of monthEvents.value) {
    if (!groups[event.date]) groups[event.date] = []
    groups[event.date].push(event)
  }
  for (const key of Object.keys(groups)) groups[key].sort(sortEvents)
  return groups
})

const calendarDays = computed<CalendarDay[]>(() => {
  const first = startOfMonth(viewDate.value)
  const last = endOfMonth(viewDate.value)
  const firstColumn = (first.getDay() + 6) % 7 + 1
  const days: CalendarDay[] = []
  for (let day = 1; day <= last.getDate(); day++) {
    const date = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth(), day)
    days.push({
      key: dateKey(date),
      day,
      gridColumnStart: day === 1 ? firstColumn : undefined
    })
  }
  return days
})

function todoToEvent(todo: Todo): CalendarEvent {
  return {
    key: `todo-${todo.id}`,
    id: todo.id,
    type: 'todo',
    typeLabel: '待办',
    date: todo.due_date || todayKey.value,
    time: '',
    title: todo.title,
    description: todo.description || '',
    extra: priorityLabel(todo.priority),
    done: todo.completed === 1
  }
}

function meetingToEvent(meeting: Meeting): CalendarEvent {
  return {
    key: `meeting-${meeting.id}`,
    id: meeting.id,
    type: 'meeting',
    typeLabel: '会议',
    date: datePart(meeting.start_time),
    time: timePart(meeting.start_time),
    title: meeting.title,
    description: meeting.description || meeting.minutes || '',
    extra: meeting.location || statusLabel(meeting.status),
    done: meeting.status === 'completed'
  }
}

function reminderToEvent(reminder: Reminder): CalendarEvent | null {
  const sourceTime = reminder.next_trigger_at || (reminder.remind_type === 'scheduled' ? reminder.start_time : '')
  if (!sourceTime || reminder.is_active !== 1) return null
  return {
    key: `reminder-${reminder.id}`,
    id: reminder.id,
    type: 'reminder',
    typeLabel: '提醒',
    date: datePart(sourceTime),
    time: timePart(sourceTime),
    title: reminder.title,
    description: reminder.description || '',
    extra: reminder.remind_type === 'scheduled' ? '定时提醒' : intervalLabel(reminder),
    done: false
  }
}

function isEventInRange(start: string, end: string) {
  return (event: CalendarEvent) => event.date >= start && event.date <= end
}

function sortEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date)
  if (a.time !== b.time) return (a.time || '99:99').localeCompare(b.time || '99:99')
  const order: Record<CalendarEventType, number> = {meeting: 0, reminder: 1, todo: 2}
  return order[a.type] - order[b.type]
}

function changeMonth(offset: number) {
  const next = new Date(viewDate.value)
  next.setMonth(next.getMonth() + offset)
  viewDate.value = startOfMonth(next)
  selectedDate.value = monthStartKey.value
  refresh()
}

function goToday() {
  const today = new Date()
  viewDate.value = startOfMonth(today)
  selectedDate.value = dateKey(today)
  refresh()
}

function selectDay(key: string) {
  selectedDate.value = key
  const date = parseDateKey(key)
  if (date.getMonth() !== viewDate.value.getMonth() || date.getFullYear() !== viewDate.value.getFullYear()) {
    viewDate.value = startOfMonth(date)
    refresh()
  }
}

function handleDayClick(key: string) {
  selectDay(key)
  if ((eventsByDate.value[key]?.length || 0) > 0) {
    openDayEvents(key)
  }
}

function openDayEvents(key: string) {
  selectedDate.value = key
  dayEventsDate.value = key
  dayEventsVisible.value = true
}

function openQuickAdd(type: CalendarEventType, date = selectedDate.value) {
  selectDay(date)
  const routeMap: Record<CalendarEventType, string> = {
    todo: '/todos',
    meeting: '/meetings',
    reminder: '/reminders'
  }
  router.push({path: routeMap[type], query: {create: 'calendar', type, date}})
}

function openEventDetail(event: CalendarEvent) {
  selectedEvent.value = event
  eventDetailVisible.value = true
}

async function toggleTodoEvent(event: CalendarEvent) {
  if (event.type !== 'todo') return
  await todosStore.toggleTodo(event.id)
  const latest = monthEvents.value.find(item => item.key === event.key)
  if (latest) {
    selectedEvent.value = latest
  } else if (selectedEvent.value?.key === event.key) {
    selectedEvent.value = {
      ...event,
      done: !event.done,
      extra: event.extra
    }
  }
}

async function refresh() {
  await Promise.all([
    todosStore.fetchTodos(),
    meetingsStore.fetchMeetings({start_date: monthStartKey.value, end_date: monthEndKey.value}),
    remindersStore.fetchReminders({is_active: 1})
  ])
}

function openSource(event: CalendarEvent) {
  const routeMap: Record<CalendarEventType, string> = {
    todo: '/todos',
    meeting: '/meetings',
    reminder: '/reminders'
  }
  router.push(routeMap[event.type])
}

function formatDateLabel(value: string): string {
  const date = parseDateKey(value)
  return date.toLocaleDateString('zh-CN', {year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'})
}

function priorityLabel(priority: string): string {
  return ({urgent: '紧急', high: '重要', normal: '普通', low: '低'} as Record<string, string>)[priority] || '普通'
}

function statusLabel(status: string): string {
  return ({pending: '未开始', ongoing: '进行中', completed: '已结束'} as Record<string, string>)[status] || status
}

function intervalLabel(reminder: Reminder): string {
  const unitMap: Record<string, string> = {minutes: '分钟', hours: '小时', days: '天', months: '月', years: '年'}
  return `每 ${reminder.interval_value} ${unitMap[reminder.interval_unit] || reminder.interval_unit}`
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function dateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function datePart(value: string | null): string {
  if (!value) return dateKey(new Date())
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]
  return dateKey(new Date(value))
}

function timePart(value: string | null): string {
  if (!value) return ''
  const match = String(value).match(/[T\s](\d{2}:\d{2})/)
  if (match) return match[1]
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})
}

onMounted(refresh)
onActivated(refresh)
</script>

<style scoped>
.calendar-page {
  width: min(100%, 1180px);
  height: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  flex-shrink: 0;
  margin-bottom: 14px;
}

.page-head h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}

.page-subtitle {
  margin-top: 6px;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.4;
}

.head-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-shrink: 0;
}

.icon-btn,
.today-btn,
.day-cell,
.cell-add,
.more-count,
.day-event-row,
.todo-complete-btn {
  border: 0;
  font: inherit;
  cursor: pointer;
}

.icon-btn,
.today-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  border: 1px solid var(--border-color-light);
  border-radius: 7px;
  background: var(--bg-card);
  color: var(--text-secondary);
  transition: border-color .15s ease, color .15s ease, background .15s ease;
}

.icon-btn {
  width: 32px;
}

.today-btn {
  padding: 0 12px;
  font-size: 12px;
}

.icon-btn:hover,
.today-btn:hover {
  border-color: currentColor;
  background: var(--bg-hover);
}

.month-panel {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color-light);
  border-radius: 8px;
  background: var(--bg-card);
}

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  min-height: 38px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-color-light);
  background: var(--bg-secondary);
}

.weekday-row span {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 600;
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  flex: 1;
  min-height: 0;
}

.day-cell {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: 5px;
  overflow: hidden;
  padding: 8px 8px 7px;
  border-right: 1px solid var(--border-color-light);
  border-bottom: 1px solid var(--border-color-light);
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  transition: background .15s ease, box-shadow .15s ease;
}

.day-cell:hover {
  background: var(--bg-hover);
}

.day-cell.selected {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--color-primary) 62%, transparent);
}

.day-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
}

.day-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
}

.day-cell.today .day-num {
  background: var(--color-primary);
  color: #fff;
}

.cell-add,
.cell-add-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.cell-add {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: transparent;
  color: var(--text-placeholder);
  opacity: 0;
  transition: opacity .15s ease, background .15s ease, color .15s ease;
}

.day-cell:hover .cell-add,
.day-cell.selected .cell-add {
  opacity: 1;
}

.cell-add:hover {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.event-stack {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  padding-right: 2px;
  overscroll-behavior: contain;
}

.event-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  min-height: 21px;
  padding: 2px 6px;
  border-radius: 5px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.2;
  text-align: left;
}

.event-pill.todo {
  background: rgba(103, 194, 58, .11);
  color: var(--color-success);
}

.event-pill.meeting {
  background: rgba(64, 158, 255, .11);
  color: var(--color-primary);
}

.event-pill.reminder {
  background: rgba(230, 162, 60, .12);
  color: var(--color-warning);
}

.event-pill.done {
  opacity: .62;
}

.event-time {
  flex: 0 0 auto;
  color: currentColor;
  font-weight: 700;
}

.event-title {
  overflow: hidden;
  min-width: 0;
  color: var(--text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-count {
  align-self: flex-start;
  padding: 0 8px;
  border-radius: 5px;
  background: transparent;
  color: var(--text-placeholder);
  font-size: 11px;
  line-height: 20px;
}

.more-count:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.day-events-list {
  display: flex;
  max-height: 420px;
  flex-direction: column;
  gap: 14px;
  overflow: auto;
}

.day-event-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 700;
}

.group-head.meeting {
  color: var(--color-primary);
}

.group-head.reminder {
  color: var(--color-warning);
}

.group-head.todo {
  color: var(--color-success);
}

.day-event-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 36px;
  padding: 8px 10px;
  border: 1px solid var(--border-color-light);
  border-radius: 7px;
  background: var(--bg-card);
  color: var(--text-primary);
  text-align: left;
}

.day-event-row:hover {
  background: var(--bg-hover);
}

.day-event-row.todo .row-type {
  color: var(--color-success);
}

.day-event-row.meeting .row-type {
  color: var(--color-primary);
}

.day-event-row.reminder .row-type {
  color: var(--color-warning);
}

.day-event-row.done {
  opacity: .62;
}

.day-event-row.done .row-title {
  text-decoration: line-through;
}

.row-time,
.row-extra {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 700;
}

.row-time,
.row-extra {
  color: var(--text-tertiary);
}

.row-time {
  font-variant-numeric: tabular-nums;
}

.row-extra {
  overflow: hidden;
  max-width: 120px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-title {
  overflow: hidden;
  min-width: 0;
  flex: 1;
  color: var(--text-primary);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-complete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 24px;
  flex: 0 0 auto;
  padding: 0 8px;
  border-radius: 5px;
  background: rgba(103, 194, 58, .11);
  color: var(--color-success);
  font-size: 12px;
  font-weight: 700;
}

.todo-complete-btn:hover {
  background: rgba(103, 194, 58, .18);
}

.todo-complete-btn.done {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
}

.detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-type,
.detail-state {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 700;
}

.detail-head.todo .detail-type {
  background: rgba(103, 194, 58, .11);
  color: var(--color-success);
}

.detail-head.meeting .detail-type {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.detail-head.reminder .detail-type {
  background: rgba(230, 162, 60, .12);
  color: var(--color-warning);
}

.detail-state {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
}

.event-detail h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 18px;
  line-height: 1.45;
  word-break: break-word;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.detail-desc {
  margin-top: 16px;
  padding: 12px;
  border-radius: 7px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-empty {
  margin-top: 16px;
  color: var(--text-placeholder);
  font-size: 13px;
}

.state-wrap {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px 20px;
  color: var(--text-tertiary);
  font-size: 13px;
  text-align: center;
}

.loading-icon {
  margin-bottom: 10px;
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 720px) {
  .page-head {
    flex-direction: column;
    align-items: stretch;
  }

  .head-actions {
    justify-content: flex-start;
  }

  .month-grid {
    grid-auto-rows: minmax(72px, 1fr);
  }

  .day-cell {
    padding: 7px 5px;
  }
}
</style>
