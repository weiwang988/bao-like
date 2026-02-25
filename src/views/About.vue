<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { InfoFilled, Link, Warning, Promotion } from '@element-plus/icons-vue'

interface SystemInfo {
  platform: string;
  arch: string;
  version: string;
  userAgent: string;
}

const appVersion = ref('1.0.0');
const githubUrl = ref('https://github.com/weiwang988/bao-like');
const systemInfo = ref<SystemInfo | null>(null);
const loading = ref(true);

onMounted(() => {
  // 从 package.json 获取应用版本信息
  try {
    // 尝试从 Electron 环境获取版本
    if ((window as any).require) {
      const electron = (window as any).require('electron');
      if (electron && electron.remote) {
        const app = electron.remote.app;
        appVersion.value = app.getVersion();
      } else {
        // 使用 window.process 方式获取版本
        if ((window as any).process && (window as any).process.versions.electron) {
          // 从 package.json 读取版本
          appVersion.value = '1.0.0';
        }
      }
    } else {
      // 如果不是在 Electron 环境中，则使用默认版本
      appVersion.value = '1.0.0';
    }
  } catch (error) {
    console.warn('无法获取应用版本:', error);
    appVersion.value = '1.0.0';
  }
  
  // 设置加载完成
  loading.value = false;
});

const features = [
  { name: 'Electron', desc: '跨平台桌面应用框架' },
  { name: 'Vue 3', desc: '渐进式 JavaScript 框架' },
  { name: 'TypeScript', desc: 'JavaScript 的超集，提供类型检查' },
  { name: 'Vite', desc: '下一代前端构建工具' },
  { name: 'Element Plus', desc: '基于 Vue 3 的 UI 组件库' },
  { name: 'Vue Router', desc: 'Vue.js 的官方路由管理器' }
];

const openLink = (url: string) => {
  if (url && window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url);
  } else {
    // 备用方案
    window.open(url, '_blank');
  }
};
</script>

<template>
  <div class="about-page">
    <el-card class="about-card">
      <template #header>
        <div class="card-header">
          <div class="app-logo">
            <el-icon size="32" style="color: #667eea;">
              <InfoFilled />
            </el-icon>
          </div>
          <div class="app-title">
            <h2 class="app-name">BaoLike</h2>
            <p class="version">版本: {{ appVersion }}</p>
          </div>
        </div>
      </template>
      
      <div class="about-content">
        <!-- 应用描述 -->
        <div class="description-section">
          <h3>应用简介</h3>
          <p>BaoLike 是一款现代化的桌面应用程序，旨在帮助用户管理和监控本地开发环境。它提供了包管理器集成、系统监控、工具扫描等功能，让开发者能够轻松管理他们的开发工具和环境。</p>
        </div>
        
        <el-divider />
        
        <!-- 技术栈 -->
        <div class="tech-stack-section">
          <h3>技术栈</h3>
          <div class="tech-grid">
            <div v-for="feature in features" :key="feature.name" class="tech-item">
              <div class="tech-name">{{ feature.name }}</div>
              <div class="tech-desc">{{ feature.desc }}</div>
            </div>
          </div>
        </div>
        
        <el-divider />
        
        <!-- 项目链接 -->
        <div class="project-links-section">
          <h3>项目链接</h3>
          <div class="project-links">
            <el-link type="primary" @click="openLink(githubUrl)" class="link-item">
              <el-icon><Link /></el-icon>
              <span>GitHub 仓库</span>
            </el-link>
            <el-link type="primary" @click="openLink('https://github.com/weiwang988/bao-like/issues')" class="link-item">
              <el-icon><Warning /></el-icon>
              <span>问题反馈</span>
            </el-link>
            <el-link type="primary" @click="openLink('https://github.com/weiwang988/bao-like/releases')" class="link-item">
              <el-icon><Promotion /></el-icon>
              <span>发布版本</span>
            </el-link>
          </div>
        </div>
        
        <el-divider />
        
        <!-- 版权信息 -->
        <div class="footer-section">
          <div class="copyright">
            <p>&copy; 2024 BaoLike. All rights reserved.</p>
            <p>使用 MIT 许可证</p>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.about-page {
  max-width: 800px;
  margin: 0 auto;
}

.about-card {
  min-height: 500px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.app-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
}

.app-title {
  flex: 1;
}

.app-name {
  font-size: 28px;
  color: #303133;
  margin: 0;
  font-weight: 600;
}

.version {
  color: #909399;
  font-size: 16px;
  margin: 8px 0 0 0;
}

.about-content {
  padding: 20px 0;
}

.description-section h3,
.tech-stack-section h3,
.project-links-section h3,
.footer-section h3 {
  color: #303133;
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 500;
}

.description-section p {
  color: #606266;
  line-height: 1.8;
  text-align: left;
}

.tech-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.tech-item {
  padding: 12px;
  background-color: #f5f7fa;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
}

.tech-name {
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.tech-desc {
  font-size: 14px;
  color: #909399;
}

.project-links {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.link-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.link-item:hover {
  background-color: #f5f7fa;
}

.links {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-bottom: 16px;
}

.copyright {
  text-align: center;
  color: #909399;
  font-size: 14px;
  line-height: 1.6;
}
</style>
