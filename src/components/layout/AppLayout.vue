<template>
  <div class="layout">
    <Sidebar />
    <div class="layout-main">
      <TitleBar />
      <div class="layout-content">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Sidebar from './Sidebar.vue'
import TitleBar from './TitleBar.vue'
</script>

<style scoped>
.layout {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.layout-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-secondary);
}

.layout-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}
</style>
