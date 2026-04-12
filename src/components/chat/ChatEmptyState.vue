<template>
  <div class="empty-state">
    <div class="empty-greeting">
      <div class="greeting-icon">💬</div>
      <p class="greeting-text">{{ displayGreeting }}</p>
    </div>
    <div class="empty-suggestions">
      <div class="suggestion" v-for="s in suggestions" :key="s" @click="$emit('send-suggestion', s)">{{ s }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed} from 'vue'

const props = defineProps<{
  greeting: string
  suggestions: string[]
  loading: boolean
}>()

defineEmits<{
  (e: 'send-suggestion', text: string): void
}>()

const displayGreeting = computed(() => {
  if (props.loading) return '正在获取问候...'
  return props.greeting || '有什么可以帮你的？'
})
</script>

<style scoped>
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 20px;
}

.empty-greeting {
  text-align: center;
}

.greeting-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.greeting-text {
  font-size: 16px;
  color: var(--text-secondary);
  animation: fade-in 0.5s ease;
}

.empty-suggestions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 360px;
  width: 100%;
}

.suggestion {
  padding: 10px 18px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color-light);
  border-radius: 10px;
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
  transform: translateY(-1px);
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
