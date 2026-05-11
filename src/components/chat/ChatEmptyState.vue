<template>
  <div class="empty-state">
    <div class="empty-center">
      <div class="empty-icon">🤖</div>
      <p class="empty-title">我能为你做点什么？</p>
    </div>
    <div v-if="suggestions.length > 0" class="empty-suggestions">
      <div class="suggestion" v-for="s in suggestions" :key="s" @click="$emit('send-suggestion', s)">{{ s }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  suggestions: string[]
  hasModel: boolean
}>()

defineEmits<{
  (e: 'send-suggestion', text: string): void
}>()
</script>

<style scoped>
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 20px;
}

.empty-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-icon {
  font-size: 42px;
  line-height: 1;
}

.empty-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary);
}

.empty-suggestions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 320px;
  width: 100%;
  animation: fade-in 0.3s ease;
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
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
