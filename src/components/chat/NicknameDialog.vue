<template>
  <el-dialog
    :model-value="visible"
    title="欢迎"
    width="400px"
    :close-on-click-modal="false"
    :show-close="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="nickname-intro">
      <div class="nickname-icon">👋</div>
      <p class="nickname-text">欢迎使用 King 提醒助手！</p>
      <p class="nickname-hint">请输入你的昵称，AI 会用这个昵称呼叫你</p>
    </div>
    <el-input
      v-model="nickname"
      placeholder="请输入昵称"
      maxlength="20"
      show-word-limit
      size="large"
      @keydown.enter="confirm"
    />
    <template #footer>
      <el-button @click="skip">跳过</el-button>
      <el-button type="primary" @click="confirm" :disabled="!nickname.trim()">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import {ref} from 'vue'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'confirm', nickname: string): void
  (e: 'skip'): void
}>()

const nickname = ref('')

function confirm() {
  const name = nickname.value.trim()
  if (name) {
    emit('confirm', name)
  }
}

function skip() {
  emit('skip')
}
</script>

<style scoped>
.nickname-intro {
  text-align: center;
  margin-bottom: 16px;
}

.nickname-icon {
  font-size: 36px;
  margin-bottom: 8px;
}

.nickname-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.nickname-hint {
  font-size: 13px;
  color: var(--text-tertiary);
}
</style>
