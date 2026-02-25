<template>
  <div class="process-monitor">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>监控进程</span>
          <div class="header-actions">
            <el-input
              v-model="searchText"
              placeholder="搜索进程名称..."
              :prefix-icon="Search"
              clearable
              style="width: 200px; margin-right: 12px;"
            />
            <el-select
              v-model="selectedCategory"
              placeholder="全部分类"
              clearable
              style="width: 160px; margin-right: 12px;"
            >
              <el-option label="全部分类" value="" />
              <el-option
                v-for="cat in categoriesWithCount"
                :key="cat.value"
                :label="cat.label"
                :value="cat.value"
              />
            </el-select>
            <el-button type="primary" :icon="Refresh" :loading="loading" @click="loadProcesses">
              {{ loading ? '刷新中...' : '刷新' }}
            </el-button>
          </div>
        </div>
      </template>

      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-label">进程总数</span>
          <span class="stat-value">{{ processes.length }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">CPU 使用</span>
          <span class="stat-value">{{ totalCpu.toFixed(1) }}%</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">内存使用</span>
          <span class="stat-value">{{ formatBytes(totalMemory) }}</span>
        </div>
      </div>

      <el-table
        :data="filteredProcesses"
        stripe
        style="width: 100%"
        height="calc(100vh - 280px)"
        :default-sort="{ prop: 'memory', order: 'descending' }"
      >
        <el-table-column prop="pid" label="PID" width="80" sortable />
        <el-table-column prop="name" label="名称" min-width="180" sortable show-overflow-tooltip />
        <el-table-column prop="category" label="分类" width="120">
          <template #default="{ row }">
            <el-tag :type="getCategoryType(row.category)" size="small">
              {{ row.category }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="memory" label="内存" width="100" sortable>
          <template #default="{ row }">
            {{ formatBytes(row.memory) }}
          </template>
        </el-table-column>
        <el-table-column prop="cpu" label="CPU" width="80" sortable>
          <template #default="{ row }">
            <span :class="{ 'high-cpu': row.cpu > 50 }">{{ row.cpu.toFixed(1) }}%</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'Running' ? 'success' : 'info'" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="path" label="路径" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tooltip v-if="row.path" :content="row.path" placement="top">
              <span class="path-text" @click="copyPath(row.path)">{{ row.path }}</span>
            </el-tooltip>
            <span v-else class="no-path">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-tooltip content="打开文件位置" placement="top">
              <el-button
                :icon="FolderOpened"
                size="small"
                circle
                :disabled="!row.path"
                @click="openFolder(row.path)"
              />
            </el-tooltip>
            <el-tooltip content="结束进程" placement="top">
              <el-button
                :icon="Close"
                size="small"
                circle
                type="danger"
                @click="killProcess(row)"
              />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Search, FolderOpened, Close } from '@element-plus/icons-vue'

interface ProcessItem {
  pid: number
  name: string
  category: string
  memory: number
  cpu: number
  status: string
  path: string
}

const loading = ref(false)
const searchText = ref('')
const selectedCategory = ref('')
const processes = ref<ProcessItem[]>([])

// 进程分类规则
const categoryRules: { pattern: RegExp; category: string }[] = [
  { pattern: /^(chrome|firefox|msedge|opera|brave|vivaldi)/i, category: '浏览器' },
  { pattern: /^(code|idea|webstorm|pycharm|goland|phpstorm|rider|clion|android studio|sublime|atom|notepad|vim|emacs)/i, category: '开发工具' },
  { pattern: /^(node|python|java|javaw|ruby|php|go|rust|dotnet|perl|powershell|cmd|bash|pwsh)/i, category: '运行时' },
  { pattern: /^(mysql|postgres|mongod|redis|elasticsearch|kafka|zookeeper|consul|etcd)/i, category: '数据库' },
  { pattern: /^(nginx|apache|httpd|tomcat|iis|caddy)/i, category: '服务器' },
  { pattern: /^(docker|containerd|kubelet|kubectl)/i, category: '容器' },
  { pattern: /^(git|svn|hg)/i, category: '版本控制' },
  { pattern: /^(explorer|dwm|taskmgr|sihost|fontdrvhost|csrss|lsass|services|svchost|wininit|winlogon|system)/i, category: '系统' },
  { pattern: /^(wechat|qq|telegram|slack|discord|teams|zoom|skype)/i, category: '通讯' },
  { pattern: /^(spotify|vlc|potplayer|foobar|itunes|musicbee)/i, category: '媒体' },
  { pattern: /^(electron|baolike)/i, category: '本应用' },
]

// 分类定义
const categoryList = [
  '浏览器', '开发工具', '运行时', '数据库', '服务器', 
  '容器', '版本控制', '系统', '通讯', '媒体', '本应用', '其他'
]

// 带数量的分类选项
const categoriesWithCount = computed(() => {
  const counts: Record<string, number> = {}
  processes.value.forEach(p => {
    counts[p.category] = (counts[p.category] || 0) + 1
  })
  
  return categoryList
    .filter(cat => counts[cat] > 0)
    .map(cat => ({
      label: `${cat} (${counts[cat]})`,
      value: cat
    }))
})

// 分类颜色
function getCategoryType(category: string): string {
  const typeMap: Record<string, string> = {
    '浏览器': 'primary',
    '开发工具': 'success',
    '运行时': 'warning',
    '数据库': 'danger',
    '服务器': '',
    '容器': 'info',
    '系统': 'info',
    '本应用': 'success',
  }
  return typeMap[category] || ''
}

// 获取进程分类
function getCategory(name: string): string {
  for (const rule of categoryRules) {
    if (rule.pattern.test(name)) {
      return rule.category
    }
  }
  return '其他'
}

// 过滤后的进程列表
const filteredProcesses = computed(() => {
  let result = processes.value
  
  if (searchText.value) {
    const search = searchText.value.toLowerCase()
    result = result.filter(p => 
      p.name.toLowerCase().includes(search) ||
      p.pid.toString().includes(search)
    )
  }
  
  if (selectedCategory.value) {
    result = result.filter(p => p.category === selectedCategory.value)
  }
  
  return result
})

// 统计信息
const totalCpu = computed(() => processes.value.reduce((sum, p) => sum + p.cpu, 0))
const totalMemory = computed(() => processes.value.reduce((sum, p) => sum + p.memory, 0))

// 格式化字节
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// 加载进程列表
async function loadProcesses() {
  loading.value = true
  try {
    const result = await window.electronAPI.listProcesses()
    if (result.success) {
      processes.value = result.processes.map(p => ({
        ...p,
        category: getCategory(p.name)
      }))
    } else {
      ElMessage.error('获取进程列表失败')
    }
  } catch (error) {
    ElMessage.error('获取进程列表失败')
  } finally {
    loading.value = false
  }
}

// 结束进程
async function killProcess(process: ProcessItem) {
  try {
    await ElMessageBox.confirm(
      `确定要结束进程 "${process.name}" (PID: ${process.pid}) 吗？`,
      '警告',
      { type: 'warning' }
    )
    
    const result = await window.electronAPI.killProcess(process.pid)
    if (result.success) {
      ElMessage.success('进程已结束')
      loadProcesses()
    } else {
      ElMessage.error(result.error || '结束进程失败')
    }
  } catch {
    // 用户取消
  }
}

// 复制路径
function copyPath(path: string) {
  navigator.clipboard.writeText(path)
  ElMessage.success('路径已复制')
}

// 打开文件夹
async function openFolder(path: string) {
  if (path) {
    await window.electronAPI.showItemInFolder(path)
  }
}

onMounted(() => {
  loadProcesses()
})
</script>

<style scoped>
.process-monitor {
  padding: 20px;
  height: 100%;
  overflow: hidden;
}

.page-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-card :deep(.el-card__body) {
  flex: 1;
  overflow: hidden;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 16px;
  font-weight: bold;
}

.header-actions {
  display: flex;
  align-items: center;
}

.stats-bar {
  display: flex;
  gap: 24px;
  padding: 12px 20px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  color: #909399;
  font-size: 13px;
}

.stat-value {
  color: #303133;
  font-weight: 600;
  font-size: 14px;
}

.path-text {
  color: #606266;
  cursor: pointer;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
}

.path-text:hover {
  color: #409eff;
}

.no-path {
  color: #c0c4cc;
}

.high-cpu {
  color: #f56c6c;
  font-weight: 600;
}
</style>
