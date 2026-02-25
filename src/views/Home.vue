<script setup lang="ts">
</script>

<template>
  <div class="home-page">
    <el-card class="welcome-card">
      <template #header>
        <div class="card-header">
          <span>欢迎使用 BaoLike</span>
        </div>
      </template>
      <p class="welcome-text">这是一个基于 Electron + Vue3 + Vite 构建的桌面应用程序。</p>
      <el-divider />
      <div class="features">
        <h4>技术栈</h4>
        <el-tag type="primary" class="feature-tag">Electron</el-tag>
        <el-tag type="success" class="feature-tag">Vue 3</el-tag>
        <el-tag type="warning" class="feature-tag">Vite</el-tag>
        <el-tag type="danger" class="feature-tag">TypeScript</el-tag>
        <el-tag type="info" class="feature-tag">Element Plus</el-tag>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.home-page {
  height: 100%;
  display: flex;
}

.welcome-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.welcome-card :deep(.el-card__body) {
  flex: 1;
}

.card-header {
  font-size: 18px;
  font-weight: 600;
}

.welcome-text {
  color: #606266;
  line-height: 1.8;
}

.features {
  margin-top: 16px;
}

.features h4 {
  margin-bottom: 12px;
  color: #303133;
}

.feature-tag {
  margin-right: 8px;
  margin-bottom: 8px;
}
</style>
