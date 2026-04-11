<template>
  <div class="ai-chat">
    <div class="page-header">
      <h1 class="page-title">AI 助手</h1>
      <div class="page-header-actions">
        <div class="header-left">
          <el-select
            v-model="selectedModelId"
            size="small"
            style="width: 180px;"
            placeholder="选择模型"
          >
            <el-option
              v-for="m in modelList"
              :key="m.id"
              :label="m.name"
              :value="m.id"
            />
          </el-select>
        </div>
        <div class="header-right">
          <el-button size="small" plain @click="showHistory = true">
            <el-icon style="margin-right:4px"><Clock /></el-icon>历史
          </el-button>
          <el-button size="small" plain @click="newChat">
            <el-icon style="margin-right:4px"><Plus /></el-icon>新对话
          </el-button>
        </div>
      </div>
    </div>

    <div class="chat-container">
      <!-- 消息列表 -->
      <div ref="messageList" class="message-list">
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
            <div class="message-content" v-html="renderContent(msg.content)"></div>
          </div>
        </div>

        <div v-if="loading" class="message assistant">
          <div class="message-avatar">🤖</div>
          <div class="message-body">
            <div class="message-content typing">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="input-area">
        <el-input
          ref="inputRef"
          v-model="inputText"
          placeholder="描述你想设置的提醒..."
          :disabled="loading"
          @keydown.enter.exact.prevent="send"
          size="large"
          clearable
        >
          <template #append>
            <el-button :icon="Promotion" :loading="loading" @click="send" />
          </template>
        </el-input>
        <div class="input-hint" v-if="modelList.length === 0">
          还没有配置模型，请先到「模型配置」页面添加
        </div>
      </div>
    </div>

    <!-- 历史记录抽屉 -->
    <el-drawer v-model="showHistory" title="历史对话" direction="ltr" size="320px">
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
import { ref, nextTick, onMounted } from 'vue'
import { Promotion, Plus, Clock, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ModelItem {
  id: number
  name: string
  is_default: number
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
const modelList = ref<ModelItem[]>([])
const selectedModelId = ref<number | undefined>(undefined)
const currentSessionId = ref<number | null>(null)
const sessions = ref<SessionItem[]>([])
const showHistory = ref(false)

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

onMounted(async () => {
  try {
    modelList.value = await window.electronAPI.models.list()
    const defaultModel = modelList.value.find((m: any) => m.is_default)
    if (defaultModel) selectedModelId.value = defaultModel.id
    else if (modelList.value.length > 0) selectedModelId.value = modelList.value[0].id
  } catch { /* ignore */ }

  // 加载历史会话列表
  await loadSessions()

  // 每次进入创建新会话
  await createNewSession()
})

async function loadSessions() {
  try {
    sessions.value = await window.electronAPI.ai.listSessions()
  } catch { /* ignore */ }
}

async function createNewSession() {
  try {
    const session = await window.electronAPI.ai.createSession('新对话', selectedModelId.value)
    currentSessionId.value = session.id
    messages.value = []
  } catch { /* ignore */ }
}

function sendSuggestion(text: string) {
  inputText.value = text
  send()
}

async function newChat() {
  await createNewSession()
}

async function loadSession(s: SessionItem) {
  try {
    const msgs = await window.electronAPI.ai.loadSessionMessages(s.id)
    currentSessionId.value = s.id
    messages.value = msgs as ChatMessage[]
    showHistory.value = false
    scrollToBottom()
  } catch { /* ignore */ }
}

async function handleDeleteSession(s: SessionItem) {
  try {
    await ElMessageBox.confirm(`确定删除「${s.title}」？`, '删除确认', { type: 'warning' })
    await window.electronAPI.ai.deleteSession(s.id)
    if (currentSessionId.value === s.id) {
      await createNewSession()
    }
    await loadSessions()
    ElMessage.success('已删除')
  } catch { /* cancel */ }
}

async function send() {
  const text = inputText.value.trim()
  if (!text || loading.value) return

  if (!selectedModelId.value) {
    ElMessage.warning('请先在「模型配置」中添加模型')
    return
  }

  messages.value.push({ role: 'user', content: text })
  inputText.value = ''
  loading.value = true
  await scrollToBottom()

  // 如果是第一条消息，自动更新标题
  const isFirstMsg = messages.value.filter(m => m.role === 'user').length === 1

  try {
    const result = await window.electronAPI.ai.chat(
      JSON.parse(JSON.stringify(messages.value)),
      selectedModelId.value,
      currentSessionId.value || undefined
    )

    if (result.reply) {
      messages.value.push({ role: 'assistant', content: result.reply })
    } else {
      messages.value.push({ role: 'assistant', content: '已为你完成操作！' })
    }

    // 更新会话标题
    if (isFirstMsg && currentSessionId.value) {
      const title = text.length > 20 ? text.substring(0, 20) + '...' : text
      try {
        await window.electronAPI.ai.updateSessionTitle(currentSessionId.value, title)
        await loadSessions()
      } catch { /* ignore */ }
    }
  } catch (e: any) {
    messages.value.push({
      role: 'assistant',
      content: `请求失败: ${e.message || '请检查模型配置是否正确'}`
    })
  } finally {
    loading.value = false
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

.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes blink {
  0%, 80%, 100% { opacity: 0.3; }
  40% { opacity: 1; }
}

.input-area {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color-light);
  flex-shrink: 0;
}

.input-area :deep(.el-input-group__append) {
  padding: 0 12px;
}

.input-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 6px;
  text-align: center;
}

/* 历史记录 */
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
