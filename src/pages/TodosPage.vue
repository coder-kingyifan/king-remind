<template>
  <div class="todos-page" @paste="handlePaste" tabindex="0" ref="pageRef">
    <!-- 头部 -->
    <div class="header">
      <h1>待办</h1>
      <span class="hint" v-if="todosStore.stats.pending">{{ todosStore.stats.pending }} 项待完成</span>
    </div>

    <!-- 添加框 -->
    <div class="add-bar" :class="{hasContent: newTitle.trim()}">
      <span class="add-icon">+</span>
      <textarea
          ref="addInputRef"
          v-model="newTitle"
          class="add-input"
          placeholder="添加待办，回车提交"
          rows="1"
          @keydown.enter.exact.prevent="handleAdd"
      />
      <transition name="slide">
        <div v-if="newTitle.trim()" class="add-extra">
          <span class="extra-btn" :class="{active: newDueDate}" @click.stop="showDatePicker = !showDatePicker">
            <el-icon :size="13"><Calendar/></el-icon>
            {{ fmtDate(newDueDate) }}
          </span>
          <span class="extra-btn pri" :class="newPriority" @click="cyclePriority">
            {{ priLabel(newPriority) }}
          </span>
          <el-button type="primary" size="small" round @click="handleAdd" class="add-go">添加</el-button>
        </div>
      </transition>
    </div>

    <!-- 日期选择弹窗 -->
    <transition name="fade">
      <div v-if="showDatePicker" class="date-popup" @click.self="showDatePicker = false">
        <div class="date-list">
          <div v-for="opt in dueOptions" :key="opt.value" class="date-item" :class="{active: newDueDate === opt.value}" @click="newDueDate = opt.value; showDatePicker = false">
            {{ opt.label }}
          </div>
          <div class="date-item">
            <el-date-picker v-model="customDate" type="date" value-format="YYYY-MM-DD" placeholder="选日期..." size="small" style="width:120px" :disabled-date="disablePastDate" @change="onCustomDate"/>
          </div>
        </div>
      </div>
    </transition>

    <!-- 粘贴图片预览 -->
    <div v-if="pasteImages.length" class="paste-row">
      <div v-for="(img, i) in pasteImages" :key="i" class="paste-thumb">
        <img :src="img"/>
        <span @click="pasteImages.splice(i, 1)">×</span>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="tabs">
      <span v-for="f in filterOptions" :key="f.value" class="tab" :class="{active: statusFilter === f.value}" @click="statusFilter = f.value; handleFilterChange()">{{ f.label }}</span>
    </div>

    <!-- 列表 -->
    <div v-if="todosStore.loading" class="loading">加载中...</div>

    <template v-else-if="groupedTodos.length">
      <div v-for="group in groupedTodos" :key="group.key" class="group">
        <div class="group-head">
          <span class="group-name" :class="group.key">{{ group.label }}</span>
          <span class="group-num">{{ group.items.length }}</span>
        </div>
        <div v-for="todo in group.items" :key="todo.id" class="item" :class="{done: todo.completed===1, ['p-'+todo.priority]: todo.completed===0}">
          <div class="check" @click="handleToggle(todo.id)">
            <div v-if="todo.completed===1" class="check-on"><el-icon :size="11"><Check/></el-icon></div>
            <div v-else class="check-off"></div>
          </div>
          <div class="content" @click="openEdit(todo)">
            <span class="text">{{ todo.title }}</span>
            <div class="item-meta" v-if="todo.completed===0">
              <span v-if="todo.due_date" class="date-tag" :class="{late: isOverdue(todo)}">{{ fmtDate(todo.due_date) }}</span>
              <span v-if="todo.priority!=='normal'" class="pri-tag" :class="todo.priority" @click.stop="cycleTodoPriority(todo)">{{ priLabel(todo.priority) }}</span>
            </div>
            <div v-if="todoImages(todo).length" class="imgs">
              <img v-for="(img,i) in todoImages(todo).slice(0,2)" :key="i" :src="img" @click.stop="previewImage(img)"/>
            </div>
          </div>
          <span class="item-del" @click.stop="handleDeleteTodo(todo)">×</span>
        </div>
      </div>
    </template>

    <div v-else class="empty"><p>没有待办</p></div>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="editVisible" width="400px" :close-on-click-modal="true" destroy-on-close class="edit-dialog">
      <div class="edit-top">
        <div class="edit-check" @click="editForm.completed = editForm.completed === 1 ? 0 : 1">
          <div v-if="editForm.completed===1" class="check-on"><el-icon :size="11"><Check/></el-icon></div>
          <div v-else class="check-off"></div>
        </div>
        <span class="edit-status">{{ editForm.completed === 1 ? '已完成' : '未完成' }}</span>
      </div>
      <textarea v-model="editForm.title" class="edit-title" placeholder="待办内容" rows="2"/>
      <div class="edit-row">
        <span class="edit-label">什么时候</span>
        <div class="edit-chips">
          <span v-for="opt in dueOptions" :key="opt.value" class="chip" :class="{active: editForm.due_date === opt.value}" @click="editForm.due_date = opt.value">{{ opt.label }}</span>
          <el-date-picker v-model="editCustomDate" type="date" value-format="YYYY-MM-DD" size="small" placeholder="选日期" style="width:110px" :disabled-date="disablePastDate" @change="(v: string) => { editForm.due_date = v || '' }"/>
        </div>
      </div>
      <div class="edit-row">
        <span class="edit-label">优先级</span>
        <div class="edit-chips">
          <span v-for="opt in priOptions" :key="opt.value" class="chip pri" :class="[opt.value, {active: editForm.priority === opt.value}]" @click="editForm.priority = opt.value">{{ opt.label }}</span>
        </div>
      </div>
      <div class="edit-row" v-if="editForm.images.length">
        <span class="edit-label">图片</span>
        <div class="edit-imgs">
          <div v-for="(img,i) in editForm.images" :key="i" class="ei">
            <img :src="img" @click.stop="previewImage(img)"/>
            <span @click="editForm.images.splice(i,1)">×</span>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button size="small" type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 图片预览 -->
    <el-image-viewer v-if="previewVisible" :url-list="[previewUrl]" @close="previewVisible = false"/>
  </div>
</template>

<script setup lang="ts">
import {computed, nextTick, onMounted, onActivated, reactive, ref, watch} from 'vue'
import {useTodosStore} from '@/stores/todos'
import {Calendar, Check} from '@element-plus/icons-vue'
import {ElImageViewer, ElMessage, ElMessageBox} from 'element-plus'
import type {Todo} from '@/types/todo'

const todosStore = useTodosStore()
const pageRef = ref<HTMLElement>()
const addInputRef = ref<HTMLInputElement>()
const newTitle = ref('')
const newPriority = ref('normal')
const newDueDate = ref(dayStr(0))
const customDate = ref('')
const pasteImages = ref<string[]>([])
const statusFilter = ref('all')
const showDatePicker = ref(false)
const editVisible = ref(false)
const editingTodo = ref<Todo | null>(null)
const editCustomDate = ref('')
const previewVisible = ref(false)
const previewUrl = ref('')

const editForm = reactive({
  title: '',
  completed: 0,
  priority: 'normal' as string,
  due_date: '' as string,
  images: [] as string[]
})

const filterOptions = [
  {label: '全部', value: 'all'},
  {label: '待完成', value: 'pending'},
  {label: '已完成', value: 'completed'}
]

const dueOptions = computed(() => [
  {label: '今天', value: dayStr(0)},
  {label: '明天', value: dayStr(1)},
  {label: '后天', value: dayStr(2)},
  {label: '下周', value: dayStr(7)},
])

const priOptions = [
  {label: '普通', value: 'normal'},
  {label: '重要', value: 'high'},
  {label: '紧急', value: 'urgent'},
]

function cyclePriority() {
  const order = ['normal', 'high', 'urgent']
  const i = order.indexOf(newPriority.value)
  newPriority.value = order[(i + 1) % order.length]
}

function onCustomDate(v: string) {
  if (v) { newDueDate.value = v; showDatePicker.value = false }
}

// 按日期分组
interface DayGroup { key: string; label: string; items: Todo[] }

const groupedTodos = computed<DayGroup[]>(() => {
  let todos = todosStore.todos
  const today = dayStr(0)
  const tomorrow = dayStr(1)
  const overdue: Todo[] = [], todayList: Todo[] = [], tomorrowList: Todo[] = [], upcoming: Todo[] = [], completedList: Todo[] = []

  for (const t of todos) {
    if (t.completed === 1) { completedList.push(t); continue }
    if (!t.due_date) { todayList.push(t); continue }
    if (t.due_date < today) { overdue.push(t); continue }
    if (t.due_date === today) { todayList.push(t); continue }
    if (t.due_date === tomorrow) { tomorrowList.push(t); continue }
    upcoming.push(t)
  }

  const g: DayGroup[] = []
  if (overdue.length) g.push({key: 'overdue', label: '逾期', items: overdue})
  if (todayList.length) g.push({key: 'today', label: '今天', items: todayList})
  if (tomorrowList.length) g.push({key: 'tomorrow', label: '明天', items: tomorrowList})
  if (upcoming.length) g.push({key: 'upcoming', label: '即将到来', items: upcoming})
  if (completedList.length) g.push({key: 'completed', label: '已完成', items: completedList})
  return g
})

function dayStr(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

function disablePastDate(date: Date): boolean {
  return date.getTime() < new Date(new Date().toDateString()).getTime()
}

// 图片
const imgCache = new Map<string, string>()
function todoImages(todo: Todo): string[] {
  try { return (JSON.parse(todo.images || '[]') as string[]).map(p => imgCache.get(p) || p) }
  catch { return [] }
}
async function resolveImages() {
  const all: string[] = []
  for (const t of todosStore.todos) {
    try { for (const p of JSON.parse(t.images || '[]') as string[]) if (!imgCache.has(p) && !p.startsWith('data:')) all.push(p) } catch {}
  }
  if (!all.length) return
  try { const urls = await window.electronAPI.todos.resolveImages(all); for (let i = 0; i < all.length; i++) if (urls[i]) imgCache.set(all[i], urls[i]) } catch {}
}

async function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) pasteImages.value.push(await new Promise<string>((r, j) => { const rd = new FileReader(); rd.onload = () => r(rd.result as string); rd.onerror = j; rd.readAsDataURL(file) }))
    }
  }
}

async function saveImgs(b64s: string[]): Promise<string[]> {
  const paths: string[] = []
  for (const b of b64s) {
    if (b.startsWith('data:')) { try { const r = await window.electronAPI.ai.saveImages([b]); if (r?.length) paths.push(...r) } catch {} }
    else paths.push(b)
  }
  return paths
}

// 操作
async function handleAdd() {
  const title = newTitle.value.trim()
  if (!title) return
  const images = pasteImages.value.length ? await saveImgs(pasteImages.value) : []
  await todosStore.createTodo({ title, priority: newPriority.value as any, due_date: newDueDate.value, images })
  newTitle.value = ''
  newPriority.value = 'normal'
  newDueDate.value = dayStr(0)
  customDate.value = ''
  pasteImages.value = []
  addInputRef.value?.focus()
}

function handleToggle(id: number) { todosStore.toggleTodo(id) }

function cycleTodoPriority(todo: Todo) {
  const order = ['normal', 'high', 'urgent']
  const i = order.indexOf(todo.priority)
  todosStore.updateTodo(todo.id, {priority: order[(i + 1) % order.length]})
}

function handleDeleteTodo(todo: Todo) {
  ElMessageBox.confirm('确认要删除当前待办吗？', '删除待办', {confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning'})
    .then(() => { todosStore.deleteTodo(todo.id) })
    .catch(() => {})
}

function openEdit(todo: Todo) {
  editingTodo.value = todo
  editForm.title = todo.title
  editForm.completed = todo.completed
  editForm.priority = todo.priority
  editForm.due_date = todo.due_date || dayStr(0)
  editForm.images = todoImages(todo)
  const quickValues = dueOptions.value.map(o => o.value)
  editCustomDate.value = (!quickValues.includes(editForm.due_date)) ? editForm.due_date : ''
  editVisible.value = true
}

async function handleSave() {
  if (!editForm.title.trim()) return
  if (editingTodo.value) {
    await todosStore.updateTodo(editingTodo.value.id, {
      title: editForm.title.trim(),
      completed: editForm.completed,
      priority: editForm.priority as any,
      due_date: editForm.due_date || null,
      images: editForm.images
    })
  }
  editVisible.value = false
}

function handleFilterChange() {
  const f: any = {}
  if (statusFilter.value === 'pending') f.completed = 0
  else if (statusFilter.value === 'completed') f.completed = 1
  todosStore.fetchTodos(f)
}

function isOverdue(todo: Todo): boolean { return todo.completed === 0 && !!todo.due_date && todo.due_date < dayStr(0) }

function fmtDate(d: string): string {
  const today = dayStr(0)
  if (d === today) return '今天'
  if (d === dayStr(1)) return '明天'
  const diff = Math.floor((new Date(d).getTime() - new Date(today).getTime()) / 86400000)
  if (diff < 0) return `${Math.abs(diff)}天前`
  if (diff <= 7) return `${diff}天后`
  return new Date(d).toLocaleDateString('zh-CN', {month: 'short', day: 'numeric'})
}

function priLabel(p: string): string { return ({urgent: '紧急', high: '重要', normal: '普通'} as any)[p] || '' }

function previewImage(url: string) { previewUrl.value = url; previewVisible.value = true }

function resizeAddInput() {
  const el = addInputRef.value as any
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

onMounted(async () => {
  await handleFilterChange()
  await todosStore.fetchStats()
  await resolveImages()
})
onActivated(async () => {
  await handleFilterChange()
  await todosStore.fetchStats()
  await resolveImages()
})
watch(() => todosStore.todos.length, () => resolveImages())
watch(newTitle, () => nextTick(resizeAddInput))
</script>

<style scoped>
.todos-page { max-width: 600px; outline: none; }

.header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px; }
.header h1 { font-size: 18px; font-weight: 600; color: var(--text-primary); margin: 0; }
.hint { font-size: 12px; color: var(--text-tertiary); }

/* 添加栏 */
.add-bar {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 10px 14px; border: 1px solid var(--border-color-light); border-radius: 8px;
  margin-bottom: 16px; transition: border-color .15s, box-shadow .15s; flex-wrap: wrap;
}
.add-bar.focused, .add-bar.hasContent { border-color: var(--color-primary); box-shadow: 0 0 0 2px rgba(64,158,255,.1); }
.add-icon { font-size: 18px; color: var(--color-primary); font-weight: 300; flex-shrink: 0; line-height: 1; margin-top: 2px; }
.add-input { flex: 1; min-width: 200px; border: none; outline: none; font-size: 14px; color: var(--text-primary); background: transparent; resize: none; line-height: 1.5; font-family: inherit; }
.add-input::placeholder { color: var(--text-placeholder); }

.add-extra { display: flex; align-items: center; gap: 6px; width: 100%; padding-top: 8px; }
.extra-btn { font-size: 12px; padding: 2px 8px; border-radius: 4px; cursor: pointer; color: var(--text-tertiary); display: flex; align-items: center; gap: 3px; transition: color .15s; }
.extra-btn:hover { color: var(--text-primary); }
.extra-btn.active { color: var(--color-primary); }
.extra-btn.pri.high { color: #E6A23C; }
.extra-btn.pri.urgent { color: #F56C6C; }
.add-go { margin-left: auto; }

/* 日期弹窗 */
.date-popup { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 100; display: flex; align-items: flex-start; justify-content: center; padding-top: 120px; }
.date-list { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 6px; box-shadow: var(--shadow-lg); display: flex; flex-direction: column; gap: 2px; min-width: 140px; }
.date-item { padding: 6px 12px; font-size: 13px; border-radius: 4px; cursor: pointer; color: var(--text-primary); transition: background .1s; }
.date-item:hover { background: var(--bg-hover); }
.date-item.active { color: var(--color-primary); font-weight: 500; }

/* 粘贴预览 */
.paste-row { display: flex; gap: 6px; margin-bottom: 12px; }
.paste-thumb { position: relative; width: 40px; height: 40px; border-radius: 4px; overflow: hidden; border: 1px solid var(--border-color-light); }
.paste-thumb img { width: 100%; height: 100%; object-fit: cover; }
.paste-thumb span { position: absolute; top: 0; right: 0; width: 14px; height: 14px; background: rgba(0,0,0,.5); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; cursor: pointer; }

/* 筛选标签 */
.tabs { display: flex; gap: 4px; margin-bottom: 16px; }
.tab { font-size: 12px; padding: 4px 10px; border-radius: 4px; cursor: pointer; color: var(--text-tertiary); transition: all .15s; }
.tab:hover { color: var(--text-secondary); }
.tab.active { background: var(--bg-tertiary); color: var(--text-primary); font-weight: 500; }

/* 分组 */
.group { margin-bottom: 16px; }
.group-head { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; padding-left: 4px; }
.group-name { font-size: 12px; font-weight: 600; color: var(--text-tertiary); }
.group-name.overdue { color: var(--color-danger); }
.group-name.today { color: var(--color-primary); }
.group-name.completed { color: var(--color-success); }
.group-num { font-size: 11px; color: var(--text-placeholder); }

/* 待办项 */
.item { display: flex; align-items: flex-start; gap: 10px; padding: 8px 4px; border-radius: 6px; cursor: pointer; transition: background .1s; position: relative; }
.item:hover { background: var(--bg-hover); }
.item.done .text { text-decoration: line-through; color: var(--text-tertiary); }
.item.p-high .check-off { border-color: #E6A23C; }
.item.p-urgent .check-off { border-color: #F56C6C; }

.check { flex-shrink: 0; cursor: pointer; margin-top: 2px; }
.check-off { width: 16px; height: 16px; border: 1.5px solid var(--border-color); border-radius: 50%; transition: border-color .15s; }
.check-off:hover { border-color: var(--color-primary); }
.check-on { width: 16px; height: 16px; background: var(--color-success); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; }

.content { flex: 1; min-width: 0; }
.text { font-size: 14px; color: var(--text-primary); line-height: 1.5; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.item-meta { display: flex; align-items: center; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
.pri-tag { font-size: 11px; padding: 1px 6px; border-radius: 4px; cursor: pointer; }
.pri-tag.high { color: #E6A23C; background: rgba(230,162,60,.1); }
.pri-tag.urgent { color: #F56C6C; background: rgba(245,108,108,.1); }
.imgs { display: flex; gap: 3px; flex-shrink: 0; margin-top: 4px; }
.imgs img { width: 24px; height: 24px; border-radius: 3px; object-fit: cover; }

.date-tag { font-size: 11px; color: var(--text-tertiary); }
.date-tag.late { color: var(--color-danger); }
.item-del { font-size: 14px; color: var(--text-placeholder); cursor: pointer; opacity: 0; transition: opacity .15s; flex-shrink: 0; margin-top: 2px; padding: 0 4px; }
.item:hover .item-del { opacity: .5; }
.item-del:hover { opacity: 1 !important; color: var(--color-danger); }

/* 空/加载 */
.empty { padding: 40px 0; text-align: center; color: var(--text-tertiary); font-size: 13px; }
.loading { padding: 40px 0; text-align: center; color: var(--text-tertiary); font-size: 13px; }

/* 编辑弹窗 */
.edit-top { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.edit-check { cursor: pointer; }
.edit-status { font-size: 13px; color: var(--text-secondary); }
.edit-title { width: 100%; border: none; outline: none; font-size: 15px; font-weight: 500; color: var(--text-primary); background: transparent; padding: 0; margin-bottom: 16px; border-bottom: 1px solid var(--border-color-light); padding-bottom: 8px; resize: none; line-height: 1.5; font-family: inherit; }
.edit-row { margin-bottom: 12px; }
.edit-label { font-size: 12px; color: var(--text-tertiary); display: block; margin-bottom: 6px; }
.edit-chips { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.chip { font-size: 12px; padding: 3px 10px; border-radius: 10px; cursor: pointer; border: 1px solid var(--border-color-light); color: var(--text-secondary); transition: all .1s; user-select: none; }
.chip:hover { border-color: var(--color-primary); }
.chip.active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.chip.pri.high { color: #E6A23C; border-color: rgba(230,162,60,.3); }
.chip.pri.high.active { background: #E6A23C; color: #fff; border-color: #E6A23C; }
.chip.pri.urgent { color: #F56C6C; border-color: rgba(245,108,108,.3); }
.chip.pri.urgent.active { background: #F56C6C; color: #fff; border-color: #F56C6C; }

.edit-imgs { display: flex; gap: 6px; flex-wrap: wrap; }
.ei { position: relative; width: 56px; height: 56px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color-light); }
.ei img { width: 100%; height: 100%; object-fit: cover; }
.ei span { position: absolute; top: 1px; right: 1px; width: 16px; height: 16px; background: rgba(0,0,0,.5); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; cursor: pointer; }

/* 动画 */
.slide-enter-active, .slide-leave-active { transition: all .15s ease; }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateY(-4px); }
.fade-enter-active, .fade-leave-active { transition: opacity .15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
