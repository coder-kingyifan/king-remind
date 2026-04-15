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

      <!-- 步骤2: 选择使用模式 -->
      <div v-if="currentStep === 1" class="setup-content">
        <div class="setup-icon">🎯</div>
        <h2 class="setup-title">选择使用模式</h2>
        <p class="setup-desc">根据你的需求选择合适的模式，后续可在设置中切换</p>
        <div class="setup-form">
          <div
            class="role-card"
            :class="{ active: appMode === 'simple' }"
            @click="appMode = 'simple'"
          >
            <div class="role-card-icon">🔔</div>
            <div class="role-card-body">
              <div class="role-card-title">普通模式</div>
              <div class="role-card-desc">简洁的提醒管理工具，手动创建和管理提醒</div>
              <div class="role-card-pages">
                <span class="role-page-tag">导览</span>
                <span class="role-page-tag">创建提醒</span>
                <span class="role-page-tag">消息渠道</span>
                <span class="role-page-tag">设置</span>
              </div>
            </div>
            <div v-if="appMode === 'simple'" class="role-card-check">✓</div>
          </div>

          <div
            class="role-card"
            :class="{ active: appMode === 'ai' }"
            @click="appMode = 'ai'"
          >
            <div class="role-card-icon">🤖</div>
            <div class="role-card-body">
              <div class="role-card-title">AI 模式</div>
              <div class="role-card-desc">全功能模式，通过 AI 对话智能创建提醒，支持技能扩展</div>
              <div class="role-card-pages">
                <span class="role-page-tag">AI 助手</span>
                <span class="role-page-tag">提醒管理</span>
                <span class="role-page-tag">模型配置</span>
                <span class="role-page-tag">技能中心</span>
                <span class="role-page-tag">更多</span>
              </div>
            </div>
            <div v-if="appMode === 'ai'" class="role-card-check">✓</div>
          </div>

          <!-- AI 提醒模式的提示 -->
          <div v-if="appMode === 'ai'" class="setup-tip tip-warning">
            <span class="tip-icon">💡</span>
            <div class="tip-content">
              <div class="tip-title">使用 AI 模式需要准备大模型 API Key</div>
              <div class="tip-desc">支持 OpenAI、DeepSeek、通义千问、Kimi 等主流大模型服务商。进入应用后请在「模型配置」中添加你的 API Key。</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 步骤3: 数据安全 -->
      <div v-if="currentStep === 2" class="setup-content">
        <div class="setup-icon">🔐</div>
        <h2 class="setup-title">数据安全</h2>
        <p class="setup-desc">为你的提醒数据设置加密密码，防止他人查看</p>
        <div class="setup-form">
          <div class="setup-field">
            <label class="setup-label">数据库加密密码</label>
            <el-input
              v-model="dbPassword"
              type="password"
              placeholder="设置密码以加密数据库"
              size="large"
              show-password
            />
            <div class="setup-sublabel">留空则不加密。建议设置密码以保护你的隐私数据，密码将用于加密本地数据库文件</div>
          </div>
          <div v-if="dbPassword" class="setup-field">
            <label class="setup-label">确认密码</label>
            <el-input
              v-model="dbPasswordConfirm"
              type="password"
              placeholder="再次输入密码确认"
              size="large"
              show-password
            />
          </div>
          <div v-if="dbPassword && dbPasswordConfirm && dbPassword !== dbPasswordConfirm" class="setup-error">
            两次输入的密码不一致，请重新输入
          </div>
          <div class="setup-tip tip-info">
            <span class="tip-icon">ℹ️</span>
            <div class="tip-content">
              <div class="tip-title">关于数据库加密</div>
              <div class="tip-desc">密码设置后，数据库文件将被加密存储。请务必牢记此密码，忘记密码将无法恢复数据。如需修改或移除加密，可在后续「系统设置」中操作。</div>
            </div>
          </div>
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
            <span class="summary-label">使用模式</span>
            <span class="summary-value enabled">{{ appMode === 'ai' ? 'AI 模式' : '普通模式' }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">数据库加密</span>
            <span class="summary-value" :class="dbPassword ? 'enabled' : ''">
              {{ dbPassword ? '已设置密码' : '未加密' }}
            </span>
          </div>
        </div>
        <div v-if="appMode === 'ai'" class="setup-tip tip-warning" style="margin-top: 12px;">
          <span class="tip-icon">💡</span>
          <div class="tip-content">
            <div class="tip-desc">进入应用后，请先在「模型配置」中添加大模型 API Key，才能使用 AI 对话功能。</div>
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
    appMode: string;
  }): void
}>()

const steps = [0, 1, 2, 3]
const currentStep = ref(0)

const nickname = ref('')
const appMode = ref('simple')
const dbPassword = ref('')
const dbPasswordConfirm = ref('')

const canNext = computed(() => {
  if (currentStep.value === 0) return nickname.value.trim().length > 0
  if (currentStep.value === 1) return appMode.value.length > 0
  if (currentStep.value === 2) {
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
    appMode: appMode.value
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
  width: 520px;
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
  line-height: 1.5;
}

.setup-error {
  font-size: 12px;
  color: #F56C6C;
  padding-left: 4px;
}

.setup-field {
  display: flex;
  flex-direction: column;
}

/* 角色选择卡片 */
.role-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px;
  background: var(--bg-secondary, #f5f7fa);
  border: 2px solid var(--border-color-light);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.role-card:hover {
  border-color: var(--color-primary, #409EFF);
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.1);
}

.role-card.active {
  border-color: var(--color-primary, #409EFF);
  background: var(--color-primary-bg, rgba(64, 158, 255, 0.06));
}

.role-card-icon {
  font-size: 28px;
  flex-shrink: 0;
  margin-top: 2px;
}

.role-card-body {
  flex: 1;
  min-width: 0;
}

.role-card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.role-card-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  line-height: 1.5;
}

.role-card-pages {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.role-page-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--bg-card, #fff);
  color: var(--text-tertiary);
  border: 1px solid var(--border-color-light);
}

.role-card.active .role-page-tag {
  color: var(--color-primary, #409EFF);
  border-color: var(--color-primary, #409EFF);
  background: var(--bg-card, #fff);
}

.role-card-check {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--color-primary, #409EFF);
  color: #fff;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* 提示框 */
.setup-tip {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  text-align: left;
  line-height: 1.5;
}

.setup-tip.tip-warning {
  background: rgba(230, 162, 60, 0.08);
  border: 1px solid rgba(230, 162, 60, 0.2);
}

.setup-tip.tip-info {
  background: rgba(64, 158, 255, 0.06);
  border: 1px solid rgba(64, 158, 255, 0.15);
}

.tip-icon {
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 1px;
}

.tip-content {
  flex: 1;
  min-width: 0;
}

.tip-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.tip-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* 摘要 */
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
