<template>
  <el-dialog
    :model-value="visible"
    title="编辑称呼"
    width="400px"
    :close-on-click-modal="true"
    :show-close="true"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="nickname-intro">
      <div class="nickname-icon">👤</div>
      <p class="nickname-text">修改你的称呼</p>
      <p class="nickname-hint">AI 会用这个昵称呼叫你</p>
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
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="confirm" :disabled="!nickname.trim()">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import {onMounted, ref, watch} from 'vue'

const props = defineProps<{
  visible: boolean
  currentNickname?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'confirm', nickname: string): void
}>()

const nickname = ref('')

watch(() => props.visible, (val) => {
  if (val) {
    nickname.value = props.currentNickname || ''
  }
})

onMounted(() => {
  nickname.value = props.currentNickname || ''
})

function confirm() {
  const name = nickname.value.trim()
  if (name) {
    emit('confirm', name)
  }
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
