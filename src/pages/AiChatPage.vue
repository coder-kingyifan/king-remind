<template>
  <div class="ai-chat">
    <div class="page-header">
      <div class="page-header-row">
        <div class="page-title-area">
          <h1 class="page-title">{{ timeGreeting }}<span v-if="userNickname" class="user-nickname">，{{ userNickname }}</span></h1>
          <p v-if="encouragement" class="page-encouragement">{{ encouragement }}</p>
        </div>
        <div class="page-header-actions">
          <el-button size="small" plain @click="openWechatDialog">
            <el-icon style="margin-right:4px"><ChatLineSquare/></el-icon>
            微信
            <span class="wechat-status-dot" :class="wechatConnected ? 'on' : 'off'"></span>
          </el-button>
          <el-button size="small" plain @click="showHistory = true">
            <el-icon style="margin-right:4px"><Clock/></el-icon>
            历史
          </el-button>
          <el-button size="small" plain @click="newChat">
            <el-icon style="margin-right:4px"><Plus/></el-icon>
            新对话
          </el-button>
        </div>
      </div>
    </div>

    <div class="chat-container">
      <!-- 消息列表 -->
      <div ref="messageList" class="message-list">
        <!-- 空态 -->
        <ChatEmptyState
          v-if="messages.length === 0"
          :suggestions="displaySuggestions"
          :has-model="modelList.length > 0"
          @send-suggestion="sendSuggestion"
        />

        <!-- 消息列表 -->
        <ChatMessage
          v-for="(msg, idx) in messages"
          :key="idx"
          :message="msg"
          :index="idx"
          :is-thinking-open="openThinkingSet.has(idx)"
          :nickname="userNickname"
          :time-ago="msg.created_at ? formatRelativeTime(msg.created_at) : ''"
          @toggle-thinking="toggleThinking"
          @preview-image="previewImage"
        />

        <!-- Streaming: thinking + content -->
        <div v-if="loading && (streamingThinking || streamingContent)" class="message assistant">
          <ChatAvatar role="assistant"/>
          <div class="message-body">
            <div class="message-meta">
              <span class="message-sender">AI 助手</span>
            </div>
            <div v-if="streamingThinking" class="thinking-block" @click="streamThinkingOpen = !streamThinkingOpen">
              <div class="thinking-header">
                <span class="thinking-toggle">{{ streamThinkingOpen ? '▼' : '▶' }}</span>
                <span class="thinking-label">思考过程</span>
              </div>
              <div v-if="streamThinkingOpen" class="thinking-content">{{ streamingThinking }}</div>
            </div>
            <div v-if="streamingContent" class="message-content streaming" v-html="renderContent(streamingContent)"></div>
            <div v-if="streamStatus && !streamingContent" class="stream-status">
              <span class="stream-status-dot"></span>
              {{ streamStatus }}
            </div>
          </div>
        </div>

        <!-- Loading indicator -->
        <div v-if="loading && !streamingThinking && !streamingContent" class="message assistant">
          <ChatAvatar role="assistant"/>
          <div class="message-body">
            <div class="message-meta"><span class="message-sender">AI 助手</span></div>
            <div v-if="streamStatus" class="stream-status">
              <span class="stream-status-dot"></span>
              {{ streamStatus }}
            </div>
            <div v-else class="message-content typing">
              <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右下角模型选择器 -->
      <div class="model-selector" v-if="modelList.length > 0">
        <el-dropdown trigger="click" @command="onServiceSelect" placement="top-end">
          <div class="model-selector-btn">
            <span class="model-selector-icon">{{ getProviderIcon(currentConfig?.provider) }}</span>
            <span class="model-selector-name">{{ currentConfig?.name || '选择' }}</span>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="m in modelList" :key="m.id" :command="m.id"
                :class="{ 'is-active': selectedConfigId === m.id }">
                {{ getProviderIcon(m.provider) }} {{ m.name }}
                <el-tag v-if="m.is_default" size="small" type="success" style="margin-left:6px;">默认</el-tag>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-select v-model="selectedModel" size="small" class="model-inline-select" placeholder="模型" filterable allow-create default-first-option>
          <el-option v-for="m in currentModels" :key="m" :label="m" :value="m"/>
        </el-select>
      </div>

      <!-- 输入区 -->
      <div class="input-area">
        <div v-if="pendingImages.length" class="pending-images">
          <div v-for="(img, idx) in pendingImages" :key="idx" class="pending-image-wrap">
            <img :src="img" class="pending-image-thumb"/>
            <span class="pending-image-remove" @click="removePendingImage(idx)">&times;</span>
          </div>
        </div>
        <div class="input-row">
          <el-input
            ref="inputRef"
            v-model="inputText"
            placeholder="说点什么吧，我可以帮你快速创建提醒（我也可以通粘贴图片创建提醒）"
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
      </div>
    </div>

    <!-- Image preview dialog -->
    <el-dialog v-model="showImagePreview" :show-close="true" width="auto" class="image-preview-dialog">
      <img :src="previewImageUrl" style="max-width: 100%; max-height: 70vh;"/>
    </el-dialog>

    <!-- 历史记录抽屉 -->
    <el-drawer v-model="showHistory" direction="ltr" size="320px" :with-header="false">
      <div class="history-header">
        <span class="history-header-title">历史对话</span>
        <el-button size="small" circle @click="showHistory = false">&times;</el-button>
      </div>
      <div v-if="sessions.length > 0" class="history-toolbar">
        <el-button size="small" type="danger" plain @click="handleClearAllHistory">清除全部</el-button>
      </div>
      <div class="history-list">
        <div v-for="s in sessions" :key="s.id" class="history-item"
             :class="{ active: currentSessionId === s.id }" @click="loadSession(s)">
          <div class="history-item-info">
            <div class="history-item-title">{{ s.title }}</div>
            <div class="history-item-date">{{ formatRelativeTime(s.created_at) }}</div>
          </div>
          <el-button class="history-item-delete" size="small" plain type="danger" :icon="Delete" circle
                     @click.stop="handleDeleteSession(s)"/>
        </div>
        <div v-if="sessions.length === 0" class="history-empty">暂无历史对话</div>
      </div>
    </el-drawer>

    <!-- 微信连接对话框 -->
    <el-dialog v-model="showWechatDialog" title="微信连接" width="400px" :close-on-click-modal="false">
      <div class="wechat-dialog-content">
        <!-- 连接状态 -->
        <div class="wechat-status-row">
          <span class="wechat-status-indicator" :class="wechatStatusClass">
            <span class="wechat-dot"></span>
            <span class="wechat-status-label">{{ wechatStatusText }}</span>
          </span>
          <span v-if="wechatBotState.nickname" class="wechat-nickname">{{ wechatBotState.nickname }}</span>
        </div>

        <!-- 未连接：二维码区域 -->
        <template v-if="wechatBotState.status === 'disconnected' || wechatBotState.status === 'waiting_qrcode'">
          <div class="wechat-qrcode-area">
            <div v-if="wechatQrcodeLoading" class="wechat-qrcode-loading">
              <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            </div>
            <div v-else-if="wechatQrcodeUrl" class="wechat-qrcode-container">
              <img :src="wechatQrcodeUrl" class="wechat-qrcode-image" alt="微信登录二维码"/>
              <p class="wechat-qrcode-tip">请使用微信扫描二维码登录</p>
              <p v-if="wechatBotState.status === 'waiting_qrcode'" class="wechat-qrcode-waiting">等待扫码中...</p>
            </div>
            <div v-else class="wechat-qrcode-placeholder">
              <el-button type="primary" @click="fetchWechatQRCode" :loading="wechatQrcodeLoading">获取登录二维码</el-button>
            </div>
          </div>
        </template>

        <!-- 已连接：断开按钮 -->
        <template v-if="wechatBotState.status === 'connected'">
          <div class="wechat-connected-actions">
            <el-button type="danger" plain size="small" @click="handleWechatLogout" :loading="wechatLogoutLoading">断开连接</el-button>
          </div>
        </template>

        <!-- 使用说明 -->
        <div class="wechat-guide">
          <p v-if="wechatBotState.status !== 'connected'">扫码登录后，微信消息将自动由 AI 助手处理并回复。</p>
          <p>对话记录保存在历史对话中，以 [微信] 标识。</p>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {computed, nextTick, onActivated, onMounted, onUnmounted, reactive, ref, watch} from 'vue'
import {Clock, Delete, Plus, Promotion, ChatLineSquare} from '@element-plus/icons-vue'
import {ElMessage, ElMessageBox} from 'element-plus'
import ChatAvatar from '@/components/chat/ChatAvatar.vue'
import ChatMessage from '@/components/chat/ChatMessage.vue'
import ChatEmptyState from '@/components/chat/ChatEmptyState.vue'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
  thinking?: string
  created_at?: string
}

interface ModelItem {
  id: number
  name: string
  provider: string
  model: string
  models: string
  model_type: string
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
const selectedConfigId = ref<number | undefined>(undefined)
const selectedModel = ref<string>('')
const currentSessionId = ref<number | null>(null)
const sessions = ref<SessionItem[]>([])
const showHistory = ref(false)

// WeChat bot state
interface WechatBotState {
  status: 'disconnected' | 'waiting_qrcode' | 'connecting' | 'connected'
  nickname?: string
  headImgUrl?: string
  recentContacts: Array<{uin: string; nickname: string}>
}

const showWechatDialog = ref(false)
const wechatBotState = ref<WechatBotState>({
  status: 'disconnected',
  recentContacts: []
})
const wechatQrcodeUrl = ref('')
const wechatQrcodeLoading = ref(false)
const wechatLogoutLoading = ref(false)
let wechatPollTimer: ReturnType<typeof setInterval> | null = null
let wechatIsCheckingStatus = false

const wechatConnected = computed(() => wechatBotState.value.status === 'connected')

const wechatStatusClass = computed(() => {
  const map: Record<string, string> = {
    disconnected: 'off',
    waiting_qrcode: 'waiting',
    connecting: 'waiting',
    connected: 'on'
  }
  return map[wechatBotState.value.status] || 'off'
})

const wechatStatusText = computed(() => {
  const map: Record<string, string> = {
    disconnected: '未连接',
    waiting_qrcode: '等待扫码',
    connecting: '连接中',
    connected: '已连接'
  }
  return map[wechatBotState.value.status] || '未知'
})

async function loadWechatState() {
  try {
    const state = await window.electronAPI.wechatBot.getState()
    if (state) Object.assign(wechatBotState.value, state)
  } catch { /* ignore */ }
}

async function fetchWechatQRCode() {
  if (wechatQrcodeLoading.value) return
  wechatQrcodeLoading.value = true
  try {
    const result = await window.electronAPI.wechatBot.getQRCode()
    if (result) {
      if (result.qrcode && result.qrcode.startsWith('data:')) {
        wechatQrcodeUrl.value = result.qrcode
      } else if (result.qrcode) {
        wechatQrcodeUrl.value = `data:image/png;base64,${result.qrcode}`
      } else if (result.url) {
        wechatQrcodeUrl.value = result.url
      }
    }
    if (!wechatQrcodeUrl.value) {
      ElMessage.warning('未获取到二维码数据')
    }
    startWechatPollingStatus()
  } catch (e: any) {
    ElMessage.error(`获取二维码失败: ${e?.message || '未知错误'}`)
  } finally {
    wechatQrcodeLoading.value = false
  }
}

function startWechatPollingStatus() {
  stopWechatPollingStatus()
  wechatIsCheckingStatus = false
  wechatPollTimer = setInterval(async () => {
    if (wechatIsCheckingStatus) return
    wechatIsCheckingStatus = true
    try {
      const result = await window.electronAPI.wechatBot.checkStatus()
      if (result) {
        if (result.status === 'confirmed') {
          stopWechatPollingStatus()
          await loadWechatState()
          ElMessage.success('微信登录成功')
        } else if (result.status === 'expired') {
          stopWechatPollingStatus()
          wechatQrcodeUrl.value = ''
          ElMessage.warning('二维码已过期，请重新获取')
        } else if (result.status === 'canceled') {
          stopWechatPollingStatus()
          wechatQrcodeUrl.value = ''
          await loadWechatState()
        }
      }
    } catch { /* ignore */ }
    finally { wechatIsCheckingStatus = false }
  }, 3000)
}

function stopWechatPollingStatus() {
  wechatIsCheckingStatus = false
  if (wechatPollTimer) {
    clearInterval(wechatPollTimer)
    wechatPollTimer = null
  }
}

async function handleWechatLogout() {
  if (wechatLogoutLoading.value) return
  wechatLogoutLoading.value = true
  try {
    await window.electronAPI.wechatBot.logout()
    await loadWechatState()
    wechatQrcodeUrl.value = ''
    ElMessage.success('已断开连接')
  } catch (e: any) {
    ElMessage.error(`断开失败: ${e?.message || '未知错误'}`)
  } finally {
    wechatLogoutLoading.value = false
  }
}

function openWechatDialog() {
  showWechatDialog.value = true
  loadWechatState()
}

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

// Nickname
const userNickname = ref('')

// Greeting & encouragement
const encouragement = ref('')
const greetingLoading = ref(false)

// 缓存：每次启动只生成一次
let greetingCache: { encouragement: string; suggestions: string[] } | null = null

// Time-based greeting
const timeGreeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '凌晨好'
  if (hour < 12) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const currentConfig = computed(() =>
  modelList.value.find(m => m.id === selectedConfigId.value)
)

const currentModels = computed(() => {
  const cfg = currentConfig.value
  if (!cfg) return []
  try {
    const arr = JSON.parse(cfg.models || '[]')
    if (Array.isArray(arr) && arr.filter(Boolean).length > 0) return arr.filter(Boolean)
  } catch { /* ignore */ }
  return cfg.model ? [cfg.model] : []
})

async function loadModelConfigs() {
  try {
    modelList.value = (await window.electronAPI.models.list()).filter((m: ModelItem) => m.model_type !== 'web_search')
  } catch {
    modelList.value = []
  }

  if (modelList.value.length === 0) {
    selectedConfigId.value = undefined
    selectedModel.value = ''
    return
  }

  if (selectedConfigId.value && modelList.value.some(m => m.id === selectedConfigId.value)) {
    const cfg = modelList.value.find(m => m.id === selectedConfigId.value)
    if (cfg && !selectedModel.value) selectedModel.value = cfg.model
    return
  }

  const defaultCfg = modelList.value.find(m => m.is_default)
  const fallbackCfg = defaultCfg || modelList.value[0]
  selectedConfigId.value = fallbackCfg.id
  selectedModel.value = fallbackCfg.model
}

const defaultSuggestions = [
  '新增每日喝水提醒',
  '周末提醒我去爬山',
  '每天早上8点叫我起床',
  '帮我看看今天有什么提醒',
  '下周一提醒我交周报'
]
const suggestions = ref<string[]>([])
const aiSuggestionsLoaded = ref(false)

// 有模型时：AI建议加载完才显示，不展示默认建议；无模型时：直接显示默认建议
const displaySuggestions = computed(() => {
  if (modelList.value.length === 0) return defaultSuggestions
  if (!aiSuggestionsLoaded.value) return []
  return suggestions.value.length > 0 ? suggestions.value : []
})

const PROVIDER_ICONS: Record<string, string> = {
  ollama: '🦙', openai: '🤖', deepseek: '🐋', qwen: '☁️',
  kimi: '🌙', zhipu: '🔮', claude: '🧠', doubao: '🫘',
  hunyuan: '🐧', ernie: '🔵', spark: '⚡', yi: '🌍',
  siliconflow: '🔥', groq: '⚡', xiaomi: '📱',
  custom: '⚙️', custom_anthropic: '🧠',
  perplexity: '🔍', tavily: '🔎', jina: '🌐',
  bochaai: '📡', exa: '🎯'
}

function getProviderIcon(id?: string): string {
  if (!id) return '🤖'
  return PROVIDER_ICONS[id] || '🤖'
}

function renderContent(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const now = new Date()
    const date = new Date(dateStr.replace(' ', 'T'))
    if (isNaN(date.getTime())) return dateStr.replace(/:\d{2}$/, '')
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)

    if (diffSec < 60) return '刚刚'
    if (diffMin < 60) return `${diffMin}分钟前`

    const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const dayDiff = Math.floor((today.getTime() - msgDate.getTime()) / (24 * 60 * 60 * 1000))

    if (dayDiff === 1) return `昨天 ${timeStr}`
    if (dayDiff === 2) return `前天 ${timeStr}`
    if (dayDiff < 7) return `${dayDiff}天前`

    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    if (date.getFullYear() === now.getFullYear()) return `${month}-${day} ${timeStr}`
    return `${date.getFullYear()}-${month}-${day}`
  } catch {
    return dateStr
  }
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
function readFileAsBase64(file: File) {
  if (!file.type.startsWith('image/')) { ElMessage.warning('仅支持图片文件'); return }
  if (file.size > 10 * 1024 * 1024) { ElMessage.warning('图片不能超过 10MB'); return }
  const reader = new FileReader()
  reader.onload = () => pendingImages.value.push(reader.result as string)
  reader.readAsDataURL(file)
}

function removePendingImage(idx: number) { pendingImages.value.splice(idx, 1) }

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

// Stream handler
function handleStreamEvent(event: any) {
  switch (event.type) {
    case 'status': streamStatus.value = event.text; break
    case 'chunk': streamingContent.value += event.text; streamStatus.value = ''; scrollToBottom(); break
    case 'thinking': streamingThinking.value += event.text; streamStatus.value = ''; scrollToBottom(); break
    case 'tool_start': streamStatus.value = `正在${getToolDisplayName(event.name)}...`; scrollToBottom(); break
    case 'tool_result': streamStatus.value = `${getToolDisplayName(event.name)}完成`; scrollToBottom(); break
    case 'error': streamStatus.value = ''; break
  }
}

function getToolDisplayName(name: string): string {
  const map: Record<string, string> = {
    create_reminder: '创建提醒', list_reminders: '查询提醒列表',
    delete_reminder: '删除提醒', toggle_reminder: '切换提醒状态',
    list_skills: '查询技能列表', execute_skill: '执行技能'
  }
  return map[name] || name
}

// Nickname
async function loadNickname() {
  try {
    const nick = await window.electronAPI.settings.get('user_nickname')
    if (nick) {
      userNickname.value = nick
    }
  } catch { /* ignore */ }
}

// Greeting
const fallbackEncouragements = [
  '今天也要加油哦',
  '记得多喝水',
  '注意休息眼睛',
  '有什么可以帮你的？',
  '随时告诉我你的提醒需求'
]

async function loadGreeting() {
  // 有缓存直接用
  if (greetingCache) {
    encouragement.value = greetingCache.encouragement
    suggestions.value = greetingCache.suggestions
    aiSuggestionsLoaded.value = true
    return
  }

  // 无模型时不调用AI，直接用默认
  if (modelList.value.length === 0) {
    encouragement.value = fallbackEncouragements[Math.floor(Math.random() * fallbackEncouragements.length)]
    aiSuggestionsLoaded.value = true
    return
  }

  greetingLoading.value = true
  try {
    const result = await window.electronAPI.ai.generateGreeting()
    if (result) {
      if (result.encouragement) encouragement.value = result.encouragement
      if (result.suggestions && result.suggestions.length > 0) suggestions.value = result.suggestions
    }
    if (!encouragement.value) {
      encouragement.value = fallbackEncouragements[Math.floor(Math.random() * fallbackEncouragements.length)]
    }
    // 写入缓存
    greetingCache = { encouragement: encouragement.value, suggestions: suggestions.value }
  } catch {
    encouragement.value = fallbackEncouragements[Math.floor(Math.random() * fallbackEncouragements.length)]
    greetingCache = { encouragement: encouragement.value, suggestions: [] }
  } finally {
    greetingLoading.value = false
    aiSuggestionsLoaded.value = true
  }
}

// Service selector
function onServiceSelect(id: number) {
  selectedConfigId.value = id
  const cfg = modelList.value.find(m => m.id === id)
  if (cfg) selectedModel.value = cfg.model
}

onMounted(async () => {
  window.electronAPI.ai.onStreamEvent(handleStreamEvent)
  await loadModelConfigs()

  await Promise.all([loadNickname(), loadGreeting(), loadSessions(), loadWechatState()])
})

onActivated(async () => {
  await loadModelConfigs()
})

onUnmounted(() => {
  window.electronAPI.ai.removeStreamListener()
  stopWechatPollingStatus()
})

function onConfigChange(id: number) {
  const cfg = modelList.value.find(m => m.id === id)
  if (cfg) selectedModel.value = cfg.model
}

watch(currentModels, (models) => {
  if (models.length === 0) {
    selectedModel.value = currentConfig.value?.model || ''
    return
  }
  if (!models.includes(selectedModel.value)) {
    selectedModel.value = currentConfig.value?.model && models.includes(currentConfig.value.model)
      ? currentConfig.value.model
      : models[0]
  }
})

async function loadSessions() {
  try { sessions.value = await window.electronAPI.ai.listSessions() } catch { /* ignore */ }
}

// 每次打开历史抽屉时自动刷新会话列表
watch(showHistory, (val) => {
  if (val) loadSessions()
})

function sendSuggestion(text: string) { inputText.value = text; send() }

function newChat() {
  currentSessionId.value = null
  messages.value = []
  pendingImages.value = []
  // 使用缓存，不再重新生成
  if (greetingCache) {
    encouragement.value = greetingCache.encouragement
    suggestions.value = greetingCache.suggestions
    aiSuggestionsLoaded.value = true
  } else {
    aiSuggestionsLoaded.value = false
    encouragement.value = ''
    loadGreeting()
  }
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
    await ElMessageBox.confirm(`确定删除「${s.title}」？`, '删除确认', {type: 'warning'})
    await window.electronAPI.ai.deleteSession(s.id)
    if (currentSessionId.value === s.id) { currentSessionId.value = null; messages.value = [] }
    await loadSessions()
    ElMessage.success('已删除')
  } catch { /* cancel */ }
}

async function handleClearAllHistory() {
  try {
    await ElMessageBox.confirm('确定清除所有对话记录？', '清除确认', {type: 'warning'})
    await window.electronAPI.ai.clearAllSessions()
    currentSessionId.value = null
    messages.value = []
    await loadSessions()
    ElMessage.success('已清除全部记录')
  } catch { /* cancel */ }
}

async function send() {
  const text = inputText.value.trim()
  const images = [...pendingImages.value]
  if ((!text && images.length === 0) || loading.value) return
  if (!selectedConfigId.value) { ElMessage.warning('请先在「模型配置」中添加模型'); return }
  if (!selectedModel.value) { ElMessage.warning('请选择一个模型'); return }

  let savedImagePaths: string[] = []
  if (images.length > 0) {
    try { savedImagePaths = await window.electronAPI.ai.saveImages(images) }
    catch (e: any) { ElMessage.error('图片保存失败: ' + (e.message || '未知错误')); return }
  }

  const userMsg: ChatMessage = { role: 'user', content: text || '(图片)', images: images.length > 0 ? images : undefined }
  messages.value.push(userMsg)
  inputText.value = ''
  pendingImages.value = []
  loading.value = true
  streamingContent.value = ''
  streamingThinking.value = ''
  streamStatus.value = '正在思考...'
  streamThinkingOpen.value = true
  await scrollToBottom()

  if (!currentSessionId.value) {
    try { const session = await window.electronAPI.ai.createSession('新对话', selectedConfigId.value); currentSessionId.value = session.id }
    catch { /* ignore */ }
  }

  const isFirstMsg = messages.value.filter(m => m.role === 'user').length === 1

  const apiMessages = messages.value.map((m, idx) => {
    if (m.role === 'user' && idx === messages.value.length - 1 && savedImagePaths.length > 0) {
      return { role: m.role, content: m.content || '(图片)', image_paths: savedImagePaths }
    }
    return { role: m.role, content: m.content }
  })

  try {
    const result = await window.electronAPI.ai.chat(
      JSON.parse(JSON.stringify(apiMessages)), selectedConfigId.value, currentSessionId.value || undefined, selectedModel.value
    )
    const reply = result.reply || streamingContent.value || '已为你完成操作！'
    const thinking = streamingThinking.value
    messages.value.push({ role: 'assistant', content: reply, thinking: thinking || undefined })

    if (isFirstMsg && currentSessionId.value) {
      try {
        const title = await window.electronAPI.ai.generateTitle(selectedConfigId.value, text, reply)
        await window.electronAPI.ai.updateSessionTitle(currentSessionId.value, title)
        await loadSessions()
      } catch {
        const fallbackTitle = text.length > 20 ? text.substring(0, 20) + '...' : text
        try { await window.electronAPI.ai.updateSessionTitle(currentSessionId.value, fallbackTitle); await loadSessions() } catch { /* ignore */ }
      }
    }
  } catch (e: any) {
    messages.value.push({ role: 'assistant', content: `请求失败: ${e.message || '请检查模型配置'}` })
  } finally {
    loading.value = false
    streamingContent.value = ''
    streamingThinking.value = ''
    streamStatus.value = ''
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
  margin-bottom: 12px;
  flex-shrink: 0;
}

.page-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-title-area {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-nickname {
  font-weight: 500;
}

.page-encouragement {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 2px 0 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.page-header-actions {
  display: flex;
  gap: 6px;
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
  position: relative;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Message styles (for streaming messages not in ChatMessage component) */
.message {
  display: flex;
  gap: 10px;
  max-width: 85%;
}

.message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message-body {
  flex: 1;
  min-width: 0;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  padding: 0 4px;
}

.message.user .message-meta {
  justify-content: flex-end;
}

.message-sender {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.message-time {
  font-size: 11px;
  color: var(--text-tertiary);
}

.message-content {
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  color: var(--text-primary);
  background: var(--bg-secondary);
}

.message.user .message-content {
  background: var(--color-primary);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.message.assistant .message-content {
  border-bottom-left-radius: 4px;
}

.message-content.streaming {
  border-left: 3px solid var(--color-primary);
  animation: pulse-border 1.5s ease-in-out infinite;
}

@keyframes pulse-border {
  0%, 100% { border-left-color: var(--color-primary); }
  50% { border-left-color: transparent; }
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

.thinking-block {
  margin-bottom: 8px;
  border: 1px solid var(--border-color-light);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s;
}

.thinking-block:hover { border-color: var(--color-primary); }

.thinking-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  font-size: 12px;
  user-select: none;
}

.thinking-toggle { font-size: 10px; color: var(--text-tertiary); }
.thinking-label { color: var(--text-secondary); font-weight: 500; }

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

.stream-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-bottom-left-radius: 4px;
}

.stream-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
  animation: blink 1.4s ease-in-out infinite;
  flex-shrink: 0;
}

/* Model selector (inline near input) */
.model-selector {
  position: absolute;
  bottom: 78px;
  right: 16px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
}

.model-selector-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: 16px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.2s;
  max-width: 160px;
}

.model-selector-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.model-selector-icon { font-size: 14px; flex-shrink: 0; }
.model-selector-name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.model-inline-select {
  width: 120px;
}

.model-inline-select :deep(.el-input__wrapper) {
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06) !important;
  padding-left: 8px;
  padding-right: 8px;
}

.model-inline-select :deep(.el-input__inner) {
  font-size: 12px;
}

/* Input area */
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

.input-row .el-input { flex: 1; }
.input-area :deep(.el-input-group__append) { padding: 0 12px; }

/* History drawer */
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

.history-toolbar { padding: 0 20px 8px; }

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

.history-item:hover { border-color: var(--color-primary); background: var(--color-primary-bg); }
.history-item.active { border-color: var(--color-primary); background: var(--color-primary-bg); }

.history-item-info { flex: 1; min-width: 0; }

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

.history-item:hover .history-item-delete { opacity: 1; }

.history-empty {
  text-align: center;
  padding: 40px 0;
  color: var(--text-tertiary);
  font-size: 13px;
}

/* WeChat status dot on header button */
.wechat-status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-left: 4px;
  vertical-align: middle;
}

.wechat-status-dot.on {
  background: #67C23A;
  box-shadow: 0 0 4px rgba(103, 194, 58, 0.5);
}

.wechat-status-dot.off {
  background: #909399;
}

/* WeChat dialog */
.wechat-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.wechat-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.wechat-status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wechat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.wechat-status-indicator.on .wechat-dot {
  background: #67C23A;
  box-shadow: 0 0 6px rgba(103, 194, 58, 0.5);
}

.wechat-status-indicator.off .wechat-dot {
  background: #909399;
}

.wechat-status-indicator.waiting .wechat-dot {
  background: #E6A23C;
  animation: blink 1.4s ease-in-out infinite;
}

.wechat-status-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.wechat-nickname {
  font-size: 13px;
  color: var(--text-secondary);
}

.wechat-qrcode-area {
  display: flex;
  justify-content: center;
  padding: 12px;
}

.wechat-qrcode-loading {
  display: flex;
  gap: 6px;
  padding: 30px;
}

.wechat-qrcode-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.wechat-qrcode-image {
  width: 180px;
  height: 180px;
  border-radius: 8px;
  border: 1px solid var(--border-color-light);
}

.wechat-qrcode-tip {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.wechat-qrcode-waiting {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0;
}

.wechat-qrcode-placeholder {
  padding: 30px;
}

.wechat-connected-actions {
  display: flex;
  justify-content: center;
}

.wechat-guide {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.6;
  padding-top: 8px;
  border-top: 1px solid var(--border-color-light);
}

.wechat-guide p {
  margin: 0 0 4px;
}
</style>
