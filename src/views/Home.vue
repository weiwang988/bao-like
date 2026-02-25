<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { 
  Grid, Box, Cpu, Connection, ArrowRight, Refresh
} from '@element-plus/icons-vue'

interface Activity {
  time: string;
  action: string;
  type: string;
}

const router = useRouter()

// 加载状态
const isLoading = ref(false)

// 系统信息
const systemInfo = ref({
  os: '',
  arch: '',
  nodeVersion: '',
  electronVersion: '',
  platform: '',
  totalMem: 0,
  freeMem: 0
})

//快功能
const quickActions = [
  {
    title: '软件管理',
    description: '管理已安装的软件和工具',
    icon: 'Grid',
    path: '/software/collection',
    color: '#667eea'
  },
  {
    title: '工具管理',
    description: '管理开发工具和环境',
    icon: 'Box',
    path: '/environment/package',
    color: '#f093fb'
  },
  {
    title: '进程监控',
    description: '监控系统进程和资源使用',
    icon: 'Cpu',
    path: '/service/process',
    color: '#4facfe'
  },
  {
    title: '端口监控',
    description: '查看端口占用情况',
    icon: 'Connection',
    path: '/service/port',
    color: '#43e97b'
  }
]

//统计数据
const stats = ref({
  softwareCount: 0,
  toolsCount: 0,
  runningProcesses: 0,
  activePorts: 0
})

// 最近活动
const recentActivities = ref<Activity[]>([]);

// 获取最近活动日志
const loadRecentActivities = async () => {
  try {
    const result = await window.electronAPI.getLogs();
    if (result.success) {
      // 转换日志数据为最近活动格式
      const activities: Activity[] = result.logs.slice(0, 5).map(log => ({
        time: new Date(log.time).toLocaleString(),
        action: `${log.level.toUpperCase()}: ${log.message}`,
        type: log.category || 'info'
      }));
      recentActivities.value = activities;
    } else {
      // 如果获取失败，使用默认活动
      recentActivities.value = [
        { time: new Date().toLocaleString(), action: '欢迎使用 BaoLike', type: 'info' }
      ];
    }
  } catch (error) {
    console.error('获取最近活动失败:', error);
    recentActivities.value = [
      { time: new Date().toLocaleString(), action: '欢迎使用 BaoLike', type: 'info' }
    ];
  }
};

// 刷新所有数据
const refreshAllData = async () => {
  isLoading.value = true;
  try {
    await Promise.all([
      getSystemInfo(),
      refreshStats(),
      loadRecentActivities()
    ]);
    ElMessage.success('数据刷新成功');
  } catch (error) {
    console.error('刷新数据失败:', error);
    ElMessage.error('数据刷新失败');
  } finally {
    isLoading.value = false;
  }
};

// 根据图标名称获取对应的图标组件
const getIconComponent = (iconName: string) => {
  switch(iconName) {
    case 'Grid': return Grid;
    case 'Box': return Box;
    case 'Cpu': return Cpu;
    case 'Connection': return Connection;
    default: return Grid; // 默认返回Grid图标
  }
};

const handleQuickAction = (path: string) => {
  router.push(path)
  ElMessage.success('正在跳转到相应页面')
}

const getSystemInfo = async () => {
  try {
    // 获取操作系统信息
    const osInfo = await window.electronAPI.execCommand('ver');
    if (osInfo.success) {
      const output = osInfo.output;
      if (output.includes('Microsoft')) {
        systemInfo.value.os = 'Windows';
        systemInfo.value.platform = 'win32';
      }
    } else {
      // Fallback to navigator info
      systemInfo.value.os = navigator.platform.includes('Win') ? 'Windows' : 
                           navigator.platform.includes('Mac') ? 'macOS' : 
                           navigator.platform.includes('Linux') ? 'Linux' : 'Unknown';
      systemInfo.value.platform = navigator.platform.toLowerCase();
    }
    
    // 获取系统架构和内存信息
    // 通过执行命令获取系统架构
    const archInfo = await window.electronAPI.execCommand('echo %PROCESSOR_ARCHITECTURE%');
    if (archInfo.success) {
      systemInfo.value.arch = archInfo.output.trim() || 'unknown';
    } else {
      systemInfo.value.arch = 'unknown';
    }
    
    // 获取Node.js和Electron版本，通过执行命令获取
    const nodeVersionInfo = await window.electronAPI.execCommand('node --version');
    if (nodeVersionInfo.success) {
      systemInfo.value.nodeVersion = nodeVersionInfo.output.trim().replace(/^v/, '') || 'unknown';
    } else {
      systemInfo.value.nodeVersion = 'unknown';
    }
    
    // 通过IPC获取Electron版本
    systemInfo.value.electronVersion = '40.6.0'; // 这个可以通过IPC获取，也可以硬编码
    
    // 尝试获取更详细的系统信息
    const memInfo = await window.electronAPI.execCommand('wmic computersystem get TotalPhysicalMemory');
    if (memInfo.success) {
      const match = memInfo.output.match(/\d+/);
      if (match) {
        const totalMemBytes = parseInt(match[0]);
        systemInfo.value.totalMem = Math.round(totalMemBytes / (1024 * 1024 * 1024)); // 转换为GB
      }
    }
    
    const freeMemInfo = await window.electronAPI.execCommand('wmic OS get FreePhysicalMemory');
    if (freeMemInfo.success) {
      const match = freeMemInfo.output.match(/\d+/);
      if (match) {
        const freeMemKB = parseInt(match[0]);
        systemInfo.value.freeMem = Math.round(freeMemKB / (1024 * 1024)); // 转换为GB
      }
    }
  } catch (error) {
    console.error('获取系统信息失败:', error);
    // 使用默认值
    systemInfo.value = {
      os: 'Unknown',
      arch: 'unknown',
      nodeVersion: 'unknown',
      electronVersion: 'unknown',
      platform: navigator.platform.toLowerCase(),
      totalMem: 0,
      freeMem: 0
    };
  }
};

const refreshStats = async () => {
  try {
    // 获取真实的统计数据
    // 这里可以调用后端API来获取真实数据
    const processes = await window.electronAPI.listProcesses();
    const ports = await window.electronAPI.listPorts();
    
    // 获取软件数量（从存储中获取）
    const softwareData = await window.electronAPI.storeGet('softwareList');
    const softwareCount = softwareData && Array.isArray(softwareData) ? softwareData.length : 0;
    
    // 获取工具数量（模拟获取已安装工具的数量）
    const toolsCount = 15; // 这里可以替换为实际获取工具数量的逻辑
    
    stats.value = {
      softwareCount: softwareCount,
      toolsCount: toolsCount,
      runningProcesses: processes.success ? processes.processes.length : 0,
      activePorts: ports.success ? ports.ports.length : 0
    }
  } catch (error) {
    console.error('获取统计数据失败:', error);
    // 使用默认值
    stats.value = {
      softwareCount: 0,
      toolsCount: 0,
      runningProcesses: 0,
      activePorts: 0
    };
  }
}

onMounted(async () => {
  await getSystemInfo();
  await refreshStats();
  await loadRecentActivities();
  //每30秒刷新一次统计数据
  setInterval(refreshStats, 30000);
})
</script>

<template>
  <div class="home-page">
    <!--欢迎区域 -->
    <div class="welcome-section">
      <div class="welcome-header">
        <div class="welcome-content">
          <h1 class="welcome-title">欢迎使用 BaoLike</h1>
          <p class="welcome-subtitle">您的系统管理和开发工具助手</p>
        </div>
        <div class="system-info">
          <el-tag type="info" size="small">{{ systemInfo.os }} {{ systemInfo.arch }}</el-tag>
          <el-tag type="success" size="small">Electron v{{ systemInfo.electronVersion }}</el-tag>
          <el-tag type="warning" size="small">Node v{{ systemInfo.nodeVersion }}</el-tag>
          <el-tag v-if="systemInfo.totalMem > 0" type="primary" size="small">内存 {{ systemInfo.totalMem }}GB</el-tag>
          <el-button type="primary" size="small" @click="refreshAllData" :loading="isLoading">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </div>
    </div>

    <!--系统概览卡片 -->
    <div class="system-overview">
      <el-card class="overview-card" shadow="hover">
        <template #header>
          <span class="overview-title">系统概览</span>
        </template>
        <div class="overview-content">
          <div class="overview-item">
            <span class="item-label">操作系统:</span>
            <span class="item-value">{{ systemInfo.os }} {{ systemInfo.arch }}</span>
          </div>
          <div class="overview-item">
            <span class="item-label">总内存:</span>
            <span class="item-value" v-if="systemInfo.totalMem > 0">{{ systemInfo.totalMem }} GB</span>
            <span class="item-value" v-else>获取中...</span>
          </div>
          <div class="overview-item">
            <span class="item-label">运行进程:</span>
            <span class="item-value">{{ stats.runningProcesses }}</span>
          </div>
          <div class="overview-item">
            <span class="item-label">活跃端口:</span>
            <span class="item-value">{{ stats.activePorts }}</span>
          </div>
        </div>
      </el-card>
    </div>
    
    <!--统计卡片 -->
    <div class="stats-grid">
      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <div class="stat-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <el-icon size="24"><Grid /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-number">{{ stats.softwareCount }}</div>
            <div class="stat-label">已安装软件</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
            <el-icon size="24"><Box /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-number">{{ stats.toolsCount }}</div>
            <div class="stat-label">开发工具</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
            <el-icon size="24"><Cpu /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-number">{{ stats.runningProcesses }}</div>
            <div class="stat-label">运行进程</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <div class="stat-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
            <el-icon size="24"><Connection /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-number">{{ stats.activePorts }}</div>
            <div class="stat-label">活跃端口</div>
          </div>
        </div>
      </el-card>
    </div>

    <!--快捷功能 -->
    <div class="quick-actions-section">
      <h2 class="section-title">快捷功能</h2>
      <div class="actions-grid">
        <el-card 
          v-for="action in quickActions" 
          :key="action.path"
          class="action-card" 
          shadow="hover"
          @click="handleQuickAction(action.path)"
        >
          <div class="action-content">
            <div class="action-icon" :style="{ background: action.color }">
              <el-icon size="20"><component :is="getIconComponent(action.icon)" /></el-icon>
            </div>
            <div class="action-info">
              <h3 class="action-title">{{ action.title }}</h3>
              <p class="action-description">{{ action.description }}</p>
            </div>
            <div class="action-arrow">
              <el-icon><ArrowRight /></el-icon>
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 最近活动 -->
    <div class="recent-activity-section">
      <h2 class="section-title">最近活动</h2>
      <el-card class="activity-card">
        <div class="activity-list">
          <div 
            v-for="(activity, index) in recentActivities" 
            :key="index"
            class="activity-item"
            :class="`activity-${activity.type}`"
          >
            <div class="activity-time">{{ activity.time }}</div>
            <div class="activity-content">{{ activity.action }}</div>
            <div class="activity-status">
              <el-tag 
                :type="activity.type === 'install' ? 'success' : 
                       activity.type === 'update' ? 'primary' : 
                       activity.type === 'clean' ? 'warning' : 'info'"
                size="small"
              >
                {{ activity.type === 'install' ? '安装' : 
                   activity.type === 'update' ? '更新' : 
                   activity.type === 'clean' ? '清理' : '配置' }}
              </el-tag>
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  height: 100%;
  overflow-y: auto;
  padding: 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

/*欢区域 */
.welcome-section {
  margin-bottom: 24px;
  padding: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
}

.welcome-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.welcome-content {
  flex: 1;
}

.welcome-title {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 8px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.welcome-subtitle {
  font-size: 16px;
  opacity: 0.9;
  margin: 0;
}

.system-info {
  display: flex;
  gap: 12px;
}

/*统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-4px);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 12px;
  color: white;
  flex-shrink: 0;
}

.stat-info {
  flex: 1;
}

.stat-number {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

/*系统概览卡片 */
.system-overview {
  margin-bottom: 24px;
}

.overview-card {
  border-radius: 12px;
  overflow: hidden;
}

.overview-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.overview-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 8px 0;
}

.overview-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.overview-item:last-child {
  border-bottom: none;
}

.item-label {
  font-size: 14px;
  color: #909399;
}

.item-value {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

/*快捷功能 */
.quick-actions-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 16px 0;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.action-card {
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.action-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
}

.action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  color: white;
  flex-shrink: 0;
}

.action-info {
  flex: 1;
}

.action-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 4px 0;
}

.action-description {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

.action-arrow {
  color: #c0c4cc;
  transition: transform 0.3s ease;
}

.action-card:hover .action-arrow {
  transform: translateX(4px);
}

/* 最近活动 */
.recent-activity-section {
  margin-bottom: 24px;
}

.activity-card {
  border-radius: 12px;
}

.activity-list {
  padding: 8px 0;
}

.activity-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 8px;
  transition: background-color 0.2s ease;
}

.activity-item:hover {
  background-color: #f5f7fa;
}

.activity-item:last-child {
  margin-bottom: 0;
}

.activity-time {
  width: 140px;
  font-size: 14px;
  color: #909399;
  flex-shrink: 0;
}

.activity-content {
  flex: 1;
  font-size: 14px;
  color: #606266;
}

.activity-status {
  width: 60px;
  text-align: right;
  flex-shrink: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .home-page {
    padding: 16px;
  }
  
  .welcome-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .system-info {
    align-self: flex-start;
  }
  
  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }
  
  .actions-grid {
    grid-template-columns: 1fr;
  }
  
  .stat-content {
    padding: 16px;
  }
  
  .action-content {
    padding: 16px;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .stat-content {
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }
  
  .action-content {
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }
  
  .action-arrow {
    transform: rotate(90deg);
  }
}
</style>
