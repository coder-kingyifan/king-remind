<template>
  <div class="unlock-overlay">
    <div class="unlock-card">
      <div class="unlock-icon">🔒</div>
      <h2 class="unlock-title">数据库已加密</h2>
      <p class="unlock-desc">请输入密码解锁数据库以继续使用</p>

      <div class="unlock-form" @keydown.enter="unlock">
        <el-input
          v-model="password"
          type="password"
          placeholder="请输入数据库密码"
          size="large"
          show-password
          :disabled="loading"
        />
        <div v-if="errorMsg" class="unlock-error">{{ errorMsg }}</div>
        <el-button
          type="primary"
          size="large"
          :loading="loading"
          :disabled="!password.trim()"
          @click="unlock"
          style="width: 100%;"
        >
          解锁
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref} from 'vue'

const emit = defineEmits<{
  (e: 'unlocked'): void
}>()

const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function unlock() {
  if (!password.value.trim()) return
  loading.value = true
  errorMsg.value = ''

  try {
    const result = await window.electronAPI.db.verifyPassword(password.value)
    if (!result) {
      errorMsg.value = '密码错误，请重试'
      return
    }

    const unlockResult: any = await (window as any).electronAPI.db.unlock?.(password.value)
    if (unlockResult?.success === false) {
      errorMsg.value = unlockResult.error || '解锁失败'
      return
    }

    emit('unlocked')
  } catch (e: any) {
    errorMsg.value = e.message || '解锁失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.unlock-overlay {
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

.unlock-card {
  width: 400px;
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: 16px;
  padding: 40px 36px;
  box-shadow: var(--shadow-lg, 0 12px 32px rgba(0, 0, 0, 0.12));
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.unlock-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.unlock-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.unlock-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: 24px;
}

.unlock-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.unlock-error {
  font-size: 12px;
  color: #F56C6C;
  text-align: left;
  padding-left: 4px;
}
</style>
