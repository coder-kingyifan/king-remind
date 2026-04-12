<template>
  <div class="chat-avatar" :class="role">
    <span v-if="role === 'user'" class="avatar-text">{{ userInitial }}</span>
    <span v-else class="avatar-text">AI</span>
  </div>
</template>

<script setup lang="ts">
import {computed} from 'vue'

const props = defineProps<{
  role: 'user' | 'assistant'
  nickname?: string
}>()

const userInitial = computed(() => {
  if (props.nickname) return props.nickname.charAt(0).toUpperCase()
  return 'U'
})
</script>

<style scoped>
.chat-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 700;
  user-select: none;
}

.chat-avatar.user {
  background: linear-gradient(135deg, #409EFF, #7B61FF);
  color: #fff;
}

.chat-avatar.assistant {
  background: linear-gradient(135deg, #67C23A, #26D9A0);
  color: #fff;
}
</style>
