<template>
  <div class="ai-chat">
    <div class="page-header">
      <h1 class="page-title">AI 助手</h1>
      <div class="page-header-actions">
        <div class="header-left">
          <el-select
              v-model="selectedConfigId"
              size="small"
              style="width: 160px;"
              placeholder="选择服务商"
              @change="onConfigChange"
          >
            <el-option
                v-for="m in modelList"
                :key="m.id"
                :label="m.name"
                :value="m.id"
            />
          </el-select>
          <el-select
              v-model="selectedModel"
              size="small"
              style="width: 180px;"
              placeholder="选择模型"
              filterable
              allow-create
              default-first-option
          >
            <el-option
                v-for="m in currentModels"
                :key="m"
                :label="m"
                :value="m"
            />
          </el-select>
        </div>
        <div class="header-right">
          <el-button size="small" plain @click="showHistory = true">
            <el-icon style="margin-right:4px">
              <Clock/>
            </el-icon>
            历史
          </el-button>
          <el-button size="small" plain @click="newChat">
            <el-icon style="margin-right:4px">
              <Plus/>
            </el-icon>
            新对话
          </el-button>
        </div>
      </div>
    </div>

    <div class="chat-container">
      <!-- 消息列表 -->
      <div ref="messageList" class="message-list" @paste="onPasteImage">
        <div v-if="messages.length === 0" class="empty-hint">
          <div class="empty-icon">💬</div>
          <p class="empty-text">试试对我说：</p>
          <div class="empty-suggestions">
            <div class="suggestion" v-for="s in suggestions" :key="s" @click="sendSuggestion(s)">{{ s }}</div>
          </div>
        </div>

        <div
            v-for="(msg, idx) in messages"
            :key="idx"
            class="message"
            :class="msg.role"
        >
          <div class="message-avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
          <div class="message-body">
            <!-- User message with images -->
            <div v-if="msg.role === 'user' && msg.images && msg.images.length" class="message-images">
              <img v-for="(img, iIdx) in msg.images" :key="iIdx" :src="img" class="message-image-thumb"
                   @click="previewImage(img)"/>
            </div>
            <!-- Thinking block -->
            <div v-if="msg.role === 'assistant' && msg.thinking" class="thinking-block" @click="toggleThinking(idx)">
              <div class="thinking-header">
                <span class="thinking-toggle">{{ openThinkingSet.has(idx) ? '▼' : '▶' }}</span>
                <span class="thinking-label">思考过程</span>
              </div>
              <div v-if="openThinkingSet.has(idx)" class="thinking-content">{{ msg.thinking }}</div>
            </div>
            <div class="message-content" v-html="renderContent(msg.content)"></div>
          </div>
        </div>

        <!-- Streaming: thinking + content being built -->
        <div v-if="loading && (streamingThinking || streamingContent)" class="message assistant">
          <div class="message-avatar">🤖</div>
          <div class="message-body">
            <div v-if="streamingThinking" class="thinking-block" @click="streamThinkingOpen = !streamThinkingOpen">
              <div class="thinking-header">
                <span class="thinking-toggle">{{ streamThinkingOpen ? '▼' : '▶' }}</span>
                <span class="thinking-label">思考过程</span>
              </div>
              <div v-if="streamThinkingOpen" class="thinking-content">{{ streamingThinking }}</div>
            </div>
            <div v-if="streamingContent" class="message-content streaming"
                 v-html="renderContent(streamingContent)"></div>
            <div v-if="streamStatus && !streamingContent" class="stream-status">
              <span class="stream-status-dot"></span>
              {{ streamStatus }}
            </div>
          </div>
        </div>

        <!-- Loading indicator (no content yet) -->
        <div v-if="loading && !streamingThinking && !streamingContent" class="message assistant">
          <div class="message-avatar">🤖</div>
          <div class="message-body">
            <div v-if="streamStatus" class="stream-status">
              <span class="stream-status-dot"></span>
              {{ streamStatus }}
            </div>
            <div v-else class="message-content typing">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="input-area">
        <!-- Preview attached images -->
        <div v-if="pendingImages.length" class="pending-images">
          <div v-for="(img, idx) in pendingImages" :key="idx" class="pending-image-wrap">
            <img :src="img" class="pending-image-thumb"/>
            <span class="pending-image-remove" @click="removePendingImage(idx)">&times;</span>
          </div>
        </div>
        <div class="input-row">
          <el-button class="attach-btn" @click="triggerFileInput" :disabled="loading" plain>
            <el-icon>
              <Paperclip/>
            </el-icon>
          </el-button>
          <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFileSelected"/>
          <el-input
              ref="inputRef"
              v-model="inputText"
              placeholder="描述你想设置的提醒... (可粘贴/拖入图片)"
              :disabled="loading"
              @keydown.enter.exact.prevent="send"
              @paste="onInputPaste"
              size="large"
              clearable
          >
            <template #append>
              <el-button :icon="Promotion" :loading="loading" @click="send"/>
            </template>
          </el-input>
        </div>
        <div class="input-hint" v-if="modelList.length === 0">
          还没有配置模型，请先到「模型配置」页面添加
        </div>
      </div>
    </div>

    <!-- Image preview dialog -->
    <el-dialog v-model="showImagePreview" :show-close="true" width="auto" class="image-preview-dialog">
      <img :src="previewImageUrl" style="max-width: 100%; max-height: 70vh;"/>
    </el-dialog>

    <!-- 历史记录抽屉 -->
    <el-drawer
        v-model="showHistory"
        direction="ltr"
        size="320px"
        :with-header="false"
    >
      <div class="history-header">
        <span class="history-header-title">历史对话</span>
        <el-button size="small" circle @click="showHistory = false">&times;</el-button>
      </div>
      <div v-if="sessions.length > 0" class="history-toolbar">
        <el-button size="small" type="danger" plain @click="handleClearAllHistory">清除全部记录</el-button>
      </div>
      <div class="history-list">
        <div
            v-for="s in sessions"
            :key="s.id"
            class="history-item"
            :class="{ active: currentSessionId === s.id }"
            @click="loadSession(s)"
        >
          <div class="history-item-info">
            <div class="history-item-title">{{ s.title }}</div>
            <div class="history-item-date">{{ formatTime(s.created_at) }}</div>
          </div>
          <el-button
              class="history-item-delete"
              size="small"
              plain
              type="danger"
              :icon="Delete"
              circle
              @click.stop="handleDeleteSession(s)"
          />
        </div>
        <div v-if="sessions.length === 0" class="history-empty">
          暂无历史对话
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, reactive, ref} from 'vue'
import {Clock, Delete, Paperclip, Plus, Promotion} from '@element-plus/icons-vue'
import {ElMessage, ElMessageBox} from 'element-plus'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
  thinking?: string
}

interface ModelItem {
  id: number
  name: string
  provider: string
  model: string
  models: string
  is_default: number
}

interface ProviderInfo {
  id: string
  name: string
  models: string[]
}

interface SessionItem {
  id: number
  title: string
  model_id: number | null
  created_at: string
  updated_at: string
}

const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const loading = ref(false)
const messageList = ref<HTMLElement | null>(null)
const inputRef = ref<any>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const modelList = ref<ModelItem[]>([])
const providers = ref<ProviderInfo[]>([])
const selectedConfigId = ref<number | undefined>(undefined)
const selectedModel = ref<string>('')
const currentSessionId = ref<number | null>(null)
const sessions = ref<SessionItem[]>([])
const showHistory = ref(false)

// Image handling
const pendingImages = ref<string[]>([])
const showImagePreview = ref(false)
const previewImageUrl = ref('')

// Streaming state
const streamingContent = ref('')
const streamingThinking = ref('')
const streamStatus = ref('')
const streamThinkingOpen = ref(true)
const openThinkingSet = reactive(new Set<number>())
const streamError = ref('')

const currentConfig = computed(() =>
    modelList.value.find(m => m.id === selectedConfigId.value)
)

const currentModels = computed(() => {
  const cfg = currentConfig.value
  if (!cfg) return []
  try {
    const arr = JSON.parse(cfg.models || '[]')
    if (Array.isArray(arr) && arr.filter(Boolean).length > 0) return arr.filter(Boolean)
  } catch { /* ignore */
  }
  return cfg.model ? [cfg.model] : []
})

const suggestions = [
  '每30分钟提醒我喝水',
  '明天下午3点提醒我开会',
  '工作日每天早上9点提醒我站会',
  '查看我的所有提醒',
  '每小时提醒我休息一下眼睛'
]

function renderContent(text: string): string {
  return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>')
}

function formatTime(t: string): string {
  if (!t) return ''
  return t.replace(/:\d{2}$/, '')
}

async function scrollToBottom() {
  await nextTick()
  if (messageList.value) {
    messageList.value.scrollTop = messageList.value.scrollHeight
  }
}

function previewImage(url: string) {
  previewImageUrl.value = url
  showImagePreview.value = true
}

function toggleThinking(idx: number) {
  if (openThinkingSet.has(idx)) {
    openThinkingSet.delete(idx)
  } else {
    openThinkingSet.add(idx)
  }
}

// Image handling
function triggerFileInput() {
  fileInput.value?.click()
}

function onFileSelected(e: Event) {
  const target = e.target as HTMLInputElement
  if (!target.files?.length) return
  for (const file of Array.from(target.files!)) {
    readFileAsBase64(file)
  }
  target.value = ''
}

function readFileAsBase64(file: File) {
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('仅支持图片文件')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.warning('图片不能超过 10MB')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    pendingImages.value.push(reader.result as string)
  }
  reader.readAsDataURL(file)
}

function removePendingImage(idx: number) {
  pendingImages.value.splice(idx, 1)
}

function onInputPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) readFileAsBase64(file)
    }
  }
}

function onPasteImage(e: ClipboardEvent) {
  onInputPaste(e)
}

// Stream event handler
function handleStreamEvent(event: any) {
  switch (event.type) {
    case 'status':
      streamStatus.value = event.text
      break
    case 'chunk':
      streamingContent.value += event.text
      streamStatus.value = ''
      scrollToBottom()
      break
    case 'thinking':
      streamingThinking.value += event.text
      streamStatus.value = ''
      scrollToBottom()
      break
    case 'tool_start':
      streamStatus.value = `正在${getToolDisplayName(event.name)}...`
      scrollToBottom()
      break
    case 'tool_result':
      streamStatus.value = `${getToolDisplayName(event.name)}完成`
      scrollToBottom()
      break
    case 'error':
      streamError.value = event.message || '请求失败'
      streamStatus.value = ''
      break
  }
}

function getToolDisplayName(name: string): string {
  switch (name) {
    case 'create_reminder':
      return '创建提醒'
    case 'list_reminders':
      return '查询提醒列表'
    case 'delete_reminder':
      return '删除提醒'
    case 'toggle_reminder':
      return '切换提醒状态'
    default:
      return name
  }
}

onMounted(async () => {
  // Register stream listener
  window.electronAPI.ai.onStreamEvent(handleStreamEvent)

  try {
    providers.value = await window.electronAPI.ai.getProviders()
  } catch { /* ignore */
  }

  try {
    modelList.value = await window.electronAPI.models.list()
    const defaultCfg = modelList.value.find(m => m.is_default)
    if (defaultCfg) {
      selectedConfigId.value = defaultCfg.id
      selectedModel.value = defaultCfg.model
    } else if (modelList.value.length > 0) {
      selectedConfigId.value = modelList.value[0].id
      selectedModel.value = modelList.value[0].model
    }
  } catch { /* ignore */
  }

  await loadSessions()
})

onUnmounted(() => {
  window.electronAPI.ai.removeStreamListener()
})

function onConfigChange(id: number) {
  const cfg = modelList.value.find(m => m.id === id)
  if (cfg) {
    selectedModel.value = cfg.model
  }
}

async function loadSessions() {
  try {
    sessions.value = await window.electronAPI.ai.listSessions()
  } catch { /* ignore */
  }
}

function sendSuggestion(text: string) {
  inputText.value = text
  send()
}

async function newChat() {
  currentSessionId.value = null
  messages.value = []
  pendingImages.value = []
}

async function loadSession(s: SessionItem) {
  try {
    const msgs = await window.electronAPI.ai.loadSessionMessages(s.id)
    currentSessionId.value = s.id
    messages.value = msgs as ChatMessage[]
    showHistory.value = false
    scrollToBottom()
  } catch { /* ignore */
  }
}

async function handleDeleteSession(s: SessionItem) {
  try {
    await ElMessageBox.confirm(`确定删除「${s.title}」？`, '删除确认', {type: 'warning'})
    await window.electronAPI.ai.deleteSession(s.id)
    if (currentSessionId.value === s.id) {
      currentSessionId.value = null
      messages.value = []
    }
    await loadSessions()
    ElMessage.success('已删除')
  } catch { /* cancel */
  }
}

async function handleClearAllHistory() {
  try {
    await ElMessageBox.confirm('确定清除所有对话记录？此操作不可恢复。', '清除确认', {type: 'warning'})
    await window.electronAPI.ai.clearAllSessions()
    currentSessionId.value = null
    messages.value = []
    await loadSessions()
    ElMessage.success('已清除全部记录')
  } catch { /* cancel */
  }
}

async function send() {
  const text = inputText.value.trim()
  const images = [...pendingImages.value]
  if ((!text && images.length === 0) || loading.value) return

  if (!selectedConfigId.value) {
    ElMessage.warning('请先在「模型配置」中添加模型')
    return
  }

  if (!selectedModel.value) {
    ElMessage.warning('请选择一个模型')
    return
  }

  // Save images to disk first, get file paths
  let savedImagePaths: string[] = []
  if (images.length > 0) {
    try {
      savedImagePaths = await window.electronAPI.ai.saveImages(images)
    } catch (e: any) {
      ElMessage.error('图片保存失败: ' + (e.message || '未知错误'))
      return
    }
  }

  // Build user message (base64 for display)
  const userMsg: ChatMessage = {
    role: 'user',
    content: text || '(图片)',
    images: images.length > 0 ? images : undefined
  }
  messages.value.push(userMsg)
  inputText.value = ''
  pendingImages.value = []
  loading.value = true

  // Reset streaming state
  streamingContent.value = ''
  streamingThinking.value = ''
  streamStatus.value = '正在思考...'
  streamThinkingOpen.value = true
  streamError.value = ''

  await scrollToBottom()

  // Create session on first message
  if (!currentSessionId.value) {
    try {
      const session = await window.electronAPI.ai.createSession('新对话', selectedConfigId.value)
      currentSessionId.value = session.id
    } catch { /* ignore */
    }
  }

  const isFirstMsg = messages.value.filter(m => m.role === 'user').length === 1

  // Build messages for API (use image paths instead of base64)
  const apiMessages = messages.value.map((m, idx) => {
    // Only the latest user message may have image paths to send
    if (m.role === 'user' && idx === messages.value.length - 1 && savedImagePaths.length > 0) {
      return {
        role: 'user',
        content: m.content || '(图片)',
        image_paths: savedImagePaths
      }
    }
    return {role: m.role, content: m.content}
  })

  try {
    const result = await window.electronAPI.ai.chat(
        JSON.parse(JSON.stringify(apiMessages)),
        selectedConfigId.value,
        currentSessionId.value || undefined,
        selectedModel.value
    )

    const reply = result.reply || streamingContent.value || (streamError.value ? `请求失败: ${streamError.value}` : '已为你完成操作！')
    const thinking = streamingThinking.value

    messages.value.push({
      role: 'assistant',
      content: reply,
      thinking: thinking || undefined
    })

    // Auto-generate title on first message
    if (isFirstMsg && currentSessionId.value) {
      try {
        const title = await window.electronAPI.ai.generateTitle(
            selectedConfigId.value,
            text,
            reply
        )
        await window.electronAPI.ai.updateSessionTitle(currentSessionId.value, title)
        await loadSessions()
      } catch {
        // Fallback: use truncated text
        const fallbackTitle = text.length > 20 ? text.substring(0, 20) + '...' : text
        try {
          await window.electronAPI.ai.updateSessionTitle(currentSessionId.value, fallbackTitle)
          await loadSessions()
        } catch { /* ignore */
        }
      }
    }
  } catch (e: any) {
    messages.value.push({
      role: 'assistant',
      content: `请求失败: ${e.message || '请检查模型配置是否正确'}`
    })
  } finally {
    loading.value = false
    streamingContent.value = ''
    streamingThinking.value = ''
    streamStatus.value = ''
    streamError.value = ''
    await scrollToBottom()
    inputRef.value?.focus()
  }
}
</script>

<style scoped>
.ai-chat {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 56px - 48px);
  max-width: 100%;
}

.page-header {
  margin-bottom: 16px;
  flex-shrink: 0;
}

.page-header-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0;
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: 12px;
  overflow: hidden;
  min-height: 0;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-hint {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  opacity: 0.7;
}

.empty-icon {
  font-size: 48px;
}

.empty-text {
  font-size: 14px;
  color: var(--text-tertiary);
}

.empty-suggestions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.suggestion {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color-light);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.suggestion:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-bg);
}

.message {
  display: flex;
  gap: 10px;
  max-width: 85%;
}

.message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 16px;
  background: var(--bg-secondary);
}

.message.user .message-avatar {
  background: var(--color-primary-bg);
}

.message-body {
  flex: 1;
  min-width: 0;
}

.message-images {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}

.message-image-thumb {
  width: 120px;
  height: 90px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid var(--border-color-light);
  transition: opacity 0.2s;
}

.message-image-thumb:hover {
  opacity: 0.85;
}

.message-content {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  color: var(--text-primary);
  background: var(--bg-secondary);
}

.message.user .message-content {
  background: var(--color-primary);
  color: #fff;
}

.message.assistant .message-content {
  background: var(--bg-secondary);
}

.message-content.streaming {
  border-left: 3px solid var(--color-primary);
  animation: pulse-border 1.5s ease-in-out infinite;
}

@keyframes pulse-border {
  0%, 100% {
    border-left-color: var(--color-primary);
  }
  50% {
    border-left-color: transparent;
  }
}

.typing {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-tertiary);
  animation: blink 1.4s ease-in-out infinite;
}

.dot:nth-child(2) {
  animation-delay: 0.2s;
}

.dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes blink {
  0%, 80%, 100% {
    opacity: 0.3;
  }
  40% {
    opacity: 1;
  }
}

/* Thinking block */
.thinking-block {
  margin-bottom: 8px;
  border: 1px solid var(--border-color-light);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s;
}

.thinking-block:hover {
  border-color: var(--color-primary);
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  font-size: 12px;
  color: var(--text-tertiary);
  user-select: none;
}

.thinking-toggle {
  font-size: 10px;
}

.thinking-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.thinking-content {
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-tertiary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color-light);
}

/* Stream status */
.stream-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  animation: fade-in 0.3s ease;
}

.stream-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
  animation: blink 1.4s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.input-area {
  padding: 12px 20px 16px;
  border-top: 1px solid var(--border-color-light);
  flex-shrink: 0;
}

.pending-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.pending-image-wrap {
  position: relative;
  width: 80px;
  height: 60px;
}

.pending-image-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--border-color-light);
}

.pending-image-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--el-color-danger);
  color: #fff;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  line-height: 1;
}

.input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.input-row .el-input {
  flex: 1;
}

.input-area :deep(.el-input-group__append) {
  padding: 0 12px;
}

.attach-btn {
  flex-shrink: 0;
}

.input-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 6px;
  text-align: center;
}

/* 历史记录 */
.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 8px;
}

.history-header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.history-toolbar {
  padding: 0 20px 8px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid var(--border-color-light);
}

.history-item:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
}

.history-item.active {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
}

.history-item-info {
  flex: 1;
  min-width: 0;
}

.history-item-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-item-date {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.history-item-delete {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s;
}

.history-item:hover .history-item-delete {
  opacity: 1;
}

.history-empty {
  text-align: center;
  padding: 40px 0;
  color: var(--text-tertiary);
  font-size: 13px;
}
</style>
