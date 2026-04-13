<template>
  <div class="setup-wizard-overlay">
    <div class="setup-wizard">
      <!-- 步骤指示器 -->
      <div class="setup-steps">
        <div
          v-for="(step, idx) in steps"
          :key="idx"
          class="setup-step-dot"
          :class="{ active: currentStep === idx, done: currentStep > idx }"
        />
      </div>

      <!-- 步骤1: 欢迎与称呼 -->
      <div v-if="currentStep === 0" class="setup-content">
        <div class="setup-icon">👋</div>
        <h2 class="setup-title">欢迎使用 King 提醒助手</h2>
        <p class="setup-desc">让我们快速完成初始设置，开始你的提醒之旅</p>
        <div class="setup-form">
          <div class="setup-field">
            <label class="setup-label">怎么称呼你？</label>
            <el-input
              v-model="nickname"
              placeholder="请输入你的昵称"
              maxlength="20"
              show-word-limit
              size="large"
              @keydown.enter="nextStep"
            />
          </div>
        </div>
      </div>

      <!-- 步骤2: 数据库安全 -->
      <div v-if="currentStep === 1" class="setup-content">
        <div class="setup-icon">🔐</div>
        <h2 class="setup-title">数据安全</h2>
        <p class="setup-desc">设置数据库密码以加密你的提醒数据，防止他人查看</p>
        <div class="setup-form">
          <div class="setup-field">
            <label class="setup-label">数据库密码</label>
            <el-input
              v-model="dbPassword"
              type="password"
              placeholder="设置密码以加密数据库"
              size="large"
              show-password
            />
            <div class="setup-sublabel">留空则不加密，建议设置以保护隐私</div>
          </div>
          <div v-if="dbPassword" class="setup-field">
            <label class="setup-label">确认密码</label>
            <el-input
              v-model="dbPasswordConfirm"
              type="password"
              placeholder="再次输入密码"
              size="large"
              show-password
            />
          </div>
          <div v-if="dbPassword && dbPasswordConfirm && dbPassword !== dbPasswordConfirm" class="setup-error">
            两次输入的密码不一致
          </div>
        </div>
      </div>

      <!-- 步骤3: API 接口配置 -->
      <div v-if="currentStep === 2" class="setup-content">
        <div class="setup-icon">🌐</div>
        <h2 class="setup-title">API 接口设置</h2>
        <p class="setup-desc">启用后外部程序可通过 HTTP 接口或 AI 对话来创建和管理提醒</p>
        <div class="setup-form">
          <div class="setup-toggle-row">
            <div>
              <div class="setup-label">启用 API 接口</div>
              <div class="setup-sublabel">允许外部程序通过 HTTP 接口管理提醒</div>
            </div>
            <el-switch v-model="apiEnabled" />
          </div>

          <template v-if="apiEnabled">
            <div class="setup-field">
              <label class="setup-label">监听端口</label>
              <el-input-number
                v-model="apiPort"
                :min="1024"
                :max="65535"
                :step="1"
                size="large"
                controls-position="right"
                style="width: 100%;"
              />
            </div>
            <div class="setup-field">
              <label class="setup-label">访问令牌（Token）</label>
              <el-input
                v-model="apiToken"
                placeholder="留空则不校验，建议设置以保证安全"
                size="large"
                show-password
              />
            </div>
            <div class="setup-field">
              <label class="setup-label">监听地址</label>
              <el-input
                v-model="apiHost"
                placeholder="0.0.0.0 表示允许外部访问"
                size="large"
              />
            </div>
          </template>
        </div>
      </div>

      <!-- 步骤4: 完成 -->
      <div v-if="currentStep === 3" class="setup-content">
        <div class="setup-icon">🎉</div>
        <h2 class="setup-title">设置完成！</h2>
        <p class="setup-desc">一切就绪，开始使用 King 提醒助手吧</p>
        <div class="setup-summary">
          <div class="summary-item">
            <span class="summary-label">称呼</span>
            <span class="summary-value">{{ nickname || '未设置' }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">数据库加密</span>
            <span class="summary-value" :class="dbPassword ? 'enabled' : ''">
              {{ dbPassword ? '已设置密码' : '未加密' }}
            </span>
          </div>
          <div class="summary-item">
            <span class="summary-label">API 接口</span>
            <span class="summary-value" :class="apiEnabled ? 'enabled' : 'disabled'">
              {{ apiEnabled ? `已启用 (:${apiPort})` : '未启用' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="setup-actions">
        <el-button v-if="currentStep > 0" @click="prevStep">上一步</el-button>
        <div style="flex:1;" />
        <el-button v-if="currentStep < steps.length - 1" type="primary" @click="nextStep" :disabled="!canNext">
          下一步
        </el-button>
        <el-button v-else type="primary" @click="finish" :disabled="!canFinish">
          开始使用
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const emit = defineEmits<{
  (e: 'finish', data: {
    nickname: string;
    dbPassword: string;
    apiEnabled: boolean;
    apiPort: number;
    apiToken: string;
    apiHost: string
  }): void
}>()

const steps = [0, 1, 2, 3]
const currentStep = ref(0)

const nickname = ref('')
const dbPassword = ref('')
const dbPasswordConfirm = ref('')
const apiEnabled = ref(false)
const apiPort = ref(33333)
const apiToken = ref('')
const apiHost = ref('0.0.0.0')

const canNext = computed(() => {
  if (currentStep.value === 0) return nickname.value.trim().length > 0
  if (currentStep.value === 1) {
    if (dbPassword.value && dbPassword.value !== dbPasswordConfirm.value) return false
    return true
  }
  return true
})

const canFinish = computed(() => {
  return nickname.value.trim().length > 0
})

function prevStep() {
  if (currentStep.value > 0) currentStep.value--
}

function nextStep() {
  if (!canNext.value) return
  if (currentStep.value < steps.length - 1) currentStep.value++
}

function finish() {
  if (!canFinish.value) return
  emit('finish', {
    nickname: nickname.value.trim(),
    dbPassword: dbPassword.value,
    apiEnabled: apiEnabled.value,
    apiPort: apiPort.value,
    apiToken: apiToken.value,
    apiHost: apiHost.value
  })
}
</script>

<style scoped>
.setup-wizard-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-primary, #f5f7fa);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.setup-wizard {
  width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: 16px;
  padding: 32px 36px;
  box-shadow: var(--shadow-lg, 0 12px 32px rgba(0, 0, 0, 0.12));
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.setup-steps {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.setup-step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-color-light);
  transition: all 0.3s ease;
}

.setup-step-dot.active {
  width: 24px;
  border-radius: 4px;
  background: var(--color-primary, #409EFF);
}

.setup-step-dot.done {
  background: var(--color-primary, #409EFF);
}

.setup-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.setup-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.setup-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.setup-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: 20px;
  line-height: 1.6;
}

.setup-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: left;
}

.setup-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 6px;
  display: block;
}

.setup-sublabel {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.setup-error {
  font-size: 12px;
  color: #F56C6C;
  padding-left: 4px;
}

.setup-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-secondary, #f5f7fa);
  border-radius: 10px;
}

.setup-field {
  display: flex;
  flex-direction: column;
}

.setup-summary {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  background: var(--bg-secondary, #f5f7fa);
  border-radius: 10px;
  text-align: left;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.summary-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.summary-value.enabled {
  color: #67C23A;
}

.summary-value.disabled {
  color: var(--text-tertiary);
}

.setup-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
