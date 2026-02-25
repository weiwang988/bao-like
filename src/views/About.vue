<script setup lang="ts">
</script>

<template>
  <div class="about-page">
    <el-card>
      <template #header>
        <span>关于 BaoLike</span>
      </template>
      <div class="about-content">
        <div class="app-info">
          <h2 class="app-name">BaoLike</h2>
          <p class="version">版本: 1.0.0</p>
        </div>
        <el-divider />
        <div class="description">
          <p>BaoLike 是一个现代化的桌面应用程序，采用 Electron + Vue 3 + Vite 技术栈构建。</p>
        </div>
        <el-divider />
        <div class="copyright">
          <p>&copy; 2024 BaoLike. All rights reserved.</p>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.about-page {
  max-width: 500px;
}

.about-content {
  text-align: center;
}

.app-name {
  font-size: 28px;
  color: #667eea;
  margin-bottom: 8px;
}

.version {
  color: #909399;
  font-size: 14px;
}

.description {
  color: #606266;
  line-height: 1.8;
}

.copyright {
  color: #909399;
  font-size: 12px;
}
</style>
