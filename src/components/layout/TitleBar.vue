<template>
  <div class="title-bar">
    <div class="title-bar-drag">
      <span class="title-text">king提醒助手</span>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.title-bar {
  height: 40px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  -webkit-app-region: drag;
  background: transparent;
  padding: 0 16px;
}

.title-bar-drag {
  flex: 1;
  display: flex;
  align-items: center;
}

.title-text {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary);
  user-select: none;
}
</style>
