<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

interface SettingsForm {
  theme: 'light' | 'dark'
  language: 'zh-CN' | 'en-US'
  autoStart: boolean
  autoScanOnStartup: boolean
  checkForUpdates: boolean
  checkFrequency?: 'daily' | 'weekly' | 'monthly'
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  maxLogEntries: number
  enableNotifications: boolean
}

const form = ref<SettingsForm>({
  theme: 'light',
  language: 'zh-CN',
  autoStart: false,
  autoScanOnStartup: true,
  checkForUpdates: true,
  logLevel: 'info',
  maxLogEntries: 1000,
  enableNotifications: true
})

const storePath = ref('')
const appVersion = ref('1.0.0')
const loading = ref(false)
const systemInfo = ref<any>({})

// 加载设置
const loadSettings = async () => {
  try {
    // 从存储中加载设置
    const savedSettings = await window.electronAPI.storeGet('settings')
    if (savedSettings) {
      form.value = { ...form.value, ...savedSettings }
    }
    
    // 获取存储路径
    storePath.value = await window.electronAPI.getStorePath()
    
    // 获取应用版本
    const packageInfo: any = await window.electronAPI.storeGet('packageInfo')
    if (packageInfo?.version) {
      appVersion.value = packageInfo.version
    }
    
    // 获取系统信息
    try {
      systemInfo.value = await window.electronAPI.getSystemInfo()
    } catch (error) {
      console.error('获取系统信息失败:', error)
    }
  } catch (error) {
    console.error('加载设置失败:', error)
    ElMessage.error('加载设置失败')
  }
}

// 保存设置
const saveSettings = async () => {
  loading.value = true
  try {
    await window.electronAPI.storeSet('settings', form.value)
    ElMessage.success('设置保存成功')
    
    // 应用主题设置
    if (form.value.theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    
    // 应用开机启动设置
    if (form.value.autoStart !== undefined) {
      await window.electronAPI.setAutoStart(form.value.autoStart)
    }
  } catch (error) {
    console.error('保存设置失败:', error)
    ElMessage.error('保存设置失败')
  } finally {
    loading.value = false
  }
}

// 重置设置
const resetSettings = async () => {
  try {
    await ElMessageBox.confirm('确定要重置所有设置为默认值吗？', '确认重置', {
      type: 'warning'
    })
    
    form.value = {
      theme: 'light',
      language: 'zh-CN',
      autoStart: false,
      autoScanOnStartup: true,
      checkForUpdates: true,
      logLevel: 'info',
      maxLogEntries: 1000,
      enableNotifications: true
    }
    
    await saveSettings()
    ElMessage.success('设置已重置为默认值')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('重置设置失败:', error)
      ElMessage.error('重置设置失败')
    }
  }
}

// 打开存储目录
const openStoreDirectory = async () => {
  try {
    const path = await window.electronAPI.getStorePath()
    if (path) {
      await window.electronAPI.showItemInFolder(path)
    }
  } catch (error) {
    console.error('打开存储目录失败:', error)
    ElMessage.error('打开存储目录失败')
  }
}

// 检查更新
const checkForUpdates = async () => {
  loading.value = true
  try {
    ElMessage.info('正在检查更新...')
    // 这里可以实现实际的更新检查逻辑
    setTimeout(() => {
      ElMessage.success('当前已是最新版本')
      loading.value = false
    }, 1500)
  } catch (error) {
    console.error('检查更新失败:', error)
    ElMessage.error('检查更新失败')
    loading.value = false
  }
}

// 格式化字节大小
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

onMounted(() => {
  loadSettings()
})
</script>

<template>
  <div class="settings-page">
    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <span>系统设置</span>
          <div class="header-actions">
            <el-button @click="checkForUpdates" :loading="loading" size="small">
              检查更新
            </el-button>
            <el-button @click="resetSettings" size="small" type="warning">
              重置设置
            </el-button>
          </div>
        </div>
      </template>
      
      <el-tabs type="border-card">
        <!-- 基本设置 -->
        <el-tab-pane label="基本设置">
          <el-form :model="form" label-width="120px" label-position="left">
            <el-form-item label="主题模式">
              <el-radio-group v-model="form.theme">
                <el-radio value="light">浅色主题</el-radio>
                <el-radio value="dark">深色主题</el-radio>
              </el-radio-group>
            </el-form-item>
            
            <el-form-item label="界面语言">
              <el-select v-model="form.language" style="width: 200px">
                <el-option label="简体中文" value="zh-CN" />
                <el-option label="English" value="en-US" />
              </el-select>
            </el-form-item>
            
            <el-form-item label="开机启动">
              <el-switch v-model="form.autoStart" />
              <span class="form-item-tip">系统启动时自动运行 BaoLike</span>
            </el-form-item>
            
            <el-form-item label="启动时扫描">
              <el-switch v-model="form.autoScanOnStartup" />
              <span class="form-item-tip">应用启动时自动扫描已安装的工具</span>
            </el-form-item>
            
            <el-form-item label="启用通知">
              <el-switch v-model="form.enableNotifications" />
              <span class="form-item-tip">启用系统通知功能</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        
        <!-- 更新设置 -->
        <el-tab-pane label="更新设置">
          <el-form :model="form" label-width="120px" label-position="left">
            <el-form-item label="自动检查更新">
              <el-switch v-model="form.checkForUpdates" />
              <span class="form-item-tip">定期检查新版本</span>
            </el-form-item>
            
            <el-form-item label="检查频率">
              <el-select v-model="form.checkFrequency" style="width: 200px" disabled>
                <el-option label="每天" value="daily" />
                <el-option label="每周" value="weekly" />
                <el-option label="每月" value="monthly" />
              </el-select>
              <span class="form-item-tip">（功能待实现）</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        
        <!-- 日志设置 -->
        <el-tab-pane label="日志设置">
          <el-form :model="form" label-width="120px" label-position="left">
            <el-form-item label="日志级别">
              <el-select v-model="form.logLevel" style="width: 200px">
                <el-option label="调试 (Debug)" value="debug" />
                <el-option label="信息 (Info)" value="info" />
                <el-option label="警告 (Warn)" value="warn" />
                <el-option label="错误 (Error)" value="error" />
              </el-select>
            </el-form-item>
            
            <el-form-item label="最大日志条数">
              <el-input-number v-model="form.maxLogEntries" :min="100" :max="10000" />
              <span class="form-item-tip">保留的日志条目数量</span>
            </el-form-item>
            
            <el-form-item label="存储位置">
              <el-input v-model="storePath" readonly style="width: 300px" />
              <el-button @click="openStoreDirectory" style="margin-left: 10px">
                打开目录
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        
        <!-- 关于 -->
        <el-tab-pane label="关于">
          <div class="about-section">
            <div class="app-info">
              <h3>BaoLike</h3>
              <p>版本: {{ appVersion }}</p>
              <p>一个现代化的开发工具管理平台</p>
              <p>基于 Electron + Vue3 + Element Plus 构建</p>
            </div>
            
            <div class="system-info">
              <h4>系统信息</h4>
              <el-descriptions :column="1" border>
                <el-descriptions-item label="操作系统">
                  {{ systemInfo.platform || 'Windows' }}
                </el-descriptions-item>
                <el-descriptions-item label="架构">
                  {{ systemInfo.arch || 'x64' }}
                </el-descriptions-item>
                <el-descriptions-item label="Node.js版本">
                  {{ systemInfo.nodeVersion || '18.x' }}
                </el-descriptions-item>
                <el-descriptions-item label="Electron版本">
                  {{ systemInfo.electronVersion || '40.x' }}
                </el-descriptions-item>
                <el-descriptions-item label="系统版本">
                  {{ systemInfo.osVersion || 'Unknown' }}
                </el-descriptions-item>
                <el-descriptions-item label="总内存">
                  {{ formatBytes(systemInfo.totalMemory || 0) }}
                </el-descriptions-item>
              </el-descriptions>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
      
      <div class="form-actions">
        <el-button type="primary" @click="saveSettings" :loading="loading">
          保存设置
        </el-button>
        <el-button @click="loadSettings">
          取消
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.settings-page {
  padding: 20px;
}

.settings-card {
  max-width: 800px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.form-item-tip {
  margin-left: 10px;
  color: #909399;
  font-size: 12px;
}

.about-section {
  padding: 20px 0;
}

.app-info {
  text-align: center;
  margin-bottom: 30px;
}

.app-info h3 {
  font-size: 24px;
  margin-bottom: 10px;
  color: #409eff;
}

.app-info p {
  margin: 5px 0;
  color: #606266;
}

.system-info h4 {
  margin-bottom: 15px;
  color: #303133;
}

.form-actions {
  margin-top: 30px;
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid #e4e7ed;
}

:deep(.el-tabs__content) {
  padding: 20px 0;
}

:deep(.el-form-item) {
  margin-bottom: 25px;
}
</style>