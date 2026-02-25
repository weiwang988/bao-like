<script setup lang="ts">
import { ref } from 'vue'
import TitleBar from './TitleBar.vue'
import Sidebar from './Sidebar.vue'

const isCollapsed = ref(false)

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}
</script>

<template>
  <div class="layout">
    <TitleBar />
    <div class="main-container">
      <Sidebar :collapsed="isCollapsed" @toggle="toggleSidebar" />
      <div class="content-area">
        <router-view />
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: #f0f2f5;
}

.main-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.content-area {
  flex: 1;
  padding: 16px;
  overflow: auto;
  background-color: #f0f2f5;
}
</style>
