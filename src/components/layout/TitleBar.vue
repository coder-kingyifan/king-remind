<template>
  <div class="title-bar">
    <div class="title-bar-drag">
      <span class="title-text">king提醒助手</span>
    </div>
    <div class="title-bar-controls">
      <div class="control-btn" :class="{ active: isAlwaysOnTop }" @click="toggleAlwaysOnTop" :title="isAlwaysOnTop ? '取消置顶' : '置顶'">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
        </svg>
      </div>
      <div class="control-btn" @click="minimize" title="最小化">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M6 13h12v-2H6z"/>
        </svg>
      </div>
      <div class="control-btn close-btn" @click="close" title="关闭">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, onMounted} from 'vue'

const isAlwaysOnTop = ref(false)

async function toggleAlwaysOnTop() {
  const result = await window.electronAPI.window.toggleAlwaysOnTop()
  isAlwaysOnTop.value = result
}

function minimize() {
  window.electronAPI.window.minimize()
}

function close() {
  window.electronAPI.window.close()
}

onMounted(async () => {
  try { isAlwaysOnTop.value = await window.electronAPI.window.isAlwaysOnTop() } catch { /* ignore */ }
})
</script>

<style scoped>
.title-bar {
  height: 40px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  -webkit-app-region: drag;
  background: transparent;
  padding: 0 0 0 16px;
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

.title-bar-controls {
  display: flex;
  align-items: center;
  height: 100%;
  -webkit-app-region: no-drag;
}

.control-btn {
  width: 46px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.control-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.control-btn.active {
  color: var(--color-primary);
}

.control-btn.active:hover {
  color: var(--color-primary);
  background: var(--color-primary-bg);
}

.close-btn:hover {
  background: #e81123;
  color: #fff;
}
</style>
