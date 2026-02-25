<template>
  <div class="package-cache">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>包缓存</span>
          <div class="header-actions">
            <el-tag v-if="totalSize > 0" type="warning" size="large" class="total-tag">
              总计: {{ formatSize(totalSize) }}
            </el-tag>
            <el-button
              type="primary"
              :icon="Refresh"
              :loading="scanning"
              @click="scanCaches"
            >
              {{ scanning ? '扫描中...' : '刷新' }}
            </el-button>
            <el-button
              type="danger"
              :icon="Delete"
              :disabled="!hasCleanable || !!cleaningManager"
              @click="cleanAll"
            >
              全部清理
            </el-button>
          </div>
        </div>
      </template>

      <!-- 加载中 -->
      <div v-if="scanning && caches.length === 0" class="loading-state">
        <el-icon class="is-loading" :size="24"><Loading /></el-icon>
        <span>正在扫描各包管理器缓存...</span>
      </div>

      <!-- 缓存列表 -->
      <div v-else class="cache-grid">
        <div
          v-for="item in caches"
          :key="item.manager"
          class="cache-card"
          :class="{ unavailable: !item.available }"
        >
          <div class="cache-card-header">
            <div class="cache-name">
              <el-icon :size="20" :color="item.available ? managerColors[item.manager] : '#c0c4cc'">
                <component :is="managerIcons[item.manager]" />
              </el-icon>
              <span>{{ managerLabels[item.manager] || item.manager }}</span>
            </div>
            <el-tag
              v-if="item.available"
              :type="item.size > 500 * 1024 * 1024 ? 'danger' : item.size > 100 * 1024 * 1024 ? 'warning' : 'success'"
              size="small"
            >
              {{ formatSize(item.size) }}
            </el-tag>
            <el-tag v-else type="info" size="small">未安装</el-tag>
          </div>

          <div v-if="item.available" class="cache-card-body">
            <div class="cache-path" :title="item.path" @click="copyPath(item.path)">
              <el-icon :size="14"><FolderOpened /></el-icon>
              <span class="path-text">{{ item.path }}</span>
            </div>

            <div class="cache-bar-wrap">
              <div
                class="cache-bar"
                :style="{ width: barWidth(item.size) + '%', backgroundColor: barColor(item.size) }"
              ></div>
            </div>
          </div>
          <div v-else class="cache-card-body unavailable-body">
            <span>未检测到该包管理器</span>
          </div>

          <div class="cache-card-footer" v-if="item.available && item.size > 0">
            <el-button
              type="danger"
              size="small"
              plain
              :icon="Delete"
              :loading="cleaningManager === item.manager"
              :disabled="!!cleaningManager && cleaningManager !== item.manager"
              @click="cleanCache(item)"
            >
              清理缓存
            </el-button>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 操作日志弹窗 -->
    <el-dialog v-model="logVisible" title="清理日志" width="600px" :close-on-click-modal="false">
      <pre class="log-output">{{ logContent }}</pre>
      <template #footer>
        <el-button @click="logVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Refresh, Delete,
  Box, Coin, Connection, Tools, Promotion, EditPen,
  Loading, FolderOpened, Coffee, SetUp
} from '@element-plus/icons-vue'

interface CacheItem {
  manager: string
  path: string
  size: number
  available: boolean
}

const scanning = ref(false)
const cleaningManager = ref('')
const logVisible = ref(false)
const logContent = ref('')
const caches = ref<CacheItem[]>([])

const managerLabels: Record<string, string> = {
  npm: 'npm',
  pnpm: 'pnpm',
  yarn: 'yarn',
  pip: 'pip',
  conda: 'conda',
  cargo: 'cargo',
  composer: 'composer',
  gradle: 'Gradle',
  maven: 'Maven',
  nuget: 'NuGet',
}

const managerIcons: Record<string, any> = {
  npm: Box,
  pnpm: Coin,
  yarn: Connection,
  pip: Promotion,
  conda: Promotion,
  cargo: Tools,
  composer: EditPen,
  gradle: Coffee,
  maven: Coffee,
  nuget: SetUp,
}

const managerColors: Record<string, string> = {
  npm: '#cb3837',
  pnpm: '#f9ad00',
  yarn: '#2c8ebb',
  pip: '#3776ab',
  conda: '#44a833',
  cargo: '#dea584',
  composer: '#885630',
  gradle: '#02303a',
  maven: '#c71a36',
  nuget: '#004880',
}

const totalSize = computed(() =>
  caches.value.filter(c => c.available).reduce((sum, c) => sum + c.size, 0)
)

const hasCleanable = computed(() =>
  caches.value.some(c => c.available && c.size > 0)
)

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(i > 1 ? 2 : 0) + ' ' + units[i]
}

const maxSize = computed(() => {
  const sizes = caches.value.filter(c => c.available).map(c => c.size)
  return Math.max(...sizes, 1)
})

function barWidth(size: number): number {
  return Math.max((size / maxSize.value) * 100, 2)
}

function barColor(size: number): string {
  if (size > 500 * 1024 * 1024) return '#f56c6c'
  if (size > 100 * 1024 * 1024) return '#e6a23c'
  return '#67c23a'
}

function copyPath(p: string) {
  navigator.clipboard.writeText(p)
  ElMessage.success('路径已复制')
}

async function scanCaches() {
  scanning.value = true
  try {
    const result = await window.electronAPI.scanPackageCaches()
    if (result.success) {
      // 按大小排序，可用的在前
      caches.value = result.caches.sort((a, b) => {
        if (a.available !== b.available) return a.available ? -1 : 1
        return b.size - a.size
      })
    }
  } catch (e: any) {
    ElMessage.error('扫描失败: ' + e.message)
  }
  scanning.value = false
}

async function cleanCache(item: CacheItem) {
  try {
    await ElMessageBox.confirm(
      `确定要清理 ${managerLabels[item.manager]} 的缓存吗？\n缓存大小: ${formatSize(item.size)}\n路径: ${item.path}`,
      '清理确认',
      { type: 'warning', confirmButtonText: '确认清理', cancelButtonText: '取消' }
    )
  } catch { return }

  cleaningManager.value = item.manager
  try {
    const result = await window.electronAPI.cleanPackageCache(item.manager)
    if (result.success) {
      ElMessage.success(`${managerLabels[item.manager]} 缓存已清理`)
      logContent.value = result.output
      logVisible.value = true
      await scanCaches()
    } else {
      ElMessage.error(`清理失败: ${result.output}`)
      logContent.value = result.output
      logVisible.value = true
    }
  } catch (e: any) {
    ElMessage.error('清理异常: ' + e.message)
  }
  cleaningManager.value = ''
}

async function cleanAll() {
  const cleanable = caches.value.filter(c => c.available && c.size > 0)
  if (cleanable.length === 0) return

  try {
    await ElMessageBox.confirm(
      `确定要清理全部 ${cleanable.length} 个包管理器的缓存吗？\n总计: ${formatSize(totalSize.value)}`,
      '全部清理确认',
      { type: 'warning', confirmButtonText: '全部清理', cancelButtonText: '取消' }
    )
  } catch { return }

  const logs: string[] = []
  for (const item of cleanable) {
    cleaningManager.value = item.manager
    try {
      const result = await window.electronAPI.cleanPackageCache(item.manager)
      logs.push(`[${managerLabels[item.manager]}] ${result.success ? '成功' : '失败'}: ${result.output}`)
    } catch (e: any) {
      logs.push(`[${managerLabels[item.manager]}] 异常: ${e.message}`)
    }
  }
  cleaningManager.value = ''
  logContent.value = logs.join('\n\n')
  logVisible.value = true
  ElMessage.success('全部清理完成')
  await scanCaches()
}

onMounted(() => {
  scanCaches()
})
</script>

<style scoped>
.package-cache {
  padding: 20px;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.page-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-card :deep(.el-card__body) {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
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
  gap: 10px;
}

.total-tag {
  font-weight: bold;
  font-size: 14px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 80px 0;
  color: #909399;
  font-size: 14px;
}

.cache-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.cache-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  transition: box-shadow 0.2s;
}

.cache-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.cache-card.unavailable {
  opacity: 0.5;
}

.cache-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.cache-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
}

.cache-card-body {
  margin-bottom: 12px;
}

.cache-path {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #909399;
  font-size: 12px;
  cursor: pointer;
  margin-bottom: 10px;
  overflow: hidden;
}

.cache-path:hover {
  color: #409eff;
}

.path-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cache-bar-wrap {
  height: 8px;
  background: #f0f2f5;
  border-radius: 4px;
  overflow: hidden;
}

.cache-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
  min-width: 4px;
}

.unavailable-body {
  color: #c0c4cc;
  font-size: 13px;
}

.cache-card-footer {
  display: flex;
  justify-content: flex-end;
}

.log-output {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 6px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  max-height: 400px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
</style>
