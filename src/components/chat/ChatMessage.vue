<template>
  <div class="message" :class="message.role">
    <ChatAvatar :role="message.role" :nickname="nickname"/>
    <div class="message-body">
      <div class="message-meta">
        <span class="message-sender">{{ message.role === 'user' ? (nickname || '我') : 'AI 助手' }}</span>
        <span v-if="timeAgo" class="message-time">{{ timeAgo }}</span>
      </div>
      <!-- User images -->
      <div v-if="message.role === 'user' && message.images && message.images.length" class="message-images">
        <img v-for="(img, iIdx) in message.images" :key="iIdx" :src="img" class="message-image-thumb"
             @click="$emit('preview-image', img)"/>
      </div>
      <!-- Thinking block -->
      <div v-if="message.role === 'assistant' && message.thinking" class="thinking-block"
           @click="$emit('toggle-thinking', index)">
        <div class="thinking-header">
          <span class="thinking-toggle">{{ isThinkingOpen ? '▼' : '▶' }}</span>
          <span class="thinking-label">思考过程</span>
        </div>
        <div v-if="isThinkingOpen" class="thinking-content">{{ message.thinking }}</div>
      </div>
      <div class="message-content" v-html="renderedContent"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed} from 'vue'
import ChatAvatar from './ChatAvatar.vue'

export interface ChatMessageData {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
  thinking?: string
}

const props = defineProps<{
  message: ChatMessageData
  index: number
  isThinkingOpen: boolean
  nickname?: string
  timeAgo?: string
}>()

defineEmits<{
  (e: 'toggle-thinking', index: number): void
  (e: 'preview-image', url: string): void
}>()

const renderedContent = computed(() => {
  return props.message.content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
})
</script>

<style scoped>
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
  user-select: none;
}

.thinking-toggle {
  font-size: 10px;
  color: var(--text-tertiary);
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
</style>
