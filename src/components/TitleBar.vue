<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Minus, FullScreen, Close, CopyDocument } from '@element-plus/icons-vue'

const isMaximized = ref(false)

const minimize = () => {
  window.electronAPI?.minimize()
}

const maximize = () => {
  window.electronAPI?.maximize()
}

const closeWindow = () => {
  window.electronAPI?.close()
}

onMounted(() => {
  window.electronAPI?.onMaximizeChange((maximized: boolean) => {
    isMaximized.value = maximized
  })
})
</script>

<template>
  <div class="title-bar">
    <div class="drag-region">
      <div class="logo-area">
        <span class="logo-text">BaoLike</span>
      </div>
    </div>
    <div class="window-controls">
      <button class="control-btn minimize" @click="minimize" title="最小化">
        <el-icon><Minus /></el-icon>
      </button>
      <button class="control-btn maximize" @click="maximize" :title="isMaximized ? '还原' : '最大化'">
        <el-icon>
          <CopyDocument v-if="isMaximized" />
          <FullScreen v-else />
        </el-icon>
      </button>
      <button class="control-btn close" @click="closeWindow" title="关闭">
        <el-icon><Close /></el-icon>
      </button>
    </div>
  </div>
</template>

<style scoped>
.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 36px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  user-select: none;
}

.drag-region {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  -webkit-app-region: drag;
}

.logo-area {
  display: flex;
  align-items: center;
  padding-left: 12px;
  -webkit-app-region: no-drag;
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 1px;
}

.window-controls {
  display: flex;
  height: 100%;
  -webkit-app-region: no-drag;
}

.control-btn {
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.control-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.control-btn.close:hover {
  background-color: #e81123;
}

.control-btn .el-icon {
  font-size: 14px;
}
</style>
