<template>
  <div class="todos-page" @paste="handlePaste" tabindex="0" ref="pageRef">
    <div class="page-head">
      <div>
        <h1>待办</h1>
        <p v-if="todosStore.stats.pending" class="page-subtitle">
          {{ todosStore.stats.pending }} 项待处理
          <span v-if="todosStore.stats.overdue">，{{ todosStore.stats.overdue }} 项已逾期</span>
        </p>
      </div>
      <div class="head-actions">
        <button
          v-for="f in filterOptions"
          :key="f.value"
          class="filter-btn"
          :class="{ active: statusFilter === f.value }"
          type="button"
          @click="setFilter(f.value)"
        >
          {{ f.label }}
        </button>
      </div>
    </div>

    <section class="composer" :class="{ active: newTitle.trim() || newDescription.trim() }">
      <div class="composer-main">
        <textarea
          ref="addInputRef"
          v-model="newTitle"
          class="composer-input"
          placeholder="写下你的待办事项..."
          rows="1"
          @keydown.enter.exact.prevent="handleAdd"
        />
        <button class="submit-btn" type="button" :disabled="!newTitle.trim()" title="提交待办" @click="handleAdd">
          <el-icon :size="18"><Back /></el-icon>
        </button>
      </div>

      <textarea
        v-if="showDescription || newDescription.trim()"
        v-model="newDescription"
        class="description-input"
        placeholder="补充描述..."
        rows="2"
      />

      <div v-if="pasteImages.length" class="paste-row">
        <div v-for="(img, i) in pasteImages" :key="i" class="paste-thumb">
          <img :src="img" alt="待办图片" />
          <button type="button" title="移除图片" @click="pasteImages.splice(i, 1)">
            <el-icon :size="11"><Close /></el-icon>
          </button>
        </div>
      </div>

      <div class="composer-tools">
        <button class="tool-btn" :class="{ active: newDueDate }" type="button" @click="cycleDueDate">
          <el-icon :size="14"><Calendar /></el-icon>
          <span>{{ dueDateLabel }}</span>
        </button>
        <el-date-picker
          ref="datePickerRef"
          v-model="customDate"
          type="date"
          value-format="YYYY-MM-DD"
          size="small"
          style="position: absolute; visibility: hidden; width: 0; height: 0"
          :disabled-date="disablePastDate"
          @change="onCustomDate"
        />
        <button class="tool-btn" :class="{ active: showDescription || newDescription.trim() }" type="button" @click="showDescription = !showDescription">
          <el-icon :size="14"><Document /></el-icon>
          <span>描述</span>
        </button>
        <button class="tool-btn priority-btn" :class="newPriority" type="button" @click="cyclePriority">
          <el-icon :size="14"><Flag /></el-icon>
          <span>{{ priLabel(newPriority) }}</span>
        </button>
      </div>
    </section>

    <section class="todo-panel">
      <div class="panel-top">
        <div>
          <span class="panel-title">待办事项</span>
          <span class="panel-count">{{ visibleTodoCount }} 项</span>
        </div>
        <button class="refresh-btn" type="button" title="刷新" @click="refreshTodos">
          <el-icon :size="16"><Refresh /></el-icon>
        </button>
      </div>

      <div v-if="todosStore.loading" class="state-wrap">
        <el-icon class="loading-icon" :size="26"><Loading /></el-icon>
        <span>加载中...</span>
      </div>

      <template v-else-if="visibleGroups.length">
        <div class="todo-groups">
          <div v-for="group in visibleGroups" :key="group.key" class="group">
            <div class="group-head">
              <span class="group-name" :class="group.key">{{ group.label }}</span>
              <span class="group-num">{{ group.items.length }}</span>
            </div>
            <article
              v-for="todo in group.items"
              :key="todo.id"
              class="todo-item"
              :class="{ done: todo.completed === 1, ['p-' + todo.priority]: todo.completed === 0 }"
            >
              <button class="check" type="button" title="切换完成状态" @click="handleToggle(todo.id)">
                <span v-if="todo.completed === 1" class="check-on">
                  <el-icon :size="12"><Check /></el-icon>
                </span>
                <span v-else class="check-off"></span>
              </button>

              <div class="item-body" @click="openEdit(todo)">
                <div class="item-title">{{ todo.title }}</div>
                <p v-if="todo.description" class="item-desc">{{ todo.description }}</p>
                <div class="item-meta">
                  <span v-if="todo.due_date" class="meta-tag date-tag" :class="{ late: isOverdue(todo) }">
                    <el-icon :size="12"><Calendar /></el-icon>
                    {{ fmtDate(todo.due_date) }}
                  </span>
                  <button
                    v-if="todo.completed === 0 && todo.priority !== 'normal'"
                    class="meta-tag pri-tag"
                    :class="todo.priority"
                    type="button"
                    @click.stop="cycleTodoPriority(todo)"
                  >
                    {{ priLabel(todo.priority) }}
                  </button>
                  <span v-if="todoImages(todo).length" class="meta-tag">
                    <el-icon :size="12"><Picture /></el-icon>
                    {{ todoImages(todo).length }}
                  </span>
                </div>
                <div v-if="todoImages(todo).length" class="imgs">
                  <img
                    v-for="(img, i) in todoImages(todo).slice(0, 3)"
                    :key="i"
                    :src="img"
                    alt="待办图片"
                    @click.stop="previewImage(img)"
                  />
                </div>
              </div>

              <button class="item-del" type="button" title="删除" @click.stop="handleDeleteTodo(todo)">
                <el-icon :size="15"><Delete /></el-icon>
              </button>
            </article>
          </div>
        </div>
      </template>

      <div v-else class="state-wrap empty">
        <div class="empty-illustration" aria-hidden="true">
          <div class="empty-card">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div class="empty-plant"></div>
        </div>
        <strong>随时记录待办，有序处理工作</strong>
        <p>可以为自己添加日期、优先级和描述，后续集中处理。</p>
      </div>

      <div v-if="completedCount && statusFilter !== 'completed'" class="completed-toggle-row">
        <button class="completed-toggle" type="button" @click="showCompleted = !showCompleted">
          {{ showCompleted ? '隐藏已完成事项' : '显示已完成事项' }}
          <el-icon :size="13" :class="{ expanded: showCompleted }"><ArrowDown /></el-icon>
        </button>
      </div>
    </section>

    <el-dialog
      v-model="editVisible"
      width="440px"
      :close-on-click-modal="true"
      destroy-on-close
      class="todo-edit-dialog"
    >
      <template #header>
        <div class="dialog-head">
          <button class="edit-check" type="button" @click="editForm.completed = editForm.completed === 1 ? 0 : 1">
            <span v-if="editForm.completed === 1" class="check-on">
              <el-icon :size="12"><Check /></el-icon>
            </span>
            <span v-else class="check-off"></span>
          </button>
          <span>{{ editForm.completed === 1 ? '已完成' : '待处理' }}</span>
        </div>
      </template>

      <textarea v-model="editForm.title" class="edit-title" placeholder="待办内容" rows="2" />
      <textarea v-model="editForm.description" class="edit-description" placeholder="描述" rows="3" />

      <div class="edit-row">
        <span class="edit-label">截止时间</span>
        <div class="edit-chips">
          <button
            v-for="opt in dueOptions"
            :key="opt.value"
            class="chip"
            :class="{ active: editForm.due_date === opt.value }"
            type="button"
            @click="editForm.due_date = opt.value"
          >
            {{ opt.label }}
          </button>
          <el-date-picker
            v-model="editCustomDate"
            type="date"
            value-format="YYYY-MM-DD"
            size="small"
            placeholder="选日期"
            style="width: 116px"
            :disabled-date="disablePastDate"
            @change="(v: string) => { editForm.due_date = v || '' }"
          />
        </div>
      </div>

      <div class="edit-row">
        <span class="edit-label">优先级</span>
        <div class="edit-chips">
          <button
            v-for="opt in priOptions"
            :key="opt.value"
            class="chip pri"
            :class="[opt.value, { active: editForm.priority === opt.value }]"
            type="button"
            @click="editForm.priority = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div v-if="editForm.images.length" class="edit-row">
        <span class="edit-label">图片</span>
        <div class="edit-imgs">
          <div v-for="(img, i) in editForm.images" :key="i" class="ei">
            <img :src="img" alt="待办图片" @click.stop="previewImage(img)" />
            <button type="button" title="移除图片" @click="editForm.images.splice(i, 1)">
              <el-icon :size="11"><Close /></el-icon>
            </button>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button size="small" @click="editVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <el-image-viewer v-if="previewVisible" :url-list="[previewUrl]" @close="previewVisible = false" />
  </div>
</template>

<script setup lang="ts">
import {computed, nextTick, onActivated, onMounted, reactive, ref, watch} from 'vue'
import {useTodosStore} from '@/stores/todos'
import {
  ArrowDown,
  Back,
  Calendar,
  Check,
  Close,
  Delete,
  Document,
  Flag,
  Loading,
  Picture,
  Refresh
} from '@element-plus/icons-vue'
import {ElImageViewer, ElMessageBox} from 'element-plus'
import type {Todo} from '@/types/todo'

const todosStore = useTodosStore()
const pageRef = ref<HTMLElement>()
const addInputRef = ref<HTMLTextAreaElement>()
const newTitle = ref('')
const newDescription = ref('')
const newPriority = ref<'normal' | 'high' | 'urgent'>('normal')
const newDueDate = ref(dayStr(0))
const dueDateStep = ref(0) // 0=今天 1=明天 2=后天 3=选日期
const customDate = ref('')
const datePickerRef = ref<any>()
const pasteImages = ref<string[]>([])
const statusFilter = ref<'all' | 'pending' | 'completed'>('all')
const showDescription = ref(false)
const showCompleted = ref(false)
const editVisible = ref(false)
const editingTodo = ref<Todo | null>(null)
const editCustomDate = ref('')
const previewVisible = ref(false)
const previewUrl = ref('')

const editForm = reactive({
  title: '',
  description: '',
  completed: 0,
  priority: 'normal' as Todo['priority'],
  due_date: '' as string,
  images: [] as string[]
})

const filterOptions = [
  {label: '全部', value: 'all'},
  {label: '待处理', value: 'pending'},
  {label: '已完成', value: 'completed'}
] as const

const dueOptions = computed(() => [
  {label: '今天', value: dayStr(0)},
  {label: '明天', value: dayStr(1)},
  {label: '后天', value: dayStr(2)},
  {label: '下周', value: dayStr(7)}
])

const priOptions: Array<{ label: string; value: Todo['priority'] }> = [
  {label: '普通', value: 'normal'},
  {label: '重要', value: 'high'},
  {label: '紧急', value: 'urgent'}
]

interface DayGroup {
  key: string
  label: string
  items: Todo[]
}

const groupedTodos = computed<DayGroup[]>(() => {
  const todos = todosStore.todos
  const today = dayStr(0)
  const tomorrow = dayStr(1)
  const overdue: Todo[] = []
  const todayList: Todo[] = []
  const tomorrowList: Todo[] = []
  const upcoming: Todo[] = []
  const completedList: Todo[] = []

  for (const t of todos) {
    if (t.completed === 1) {
      completedList.push(t)
      continue
    }
    if (!t.due_date) {
      todayList.push(t)
      continue
    }
    if (t.due_date < today) {
      overdue.push(t)
      continue
    }
    if (t.due_date === today) {
      todayList.push(t)
      continue
    }
    if (t.due_date === tomorrow) {
      tomorrowList.push(t)
      continue
    }
    upcoming.push(t)
  }

  const groups: DayGroup[] = []
  if (overdue.length) groups.push({key: 'overdue', label: '逾期', items: overdue})
  if (todayList.length) groups.push({key: 'today', label: '今天', items: todayList})
  if (tomorrowList.length) groups.push({key: 'tomorrow', label: '明天', items: tomorrowList})
  if (upcoming.length) groups.push({key: 'upcoming', label: '即将到来', items: upcoming})
  if (completedList.length) groups.push({key: 'completed', label: '已完成', items: completedList})
  return groups
})

const visibleGroups = computed(() => {
  if (statusFilter.value === 'completed') return groupedTodos.value
  if (showCompleted.value) return groupedTodos.value
  return groupedTodos.value.filter(group => group.key !== 'completed')
})

const completedCount = computed(() => groupedTodos.value.find(group => group.key === 'completed')?.items.length || 0)
const visibleTodoCount = computed(() => visibleGroups.value.reduce((sum, group) => sum + group.items.length, 0))

function dayStr(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function disablePastDate(date: Date): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
}

function cyclePriority() {
  const order: Array<'normal' | 'high' | 'urgent'> = ['normal', 'high', 'urgent']
  const currentIndex = order.indexOf(newPriority.value)
  newPriority.value = order[(currentIndex + 1) % order.length]
}

const dueDateLabel = computed(() => {
  if (dueDateStep.value < 3) return ['今天', '明天', '后天'][dueDateStep.value]
  return fmtDate(newDueDate.value)
})

function cycleDueDate() {
  // 已选了具体日期，再次点击重新打开日期选择器
  if (dueDateStep.value === 3) {
    nextTick(() => datePickerRef.value?.handleOpen?.())
    return
  }
  const nextStep = dueDateStep.value + 1
  if (nextStep === 3) {
    // 到"选日期"步骤，弹出日期选择器
    dueDateStep.value = 3
    nextTick(() => datePickerRef.value?.handleOpen?.())
    return
  }
  dueDateStep.value = nextStep
  newDueDate.value = dayStr(nextStep)
}

function onCustomDate(value: string) {
  if (!value) return
  newDueDate.value = value
  dueDateStep.value = 3
  customDate.value = ''
}

const imgCache = new Map<string, string>()

function todoImages(todo: Todo): string[] {
  try {
    return (JSON.parse(todo.images || '[]') as string[]).map(path => imgCache.get(path) || path)
  } catch {
    return []
  }
}

async function resolveImages() {
  const pendingPaths: string[] = []
  for (const todo of todosStore.todos) {
    try {
      for (const path of JSON.parse(todo.images || '[]') as string[]) {
        if (!imgCache.has(path) && !path.startsWith('data:')) pendingPaths.push(path)
      }
    } catch {}
  }
  if (!pendingPaths.length) return
  try {
    const urls = await window.electronAPI.todos.resolveImages(pendingPaths)
    for (let i = 0; i < pendingPaths.length; i++) {
      if (urls[i]) imgCache.set(pendingPaths[i], urls[i])
    }
  } catch {}
}

async function handlePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items
  if (!items) return
  for (const item of Array.from(items)) {
    if (!item.type.startsWith('image/')) continue
    event.preventDefault()
    const file = item.getAsFile()
    if (!file) continue
    pasteImages.value.push(await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    }))
  }
}

async function saveImgs(base64Images: string[]): Promise<string[]> {
  const paths: string[] = []
  for (const image of base64Images) {
    if (image.startsWith('data:')) {
      try {
        const result = await window.electronAPI.ai.saveImages([image])
        if (result?.length) paths.push(...result)
      } catch {}
    } else {
      paths.push(image)
    }
  }
  return paths
}

async function handleAdd() {
  const title = newTitle.value.trim()
  if (!title) return
  const images = pasteImages.value.length ? await saveImgs(pasteImages.value) : []
  await todosStore.createTodo({
    title,
    description: newDescription.value.trim(),
    priority: newPriority.value,
    due_date: newDueDate.value,
    images
  })
  newTitle.value = ''
  newDescription.value = ''
  newPriority.value = 'normal'
  newDueDate.value = dayStr(0)
  dueDateStep.value = 0
  pasteImages.value = []
  showDescription.value = false
  await handleFilterChange()
  addInputRef.value?.focus()
}

async function handleToggle(id: number) {
  await todosStore.toggleTodo(id)
  await handleFilterChange()
}

async function cycleTodoPriority(todo: Todo) {
  const order: Todo['priority'][] = ['normal', 'high', 'urgent']
  const currentIndex = order.indexOf(todo.priority)
  await todosStore.updateTodo(todo.id, {priority: order[(currentIndex + 1) % order.length]})
  await handleFilterChange()
}

function handleDeleteTodo(todo: Todo) {
  ElMessageBox.confirm('确认要删除当前待办吗？', '删除待办', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(async () => {
      await todosStore.deleteTodo(todo.id)
      await handleFilterChange()
    })
    .catch(() => {})
}

function openEdit(todo: Todo) {
  editingTodo.value = todo
  editForm.title = todo.title
  editForm.description = todo.description || ''
  editForm.completed = todo.completed
  editForm.priority = todo.priority
  editForm.due_date = todo.due_date || dayStr(0)
  editForm.images = todoImages(todo)
  const quickValues = dueOptions.value.map(option => option.value)
  editCustomDate.value = quickValues.includes(editForm.due_date) ? '' : editForm.due_date
  editVisible.value = true
}

async function handleSave() {
  if (!editForm.title.trim() || !editingTodo.value) return
  await todosStore.updateTodo(editingTodo.value.id, {
    title: editForm.title.trim(),
    description: editForm.description.trim(),
    completed: editForm.completed,
    priority: editForm.priority,
    due_date: editForm.due_date || null,
    images: editForm.images
  })
  await handleFilterChange()
  editVisible.value = false
}

function setFilter(value: 'all' | 'pending' | 'completed') {
  statusFilter.value = value
  if (value === 'completed') showCompleted.value = true
  handleFilterChange()
}

async function handleFilterChange() {
  const filter: { completed?: number } = {}
  if (statusFilter.value === 'pending') filter.completed = 0
  else if (statusFilter.value === 'completed') filter.completed = 1
  await todosStore.fetchTodos(filter)
  await resolveImages()
}

async function refreshTodos() {
  await handleFilterChange()
  await todosStore.fetchStats()
}

function isOverdue(todo: Todo): boolean {
  return todo.completed === 0 && !!todo.due_date && todo.due_date < dayStr(0)
}

function fmtDate(date: string | null): string {
  if (!date) return '今天'
  const today = dayStr(0)
  if (date === today) return '今天'
  if (date === dayStr(1)) return '明天'
  if (date === dayStr(2)) return '后天'
  const [ty, tm, td] = today.split('-').map(Number)
  const [dy, dm, dd] = date.split('-').map(Number)
  const todayMs = new Date(ty, tm - 1, td).getTime()
  const dateMs = new Date(dy, dm - 1, dd).getTime()
  const diff = Math.round((dateMs - todayMs) / 86400000)
  if (diff < 0) return `${Math.abs(diff)}天前`
  if (diff <= 7) return `${diff}天后`
  return new Date(dy, dm - 1, dd).toLocaleDateString('zh-CN', {month: 'short', day: 'numeric'})
}

function priLabel(priority: string): string {
  return ({urgent: '紧急', high: '重要', normal: '普通', low: '低'} as Record<string, string>)[priority] || '普通'
}

function previewImage(url: string) {
  previewUrl.value = url
  previewVisible.value = true
}

function resizeAddInput() {
  const input = addInputRef.value
  if (!input) return
  input.style.height = 'auto'
  input.style.height = `${input.scrollHeight}px`
}

onMounted(async () => {
  await refreshTodos()
  await resolveImages()
})

onActivated(async () => {
  await refreshTodos()
  await resolveImages()
})

watch(() => todosStore.todos.length, () => resolveImages())
watch(newTitle, () => nextTick(resizeAddInput))
</script>

<style scoped>
.todos-page {
  width: min(100%, 960px);
  min-height: 100%;
  margin: 0 auto;
  outline: none;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 16px;
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
  align-items: center;
  gap: 4px;
  padding: 3px;
  border: 1px solid var(--border-color-light);
  border-radius: 8px;
  background: var(--bg-card);
}

.filter-btn,
.tool-btn,
.submit-btn,
.date-item,
.check,
.item-del,
.refresh-btn,
.completed-toggle,
.chip,
.edit-check,
.paste-thumb button,
.ei button,
.pri-tag {
  border: 0;
  font: inherit;
  cursor: pointer;
}

.filter-btn {
  height: 28px;
  padding: 0 12px;
  border-radius: 6px;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 12px;
  transition: background .15s ease, color .15s ease;
}

.filter-btn:hover {
  color: var(--text-primary);
}

.filter-btn.active {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-weight: 600;
}

.composer {
  position: relative;
  margin-bottom: 10px;
  padding: 16px 18px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: var(--shadow-sm);
  transition: border-color .15s ease, box-shadow .15s ease;
}

.composer.active,
.composer:focus-within {
  border-color: color-mix(in srgb, var(--color-primary) 58%, var(--border-color));
  box-shadow: 0 0 0 2px rgba(64, 158, 255, .1), var(--shadow-sm);
}

.composer-main {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.composer-input,
.description-input,
.edit-title,
.edit-description {
  width: 100%;
  border: 0;
  outline: 0;
  resize: none;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
}

.composer-input {
  min-height: 26px;
  max-height: 96px;
  padding: 1px 0;
  font-size: 15px;
  line-height: 1.65;
}

.composer-input::placeholder,
.description-input::placeholder,
.edit-title::placeholder,
.edit-description::placeholder {
  color: var(--text-placeholder);
}

.submit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 30px;
  flex: 0 0 38px;
  border-radius: 6px;
  background: var(--color-primary);
  color: #fff;
  transition: opacity .15s ease, transform .15s ease;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.submit-btn:disabled {
  cursor: default;
  opacity: .45;
}

.description-input {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--bg-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.composer-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
  margin-top: 12px;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 26px;
  padding: 0;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 12px;
  transition: color .15s ease;
}

.tool-btn:hover,
.tool-btn.active {
  color: var(--text-primary);
}

.priority-btn.high {
  color: var(--color-warning);
}

.priority-btn.urgent {
  color: var(--color-danger);
}

.paste-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.paste-thumb,
.ei {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border-color-light);
  border-radius: 6px;
  background: var(--bg-secondary);
}

.paste-thumb {
  width: 46px;
  height: 46px;
}

.paste-thumb img,
.ei img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.paste-thumb button,
.ei button {
  position: absolute;
  top: 3px;
  right: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0, 0, 0, .52);
  color: #fff;
}

.todo-panel {
  position: relative;
  display: flex;
  min-height: 560px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color-light);
  border-radius: 8px;
  background: var(--bg-card);
}

.panel-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 0 18px;
  border-bottom: 1px solid var(--border-color-light);
}

.panel-title {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.panel-count {
  margin-left: 8px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: transparent;
  color: var(--text-tertiary);
}

.refresh-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.todo-groups {
  flex: 1;
  overflow: auto;
  padding: 12px 12px 74px;
}

.group + .group {
  margin-top: 14px;
}

.group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 6px;
}

.group-name {
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 700;
}

.group-name.overdue {
  color: var(--color-danger);
}

.group-name.today {
  color: var(--color-primary);
}

.group-name.completed {
  color: var(--color-success);
}

.group-num {
  color: var(--text-placeholder);
  font-size: 11px;
}

.todo-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-height: 58px;
  padding: 11px 10px;
  border-radius: 7px;
  transition: background .15s ease;
}

.todo-item:hover {
  background: var(--bg-hover);
}

.todo-item.done .item-title {
  color: var(--text-tertiary);
  text-decoration: line-through;
}

.todo-item.p-high .check-off {
  border-color: var(--color-warning);
}

.todo-item.p-urgent .check-off {
  border-color: var(--color-danger);
}

.check,
.edit-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  background: transparent;
}

.check-off,
.check-on {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 17px;
  border-radius: 50%;
}

.check-off {
  border: 1.5px solid var(--border-color);
  background: var(--bg-card);
}

.check:hover .check-off,
.edit-check:hover .check-off {
  border-color: var(--color-primary);
}

.check-on {
  border: 1px solid var(--color-success);
  background: var(--color-success);
  color: #fff;
}

.item-body {
  min-width: 0;
  flex: 1;
  cursor: pointer;
}

.item-title {
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.55;
  word-break: break-word;
}

.item-desc {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 3px;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.item-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 7px;
}

.meta-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 20px;
  padding: 1px 7px;
  border-radius: 5px;
  background: var(--bg-secondary);
  color: var(--text-tertiary);
  font-size: 11px;
}

.date-tag.late {
  background: rgba(245, 108, 108, .1);
  color: var(--color-danger);
}

.pri-tag {
  background: rgba(230, 162, 60, .12);
  color: var(--color-warning);
}

.pri-tag.urgent {
  background: rgba(245, 108, 108, .12);
  color: var(--color-danger);
}

.imgs {
  display: flex;
  gap: 5px;
  margin-top: 8px;
}

.imgs img {
  width: 34px;
  height: 34px;
  border: 1px solid var(--border-color-light);
  border-radius: 5px;
  object-fit: cover;
}

.item-del {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  border-radius: 6px;
  background: transparent;
  color: var(--text-placeholder);
  opacity: 0;
  transition: opacity .15s ease, background .15s ease, color .15s ease;
}

.todo-item:hover .item-del {
  opacity: 1;
}

.item-del:hover {
  background: rgba(245, 108, 108, .1);
  color: var(--color-danger);
}

.state-wrap {
  display: flex;
  min-height: 420px;
  flex: 1;
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

.empty-card {
  position: absolute;
  left: 19px;
  top: 8px;
  width: 72px;
  height: 78px;
  padding: 18px 14px;
  border: 2px solid rgba(64, 158, 255, .38);
  border-radius: 10px;
  background: rgba(64, 158, 255, .06);
}

.empty-card::before {
  position: absolute;
  top: 14px;
  left: 13px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: 0 22px 0 rgba(144, 147, 153, .25), 0 44px 0 rgba(144, 147, 153, .25);
  content: '';
}

.empty-card span {
  display: block;
  width: 28px;
  height: 5px;
  margin: 1px 0 16px 22px;
  border-radius: 999px;
  background: rgba(64, 158, 255, .38);
}

.empty-plant {
  position: absolute;
  right: 10px;
  bottom: 9px;
  width: 18px;
  height: 38px;
  border-radius: 999px 999px 4px 4px;
  background: rgba(144, 147, 153, .42);
}

.empty-plant::before {
  position: absolute;
  left: -12px;
  top: 8px;
  width: 14px;
  height: 26px;
  border-radius: 14px 2px 14px 2px;
  background: rgba(64, 158, 255, .45);
  transform: rotate(-30deg);
  content: '';
}

.completed-toggle-row {
  display: flex;
  justify-content: center;
  padding: 12px 16px 16px;
}

.completed-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 14px;
  border-radius: 6px;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 12px;
}

.completed-toggle:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.completed-toggle .expanded {
  transform: rotate(180deg);
}

.dialog-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}

.edit-title {
  min-height: 54px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color-light);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
}

.edit-description {
  min-height: 74px;
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 7px;
  background: var(--bg-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.edit-row {
  margin-top: 16px;
}

.edit-label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.edit-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.chip {
  min-height: 28px;
  padding: 0 11px;
  border: 1px solid var(--border-color-light);
  border-radius: 14px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 12px;
}

.chip:hover {
  border-color: var(--color-primary);
}

.chip.active {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-weight: 600;
}

.chip.pri.high {
  color: var(--color-warning);
}

.chip.pri.urgent {
  color: var(--color-danger);
}

.chip.pri.high.active {
  border-color: var(--color-warning);
  background: rgba(230, 162, 60, .12);
}

.chip.pri.urgent.active {
  border-color: var(--color-danger);
  background: rgba(245, 108, 108, .12);
}

.edit-imgs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ei {
  width: 62px;
  height: 62px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity .15s ease, transform .15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@keyframes rotate {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 720px) {
  .todos-page {
    width: 100%;
  }

  .page-head {
    flex-direction: column;
    align-items: stretch;
  }

  .head-actions {
    align-self: flex-start;
  }

  .todo-panel {
    min-height: 500px;
  }
}
</style>
