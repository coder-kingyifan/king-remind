<template>
  <div class="wechat-bot-page">
    <div class="page-header">
      <h1 class="page-title">微信机器人</h1>
      <p class="page-subtitle">通过微信 ClawBot 接入，在微信中直接与 AI 助手对话</p>
    </div>

    <div class="settings-list">
      <div class="setting-section">
        <h3 class="section-title">连接状态</h3>

        <div class="status-card">
          <div class="status-indicator" :class="statusClass">
            <span class="status-dot"></span>
            <span class="status-text">{{ statusText }}</span>
          </div>
          <div v-if="botState.nickname" class="status-user">
            <img v-if="botState.headImgUrl" :src="botState.headImgUrl" class="status-avatar"/>
            <span class="status-nickname">{{ botState.nickname }}</span>
          </div>
        </div>

        <template v-if="botState.status === 'disconnected' || botState.status === 'waiting_qrcode'">
          <div class="qrcode-area">
            <div v-if="qrcodeLoading" class="qrcode-loading">
              <span class="loading-dot"></span>
              <span class="loading-dot"></span>
              <span class="loading-dot"></span>
            </div>
            <div v-else-if="qrcodeUrl" class="qrcode-container">
              <img :src="qrcodeUrl" class="qrcode-image" alt="微信登录二维码"/>
              <p class="qrcode-tip">请使用微信扫描二维码登录</p>
              <p v-if="botState.status === 'waiting_qrcode'" class="qrcode-waiting">等待扫码中...</p>
            </div>
            <div v-else class="qrcode-placeholder">
              <el-button type="primary" @click="fetchQRCode" :loading="qrcodeLoading">获取登录二维码</el-button>
            </div>
          </div>
        </template>

        <template v-if="botState.status === 'connected'">
          <div class="connected-actions">
            <el-button type="danger" plain size="small" @click="handleLogout" :loading="logoutLoading">断开连接</el-button>
          </div>
        </template>
      </div>

      <div class="setting-section">
        <h3 class="section-title">使用说明</h3>
        <div class="guide-content">
          <ol class="guide-steps">
            <li>点击「获取登录二维码」，使用微信扫码登录。</li>
            <li>登录成功后，机器人将自动开始处理微信消息。</li>
            <li>在微信中给机器人发消息即可与 AI 助手对话。</li>
            <li>微信对话记录会保存在 AI 对话页面，以 [微信] 标识。</li>
            <li>启用「微信机器人」通知渠道后，提醒触发时会自动通过微信发送消息。</li>
          </ol>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, onActivated, onMounted, onUnmounted, ref} from 'vue'
import {ElMessage} from 'element-plus'

interface BotState {
  status: 'disconnected' | 'waiting_qrcode' | 'connecting' | 'connected'
  nickname?: string
  headImgUrl?: string
  recentContacts: Array<{uin: string; nickname: string}>
}

const botState = ref<BotState>({
  status: 'disconnected',
  recentContacts: []
})

const qrcodeUrl = ref('')
const qrcodeLoading = ref(false)
const logoutLoading = ref(false)

let pollTimer: ReturnType<typeof setInterval> | null = null
let statePollTimer: ReturnType<typeof setInterval> | null = null
let isCheckingStatus = false

const statusClass = computed(() => {
  const map: Record<string, string> = {
    disconnected: 'status-off',
    waiting_qrcode: 'status-waiting',
    connecting: 'status-waiting',
    connected: 'status-on'
  }
  return map[botState.value.status] || 'status-off'
})

const statusText = computed(() => {
  const map: Record<string, string> = {
    disconnected: '未连接',
    waiting_qrcode: '等待扫码',
    connecting: '连接中',
    connected: '已连接'
  }
  return map[botState.value.status] || '未知'
})

async function loadState() {
  try {
    const state = await window.electronAPI.wechatBot.getState()
    if (state) Object.assign(botState.value, state)
  } catch {
    // ignore
  }
}

async function fetchQRCode() {
  if (qrcodeLoading.value) return
  qrcodeLoading.value = true
  try {
    const result = await window.electronAPI.wechatBot.getQRCode()
    if (result) {
      if (result.qrcode && result.qrcode.startsWith('data:')) {
        qrcodeUrl.value = result.qrcode
      } else if (result.qrcode) {
        qrcodeUrl.value = `data:image/png;base64,${result.qrcode}`
      } else if (result.url) {
        qrcodeUrl.value = result.url
      }
    }
    if (!qrcodeUrl.value) {
      ElMessage.warning('未获取到二维码数据')
    }
    startPollingStatus()
  } catch (e: any) {
    ElMessage.error(`获取二维码失败: ${e?.message || '未知错误'}`)
  } finally {
    qrcodeLoading.value = false
  }
}

function startPollingStatus() {
  stopPollingStatus()
  isCheckingStatus = false
  pollTimer = setInterval(async () => {
    if (isCheckingStatus) return
    isCheckingStatus = true
    try {
      const result = await window.electronAPI.wechatBot.checkStatus()
      if (result) {
        if (result.status === 'confirmed') {
          stopPollingStatus()
          await loadState()
          ElMessage.success('微信登录成功')
        } else if (result.status === 'expired') {
          stopPollingStatus()
          qrcodeUrl.value = ''
          ElMessage.warning('二维码已过期，请重新获取')
        } else if (result.status === 'canceled') {
          stopPollingStatus()
          qrcodeUrl.value = ''
          await loadState()
        }
      }
    } catch {
      // ignore polling error
    } finally {
      isCheckingStatus = false
    }
  }, 3000)
}

function stopPollingStatus() {
  isCheckingStatus = false
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function startStatePolling() {
  stopStatePolling()
  statePollTimer = setInterval(async () => {
    await loadState()
    if (botState.value.status !== 'connecting') {
      stopStatePolling()
    }
  }, 2000)
}

function stopStatePolling() {
  if (statePollTimer) {
    clearInterval(statePollTimer)
    statePollTimer = null
  }
}

async function handleLogout() {
  if (logoutLoading.value) return
  logoutLoading.value = true
  try {
    await window.electronAPI.wechatBot.logout()
    await loadState()
    qrcodeUrl.value = ''
    ElMessage.success('已断开连接')
  } catch (e: any) {
    ElMessage.error(`断开失败: ${e?.message || '未知错误'}`)
  } finally {
    logoutLoading.value = false
  }
}

onMounted(async () => {
  await loadState()
  if (botState.value.status === 'waiting_qrcode') {
    startPollingStatus()
  } else if (botState.value.status === 'connecting') {
    startStatePolling()
  }
})

onActivated(async () => {
  await loadState()
  if (botState.value.status === 'waiting_qrcode') {
    startPollingStatus()
  } else if (botState.value.status === 'connecting') {
    startStatePolling()
  }
})

onUnmounted(() => {
  stopPollingStatus()
  stopStatePolling()
})
</script>

<style scoped>
.wechat-bot-page {
  max-width: 640px;
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

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.setting-section {
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: 12px;
  padding: 20px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.connected-actions {
  display: flex;
  gap: 8px;
}

.status-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 16px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.status-on .status-dot {
  background: #67C23A;
  box-shadow: 0 0 6px rgba(103, 194, 58, 0.5);
}

.status-off .status-dot {
  background: #909399;
}

.status-waiting .status-dot {
  background: #E6A23C;
  animation: blink 1.4s ease-in-out infinite;
}

@keyframes blink {
  0%, 80%, 100% { opacity: 0.3; }
  40% { opacity: 1; }
}

.status-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.status-user {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}

.status-nickname {
  font-size: 13px;
  color: var(--text-secondary);
}

.qrcode-area {
  display: flex;
  justify-content: center;
  padding: 16px;
}

.qrcode-loading {
  display: flex;
  gap: 6px;
  padding: 40px;
}

.loading-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
  animation: blink 1.4s ease-in-out infinite;
}

.loading-dot:nth-child(2) { animation-delay: 0.2s; }
.loading-dot:nth-child(3) { animation-delay: 0.4s; }

.qrcode-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.qrcode-image {
  width: 200px;
  height: 200px;
  border-radius: 8px;
  border: 1px solid var(--border-color-light);
}

.qrcode-tip {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.qrcode-waiting {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0;
}

.qrcode-placeholder {
  padding: 40px;
}

.guide-content {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.guide-steps {
  padding-left: 18px;
  margin: 0;
}
</style>
