<template>
  <div class="env-variables">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>环境变量 - PATH</span>
          <div class="header-actions">
            <el-input
              v-model="searchText"
              placeholder="搜索路径..."
              :prefix-icon="Search"
              clearable
              style="width: 200px; margin-right: 12px;"
            />
            <el-select
              v-model="filterStatus"
              placeholder="全部状态"
              clearable
              style="width: 120px; margin-right: 12px;"
            >
              <el-option label="存在" value="exists" />
              <el-option label="不存在" value="missing" />
              <el-option label="有问题" value="problem" />
            </el-select>
            <el-button type="primary" :icon="Refresh" :loading="loading" @click="loadPathVariables">
              {{ loading ? '刷新中...' : '刷新' }}
            </el-button>
          </div>
        </div>
      </template>

      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-label">路径总数</span>
          <span class="stat-value">{{ pathItems.length }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">存在</span>
          <span class="stat-value success">{{ existsCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">不存在</span>
          <span class="stat-value danger">{{ missingCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">有问题</span>
          <span class="stat-value warning">{{ problemCount }}</span>
        </div>
      </div>

      <el-table
        :data="filteredPathItems"
        stripe
        style="width: 100%"
        height="calc(100vh - 280px)"
      >
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="path" label="路径" min-width="350" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="path-text" @click="copyPath(row.path)">{{ row.path }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="120">
          <template #default="{ row }">
            <el-tag :type="getCategoryType(row.category)" size="small">
              {{ row.category }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="exists" label="存在" width="80">
          <template #default="{ row }">
            <el-icon v-if="row.exists" class="status-icon success"><CircleCheck /></el-icon>
            <el-icon v-else class="status-icon danger"><CircleClose /></el-icon>
          </template>
        </el-table-column>
        <el-table-column prop="problem" label="问题" min-width="180">
          <template #default="{ row }">
            <span v-if="row.problem" class="problem-text">{{ row.problem }}</span>
            <span v-else class="no-problem">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-tooltip content="复制路径" placement="top">
              <el-button
                :icon="DocumentCopy"
                size="small"
                circle
                @click="copyPath(row.path)"
              />
            </el-tooltip>
            <el-tooltip content="打开文件夹" placement="top">
              <el-button
                :icon="FolderOpened"
                size="small"
                circle
                :disabled="!row.exists"
                @click="openFolder(row.path)"
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
import { ElMessage } from 'element-plus'
import { Refresh, Search, DocumentCopy, FolderOpened, CircleCheck, CircleClose } from '@element-plus/icons-vue'

interface PathItem {
  path: string
  category: string
  exists: boolean
  problem: string
}

const loading = ref(false)
const searchText = ref('')
const filterStatus = ref('')
const pathItems = ref<PathItem[]>([])

// 路径分类规则
const categoryRules: { pattern: RegExp; category: string }[] = [
  { pattern: /\\python|\\anaconda|\\miniconda|\\conda/i, category: 'Python' },
  { pattern: /\\node|\\nodejs|\\nvm|\\fnm/i, category: 'Node.js' },
  { pattern: /\\java|\\jdk|\\jre|\\openjdk/i, category: 'Java' },
  { pattern: /\\go\\|\\golang/i, category: 'Go' },
  { pattern: /\\rust|\\cargo|\\rustup/i, category: 'Rust' },
  { pattern: /\\ruby/i, category: 'Ruby' },
  { pattern: /\\php/i, category: 'PHP' },
  { pattern: /\\dotnet|\\\.net/i, category: '.NET' },
  { pattern: /\\git\\|\\Git\\/i, category: 'Git' },
  { pattern: /\\maven|\\mvn/i, category: 'Maven' },
  { pattern: /\\gradle/i, category: 'Gradle' },
  { pattern: /\\docker/i, category: 'Docker' },
  { pattern: /\\mysql/i, category: 'MySQL' },
  { pattern: /\\postgresql|\\pgsql/i, category: 'PostgreSQL' },
  { pattern: /\\mongodb/i, category: 'MongoDB' },
  { pattern: /\\redis/i, category: 'Redis' },
  { pattern: /\\windows\\system32|\\windows\\syswow64/i, category: '系统' },
  { pattern: /\\program files/i, category: '程序' },
  { pattern: /\\scoop/i, category: 'Scoop' },
  { pattern: /\\chocolatey/i, category: 'Chocolatey' },
]

// 分类颜色
function getCategoryType(category: string): string {
  const typeMap: Record<string, string> = {
    'Python': 'success',
    'Node.js': 'success',
    'Java': 'warning',
    'Go': 'primary',
    'Rust': 'danger',
    'Git': '',
    '系统': 'info',
    '程序': 'info',
  }
  return typeMap[category] || ''
}

// 获取路径分类
function getCategory(path: string): string {
  for (const rule of categoryRules) {
    if (rule.pattern.test(path)) {
      return rule.category
    }
  }
  return '其他'
}

// 过滤后的路径列表
const filteredPathItems = computed(() => {
  let result = pathItems.value
  
  if (searchText.value) {
    const search = searchText.value.toLowerCase()
    result = result.filter(p => p.path.toLowerCase().includes(search))
  }
  
  if (filterStatus.value === 'exists') {
    result = result.filter(p => p.exists)
  } else if (filterStatus.value === 'missing') {
    result = result.filter(p => !p.exists)
  } else if (filterStatus.value === 'problem') {
    result = result.filter(p => p.problem)
  }
  
  return result
})

// 统计
const existsCount = computed(() => pathItems.value.filter(p => p.exists).length)
const missingCount = computed(() => pathItems.value.filter(p => !p.exists).length)
const problemCount = computed(() => pathItems.value.filter(p => p.problem).length)

// 加载 PATH 变量
async function loadPathVariables() {
  loading.value = true
  try {
    const result = await window.electronAPI.getPathVariables()
    if (result.success) {
      pathItems.value = result.paths.map((p: { path: string; exists: boolean; problem: string }) => ({
        ...p,
        category: getCategory(p.path)
      }))
    } else {
      ElMessage.error('获取 PATH 变量失败')
    }
  } catch (error) {
    ElMessage.error('获取 PATH 变量失败')
  } finally {
    loading.value = false
  }
}

// 复制路径
function copyPath(path: string) {
  navigator.clipboard.writeText(path)
  ElMessage.success('路径已复制')
}

// 打开文件夹
async function openFolder(path: string) {
  await window.electronAPI.showItemInFolder(path)
}

onMounted(() => {
  loadPathVariables()
})
</script>

<style scoped>
.env-variables {
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

.stat-value.success {
  color: #67c23a;
}

.stat-value.danger {
  color: #f56c6c;
}

.stat-value.warning {
  color: #e6a23c;
}

.path-text {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  cursor: pointer;
  color: #606266;
}

.path-text:hover {
  color: #409eff;
}

.status-icon {
  font-size: 18px;
}

.status-icon.success {
  color: #67c23a;
}

.status-icon.danger {
  color: #f56c6c;
}

.problem-text {
  color: #e6a23c;
  font-size: 13px;
}

.no-problem {
  color: #c0c4cc;
}
</style>
