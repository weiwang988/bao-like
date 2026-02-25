<template>
  <div class="package-deps">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>包管理</span>
          <div class="header-actions">
            <el-input
              v-model="searchText"
              placeholder="搜索包名称..."
              :prefix-icon="Search"
              clearable
              style="width: 200px; margin-right: 12px;"
            />
            <el-button
              type="primary"
              :icon="Refresh"
              :loading="scanning"
              @click="scanCurrentManager"
            >
              {{ scanning ? '扫描中...' : '刷新' }}
            </el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeManager" @tab-change="onTabChange" class="manager-tabs">
        <el-tab-pane
          v-for="mgr in managers"
          :key="mgr.key"
          :name="mgr.key"
        >
          <template #label>
            <div class="tab-label">
              <el-icon :size="16"><component :is="mgr.icon" /></el-icon>
              <span>{{ mgr.label }}</span>
              <el-tag
                v-if="packageData[mgr.key]"
                size="small"
                :type="packageData[mgr.key].available ? 'success' : 'info'"
                class="tab-count"
              >
                {{ packageData[mgr.key].available ? packageData[mgr.key].packages.length : '不可用' }}
              </el-tag>
            </div>
          </template>

          <div class="tab-content">
            <!-- 加载中 -->
            <div v-if="packageData[mgr.key]?.loading" class="loading-state">
              <el-icon class="is-loading" :size="24"><Loading /></el-icon>
              <span>正在扫描 {{ mgr.label }} 全局包...</span>
            </div>

            <!-- 不可用 -->
            <div v-else-if="packageData[mgr.key] && !packageData[mgr.key].available" class="unavailable-state">
              <el-icon :size="40" color="#909399"><WarningFilled /></el-icon>
              <p>{{ mgr.label }} 未安装或不在系统 PATH 中</p>
              <el-button type="primary" size="small" @click="openUrl(mgr.downloadUrl)">
                前往安装
              </el-button>
            </div>

            <!-- 空列表 -->
            <el-empty
              v-else-if="filteredPackages.length === 0 && !packageData[mgr.key]?.loading"
              :description="searchText ? '没有匹配的包' : '暂无全局安装的包'"
            />

            <!-- 包列表 -->
            <el-table
              v-else
              :data="filteredPackages"
              stripe
              style="width: 100%"
              max-height="calc(100vh - 300px)"
              :default-sort="{ prop: 'name', order: 'ascending' }"
            >
              <el-table-column prop="name" label="包名称" sortable min-width="200">
                <template #default="{ row }">
                  <span class="pkg-name">{{ row.name }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="version" label="当前版本" width="150">
                <template #default="{ row }">
                  <span class="pkg-version">{{ row.version }}</span>
                </template>
              </el-table-column>
              <el-table-column label="最新版本" width="150">
                <template #default="{ row }">
                  <span v-if="packageData[activeManager]?.checkingOutdated" class="checking-text">
                    <el-icon class="is-loading" :size="12"><Loading /></el-icon>
                    检查中
                  </span>
                  <el-tag v-else-if="row._latest" type="warning" size="small">{{ row._latest }}</el-tag>
                  <el-tag v-else type="success" size="small">已是最新</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="180" fixed="right">
                <template #default="{ row }">
                  <el-button
                    v-if="row._latest"
                    type="primary"
                    size="small"
                    :icon="Upload"
                    :loading="row._updating"
                    @click="updatePackage(row)"
                    :disabled="!!operatingPkg"
                  >
                    更新
                  </el-button>
                  <el-button
                    type="danger"
                    size="small"
                    :icon="Delete"
                    :loading="row._uninstalling"
                    @click="uninstallPackage(row)"
                    :disabled="!!operatingPkg"
                  >
                    卸载
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 操作日志弹窗 -->
    <el-dialog v-model="logVisible" title="操作日志" width="600px" :close-on-click-modal="false">
      <pre class="log-output">{{ logContent }}</pre>
      <template #footer>
        <el-button @click="logVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Refresh, Search, Delete, Upload,
  Box, Coin, Connection, Tools, Promotion, EditPen,
  Loading, WarningFilled
} from '@element-plus/icons-vue'

interface PkgItem {
  name: string
  version: string
  _latest?: string
  _updating?: boolean
  _uninstalling?: boolean
}

interface ManagerData {
  packages: PkgItem[]
  available: boolean
  loading: boolean
  scanned: boolean
  checkingOutdated: boolean
}

const managers = [
  { key: 'npm', label: 'npm', icon: Box, downloadUrl: 'https://nodejs.org/' },
  { key: 'pnpm', label: 'pnpm', icon: Coin, downloadUrl: 'https://pnpm.io/installation' },
  { key: 'yarn', label: 'yarn', icon: Connection, downloadUrl: 'https://yarnpkg.com/getting-started/install' },
  { key: 'pip', label: 'pip', icon: Promotion, downloadUrl: 'https://pip.pypa.io/en/stable/installation/' },
  { key: 'cargo', label: 'cargo', icon: Tools, downloadUrl: 'https://www.rust-lang.org/tools/install' },
  { key: 'conda', label: 'conda', icon: Promotion, downloadUrl: 'https://docs.conda.io/en/latest/miniconda.html' },
  { key: 'composer', label: 'composer', icon: EditPen, downloadUrl: 'https://getcomposer.org/download/' },
]

const activeManager = ref('npm')
const searchText = ref('')
const scanning = ref(false)
const operatingPkg = ref('')
const logVisible = ref(false)
const logContent = ref('')

const packageData = reactive<Record<string, ManagerData>>({})

// 初始化 packageData
managers.forEach(mgr => {
  packageData[mgr.key] = {
    packages: [],
    available: false,
    loading: false,
    scanned: false,
    checkingOutdated: false,
  }
})

// 过滤后的包列表
const filteredPackages = computed(() => {
  const data = packageData[activeManager.value]
  if (!data || !data.available) return []
  const search = searchText.value.toLowerCase()
  if (!search) return data.packages
  return data.packages.filter(p => p.name.toLowerCase().includes(search))
})

// 扫描指定包管理器
async function scanManager(manager: string) {
  const data = packageData[manager]
  if (!data) return

  data.loading = true
  data.packages = []

  try {
    // 先检测是否可用
    const checkCmds: Record<string, string> = {
      pip: 'pip --version',
      conda: 'conda --version',
      cargo: 'cargo --version',
      composer: 'composer --version',
    }
    const checkCmd = checkCmds[manager] || `${manager} -v`
    const checkResult = await window.electronAPI.execCommand(checkCmd)
    if (!checkResult.success) {
      data.available = false
      data.scanned = true
      return
    }
    data.available = true

    // 获取全局包列表
    const result = await window.electronAPI.listGlobalPackages(manager)
    if (result.success) {
      data.packages = result.packages.map(p => ({ ...p, _updating: false, _uninstalling: false }))
      // 异步检查可更新的包
      checkOutdated(manager)
    } else {
      data.packages = []
    }
  } catch {
    data.available = false
  } finally {
    data.loading = false
    data.scanned = true
  }
}

// 检查包是否有可更新版本
async function checkOutdated(manager: string) {
  const data = packageData[manager]
  if (!data || !data.available || data.packages.length === 0) return

  data.checkingOutdated = true
  try {
    const result = await window.electronAPI.checkOutdatedPackages(manager)
    if (result.success && result.outdated) {
      for (const pkg of data.packages) {
        const latest = result.outdated[pkg.name]
        if (latest && latest !== pkg.version) {
          pkg._latest = latest
        } else {
          pkg._latest = undefined
        }
      }
    }
  } catch {}
  data.checkingOutdated = false
}

// 扫描当前 tab 的包管理器
async function scanCurrentManager() {
  scanning.value = true
  await scanManager(activeManager.value)
  scanning.value = false
  const data = packageData[activeManager.value]
  if (data.available) {
    ElMessage.success(`扫描完成，共 ${data.packages.length} 个包`)
  }
}

// 切换 tab 时自动扫描（如果未扫描过）
async function onTabChange(name: string | number) {
  const key = String(name)
  if (!packageData[key].scanned) {
    scanning.value = true
    await scanManager(key)
    scanning.value = false
  }
}

// 更新包
async function updatePackage(pkg: PkgItem) {
  try {
    await ElMessageBox.confirm(
      `确定要更新 ${pkg.name} 吗？`,
      '更新确认',
      { type: 'info' }
    )
  } catch { return }

  operatingPkg.value = pkg.name
  pkg._updating = true

  try {
    const result = await window.electronAPI.manageGlobalPackage(activeManager.value, 'update', pkg.name)
    if (result.success) {
      ElMessage.success(`${pkg.name} 更新成功`)
      logContent.value = result.output
      logVisible.value = true
      // 刷新列表
      await scanManager(activeManager.value)
    } else {
      ElMessage.error(`更新失败: ${result.output}`)
      logContent.value = result.output
      logVisible.value = true
    }
  } catch (e: any) {
    ElMessage.error(`更新异常: ${e.message}`)
  } finally {
    pkg._updating = false
    operatingPkg.value = ''
  }
}

// 卸载包
async function uninstallPackage(pkg: PkgItem) {
  try {
    await ElMessageBox.confirm(
      `确定要卸载 ${pkg.name} 吗？此操作不可恢复。`,
      '卸载确认',
      { type: 'warning', confirmButtonText: '确认卸载', cancelButtonText: '取消' }
    )
  } catch { return }

  operatingPkg.value = pkg.name
  pkg._uninstalling = true

  try {
    const result = await window.electronAPI.manageGlobalPackage(activeManager.value, 'uninstall', pkg.name)
    if (result.success) {
      ElMessage.success(`${pkg.name} 已卸载`)
      logContent.value = result.output
      logVisible.value = true
      // 刷新列表
      await scanManager(activeManager.value)
    } else {
      ElMessage.error(`卸载失败: ${result.output}`)
      logContent.value = result.output
      logVisible.value = true
    }
  } catch (e: any) {
    ElMessage.error(`卸载异常: ${e.message}`)
  } finally {
    pkg._uninstalling = false
    operatingPkg.value = ''
  }
}

// 打开外部链接
function openUrl(url: string) {
  if (url) window.electronAPI.openExternal(url)
}

// 初始化：扫描全部包管理器
onMounted(async () => {
  scanning.value = true
  await Promise.all(managers.map(mgr => scanManager(mgr.key)))
  scanning.value = false
})
</script>

<style scoped>
.package-deps {
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
  overflow: hidden;
  padding: 0;
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

.manager-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.manager-tabs :deep(.el-tabs__header) {
  padding: 0 20px;
  margin-bottom: 0;
}

.manager-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
}

.manager-tabs :deep(.el-tab-pane) {
  height: 100%;
  overflow-y: auto;
  padding: 16px 20px;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-count {
  margin-left: 4px;
}

.tab-content {
  min-height: 200px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 60px 0;
  color: #909399;
  font-size: 14px;
}

.unavailable-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 0;
  color: #909399;
}

.unavailable-state p {
  margin: 0;
  font-size: 14px;
}

.pkg-name {
  font-weight: 500;
  color: #303133;
}

.pkg-version {
  font-family: 'Consolas', 'Monaco', monospace;
  color: #409eff;
}

.checking-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #909399;
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
