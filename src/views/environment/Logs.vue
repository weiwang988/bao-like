<template>
  <div class="env-logs">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>应用日志</span>
          <div class="header-actions">
            <el-select
              v-model="filterCategory"
              placeholder="全部分类"
              clearable
              style="width: 140px; margin-right: 12px;"
            >
              <el-option label="工具管理" value="tool" />
              <el-option label="包管理" value="deps" />
              <el-option label="包缓存" value="cache" />
              <el-option label="系统" value="system" />
            </el-select>
            <el-select
              v-model="filterLevel"
              placeholder="全部级别"
              clearable
              style="width: 120px; margin-right: 12px;"
            >
              <el-option label="信息" value="info" />
              <el-option label="警告" value="warn" />
              <el-option label="错误" value="error" />
              <el-option label="调试" value="debug" />
            </el-select>
            <el-button type="primary" :icon="Refresh" @click="loadLogs">
              刷新
            </el-button>
            <el-button type="danger" :icon="Delete" @click="clearLogs">
              清空日志
            </el-button>
          </div>
        </div>
      </template>

      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-label">总条数</span>
          <span class="stat-value">{{ logs.length }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">信息</span>
          <span class="stat-value info">{{ infoCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">警告</span>
          <span class="stat-value warning">{{ warnCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">错误</span>
          <span class="stat-value danger">{{ errorCount }}</span>
        </div>
      </div>

      <el-table
        :data="filteredLogs"
        stripe
        style="width: 100%"
        height="calc(100vh - 280px)"
        :row-class-name="getRowClassName"
      >
        <el-table-column prop="time" label="时间" width="180">
          <template #default="{ row }">
            <span class="time-text">{{ formatTime(row.time) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="level" label="级别" width="80">
          <template #default="{ row }">
            <el-tag :type="getLevelType(row.level)" size="small">
              {{ getLevelLabel(row.level) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="100">
          <template #default="{ row }">
            <span class="category-text">{{ getCategoryLabel(row.category) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="内容" min-width="400" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="message-text">{{ row.message }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="detail" label="详情" width="80">
          <template #default="{ row }">
            <el-button
              v-if="row.detail"
              type="primary"
              size="small"
              link
              @click="showDetail(row)"
            >
              查看
            </el-button>
            <span v-else class="no-detail">-</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 详情对话框 -->
    <el-dialog v-model="detailVisible" title="日志详情" width="600px">
      <div class="detail-content">
        <div class="detail-row">
          <span class="detail-label">时间：</span>
          <span>{{ currentLog?.time ? formatTime(currentLog.time) : '' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">级别：</span>
          <el-tag v-if="currentLog" :type="getLevelType(currentLog.level)" size="small">
            {{ getLevelLabel(currentLog.level) }}
          </el-tag>
        </div>
        <div class="detail-row">
          <span class="detail-label">分类：</span>
          <span>{{ currentLog ? getCategoryLabel(currentLog.category) : '' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">消息：</span>
          <span>{{ currentLog?.message }}</span>
        </div>
        <div v-if="currentLog?.detail" class="detail-row">
          <span class="detail-label">详情：</span>
          <pre class="detail-pre">{{ currentLog.detail }}</pre>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Delete } from '@element-plus/icons-vue'

interface LogItem {
  id: string
  time: number
  level: 'info' | 'warn' | 'error' | 'debug'
  category: 'tool' | 'deps' | 'cache' | 'system'
  message: string
  detail?: string
}

const logs = ref<LogItem[]>([])
const filterCategory = ref('')
const filterLevel = ref('')
const detailVisible = ref(false)
const currentLog = ref<LogItem | null>(null)

// 过滤后的日志
const filteredLogs = computed(() => {
  let result = logs.value
  
  if (filterCategory.value) {
    result = result.filter(log => log.category === filterCategory.value)
  }
  
  if (filterLevel.value) {
    result = result.filter(log => log.level === filterLevel.value)
  }
  
  return result
})

// 统计
const infoCount = computed(() => logs.value.filter(l => l.level === 'info').length)
const warnCount = computed(() => logs.value.filter(l => l.level === 'warn').length)
const errorCount = computed(() => logs.value.filter(l => l.level === 'error').length)

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}:${s}`
}

// 级别标签
function getLevelLabel(level: string): string {
  const map: Record<string, string> = {
    'info': '信息',
    'warn': '警告',
    'error': '错误',
    'debug': '调试'
  }
  return map[level] || level
}

// 级别类型
function getLevelType(level: string): string {
  const map: Record<string, string> = {
    'info': 'info',
    'warn': 'warning',
    'error': 'danger',
    'debug': ''
  }
  return map[level] || ''
}

// 分类标签
function getCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    'tool': '工具管理',
    'deps': '包管理',
    'cache': '包缓存',
    'system': '系统'
  }
  return map[category] || category
}

// 行样式
function getRowClassName({ row }: { row: LogItem }): string {
  if (row.level === 'error') return 'error-row'
  if (row.level === 'warn') return 'warning-row'
  return ''
}

// 显示详情
function showDetail(log: LogItem) {
  currentLog.value = log
  detailVisible.value = true
}

// 加载日志
async function loadLogs() {
  try {
    const result = await window.electronAPI.getLogs()
    if (result.success) {
      logs.value = result.logs
    }
  } catch (error) {
    console.error('加载日志失败:', error)
  }
}

// 清空日志
async function clearLogs() {
  try {
    await ElMessageBox.confirm('确定要清空所有日志吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    const result = await window.electronAPI.clearLogs()
    if (result.success) {
      logs.value = []
      ElMessage.success('日志已清空')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('清空日志失败')
    }
  }
}

onMounted(() => {
  loadLogs()
})
</script>

<style scoped>
.env-logs {
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

.stat-value.info {
  color: #909399;
}

.stat-value.warning {
  color: #e6a23c;
}

.stat-value.danger {
  color: #f56c6c;
}

.time-text {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: #909399;
}

.category-text {
  font-size: 13px;
}

.message-text {
  font-size: 13px;
}

.no-detail {
  color: #c0c4cc;
}

:deep(.error-row) {
  background-color: #fef0f0 !important;
}

:deep(.warning-row) {
  background-color: #fdf6ec !important;
}

.detail-content {
  padding: 10px 0;
}

.detail-row {
  margin-bottom: 12px;
  display: flex;
  align-items: flex-start;
}

.detail-label {
  width: 60px;
  color: #909399;
  flex-shrink: 0;
}

.detail-pre {
  margin: 0;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow: auto;
  flex: 1;
}
</style>
