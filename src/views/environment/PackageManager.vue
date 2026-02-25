<template>
  <div class="package-manager">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>工具管理</span>
          <div class="header-actions">
            <el-input
              v-model="searchText"
              placeholder="搜索包名称..."
              :prefix-icon="Search"
              clearable
              style="width: 200px; margin-right: 12px;"
            />
            <el-button type="success" :icon="Plus" @click="showAddDialog">
              添加
            </el-button>
            <el-button type="primary" :icon="Refresh" :loading="scanning" @click="scanAll">
              {{ scanning ? '扫描中...' : '刷新' }}
            </el-button>
            <el-button :icon="DocumentCopy" @click="copyAllVersions">
              复制全部
            </el-button>
          </div>
        </div>
      </template>
      
      <div class="package-content">
        <template v-for="category in filteredCategories" :key="category.name">
          <div class="category-section" v-if="category.packages.length > 0">
            <div class="category-title">
              <el-icon><component :is="category.icon" /></el-icon>
              <span>{{ category.name }}</span>
              <el-tag size="small" type="info">{{ category.packages.length }}</el-tag>
            </div>
            <div class="package-grid">
              <div
                v-for="pkg in category.packages"
                :key="pkg.name"
                class="package-card"
                :class="{ installed: pkg.installed, 'not-installed': !pkg.installed }"
              >
                <div class="package-header">
                  <span class="package-name">{{ pkg.name }}</span>
                  <div class="package-tags">
                    <el-tag v-if="pkg.isCustom" size="small" type="warning">自定义</el-tag>
                    <el-tag v-else-if="pkg.isEdited" size="small" type="info">已编辑</el-tag>
                    <el-tag
                      :type="pkg.status === 'multiple_versions' ? 'warning' : pkg.status === 'installed' ? 'success' : 'info'"
                      size="small"
                    >
                      {{ pkg.status === 'multiple_versions' ? '多版本' : pkg.status === 'installed' ? '已安装' : '未安装' }}
                    </el-tag>
                  </div>
                </div>
                <div class="package-version" v-if="pkg.installed">
                  <span class="version-label">版本:</span>
                  <span class="version-value">{{ pkg.version }}</span>
                  <el-popover
                    v-if="pkg.versions && pkg.versions.length > 1"
                    placement="right"
                    :width="360"
                    trigger="hover"
                  >
                    <template #reference>
                      <el-tag size="small" type="primary" class="multi-version-tag">
                        +{{ pkg.versions.length - 1 }}
                      </el-tag>
                    </template>
                    <div class="version-list">
                      <div class="version-list-title">检测到 {{ pkg.versions.length }} 个版本</div>
                      <div v-for="(v, i) in pkg.versions" :key="i" class="version-list-item">
                        <div class="version-list-row">
                          <span class="version-num">{{ v.version }}</span>
                          <span class="version-cmd">{{ v.command }}</span>
                        </div>
                        <div v-if="v.path" class="version-list-path" @click="copyPath(v.path)">{{ v.path }}</div>
                      </div>
                    </div>
                  </el-popover>
                </div>
                <div class="package-path" v-if="pkg.installed && pkg.path">
                  <span class="version-label">路径:</span>
                  <el-tooltip :content="'点击复制: ' + pkg.path" placement="top" :show-after="300">
                    <span class="path-value clickable" @click="copyPath(pkg.path)">{{ pkg.path }}</span>
                  </el-tooltip>
                </div>
                <div class="package-version" v-else>
                  <span class="version-label">状态:</span>
                  <span class="version-value not-found">未检测到</span>
                </div>
                <div class="package-actions">
                  <el-tooltip content="复制版本信息" placement="top" v-if="pkg.installed">
                    <el-button
                      :icon="DocumentCopy"
                      size="small"
                      circle
                      @click="copyVersion(pkg)"
                    />
                  </el-tooltip>
                  <el-tooltip content="官方网站" placement="top">
                    <el-button
                      :icon="ChromeFilled"
                      size="small"
                      circle
                      type="primary"
                      @click="openUrl(pkg.website)"
                    />
                  </el-tooltip>
                  <el-tooltip content="下载安装" placement="top" v-if="!pkg.installed && pkg.downloadUrl">
                    <el-button
                      :icon="Download"
                      size="small"
                      circle
                      type="success"
                      @click="openUrl(pkg.downloadUrl)"
                    />
                  </el-tooltip>
                  <el-tooltip content="编辑" placement="top">
                    <el-button
                      :icon="Edit"
                      size="small"
                      circle
                      type="warning"
                      @click="showEditDialog(pkg)"
                    />
                  </el-tooltip>
                  <el-tooltip content="删除" placement="top" v-if="pkg.isCustom">
                    <el-button
                      :icon="Delete"
                      size="small"
                      circle
                      type="danger"
                      @click="deleteCustomPackage(pkg.name)"
                    />
                  </el-tooltip>
                </div>
              </div>
            </div>
          </div>
        </template>
        
        <el-empty v-if="filteredCategories.every(c => c.packages.length === 0)" description="没有找到匹配的包" />
      </div>
    </el-card>
    
    <!-- 添加/编辑包对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEditMode ? '编辑包' : '添加包'" width="500px">
      <el-form :model="formData" label-width="100px">
        <el-form-item label="包名称" required>
          <el-input v-model="formData.name" placeholder="如：Bun" :disabled="isEditMode" />
        </el-form-item>
        <el-form-item label="检测命令" required>
          <el-input v-model="formData.command" placeholder="如：bun --version" />
        </el-form-item>
        <el-form-item label="版本正则" required>
          <el-input v-model="formData.versionRegex" placeholder="如：([\d.]+)" />
          <div class="form-tip">用于从命令输出中提取版本号，使用括号捕获版本</div>
        </el-form-item>
        <el-form-item label="分类" required>
          <el-select v-model="formData.category" placeholder="选择分类" style="width: 100%;">
            <el-option
              v-for="cat in categoryConfig"
              :key="cat.name"
              :label="cat.name"
              :value="cat.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="官网地址">
          <el-input v-model="formData.website" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="下载地址">
          <el-input v-model="formData.downloadUrl" placeholder="https://..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePackage">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Refresh, DocumentCopy, Search, ChromeFilled, Download,
  Cpu, Box, Tools, Connection, Plus, Delete, Edit,
  Switch, SetUp
} from '@element-plus/icons-vue'

interface VersionInfo {
  command: string
  version: string
  path?: string
}

interface PackageInfo {
  name: string
  command: string
  versionRegex: RegExp
  scanId?: string
  exeNames?: string[]
  versionArgs?: string
  serviceName?: string
  altCommands?: { cmd: string; label: string }[]
  website: string
  downloadUrl: string
  installed: boolean
  version: string
  path: string
  versions?: VersionInfo[]
  status: string
  category: string
  isCustom?: boolean
  isEdited?: boolean
}

interface StoredPackage {
  name: string
  command: string
  versionRegex: string
  website: string
  downloadUrl: string
  category: string
}

const scanning = ref(false)
const searchText = ref('')
const dialogVisible = ref(false)
const isEditMode = ref(false)
const editingName = ref('')

const formData = ref({
  name: '',
  command: '',
  versionRegex: '',
  category: '',
  website: '',
  downloadUrl: ''
})

// 自定义包列表
const customPackages = ref<StoredPackage[]>([])

// 已编辑的内置包配置
const editedBuiltinPackages = ref<Record<string, StoredPackage>>({})

// 从配置文件加载内置工具列表
import defaultToolsConfig from '@/config/defaultTools.json'

// 内置包定义列表（从 JSON 配置加载）
const builtinPackages: Omit<PackageInfo, 'installed' | 'version' | 'path' | 'versions' | 'status'>[] = defaultToolsConfig.tools.map(tool => ({
  name: tool.name,
  command: tool.command,
  versionRegex: new RegExp(tool.versionRegex),
  scanId: tool.scanId,
  exeNames: tool.exeNames,
  versionArgs: tool.versionArgs,
  serviceName: tool.serviceName,
  website: tool.website,
  downloadUrl: tool.downloadUrl,
  category: tool.category
}))

const packages = ref<PackageInfo[]>([])

// 合并内置包和自定义包
const packageDefinitions = computed(() => {
  // 处理内置包（应用已编辑的配置）
  const builtin = builtinPackages.map(pkg => {
    const edited = editedBuiltinPackages.value[pkg.name]
    if (edited) {
      return {
        ...edited,
        versionRegex: new RegExp(edited.versionRegex),
        isCustom: false,
        isEdited: true
      }
    }
    return { ...pkg, isCustom: false }
  })
  
  // 处理自定义包
  const custom = customPackages.value.map(pkg => ({
    ...pkg,
    versionRegex: new RegExp(pkg.versionRegex),
    isCustom: true
  }))
  
  return [...builtin, ...custom]
})

// 分类配置
const categoryConfig = [
  { name: '编程语言', icon: Cpu },
  { name: '包管理器', icon: Box },
  { name: '版本管理器', icon: Switch },
  { name: '开发工具', icon: Tools },
  { name: '构建工具', icon: SetUp },
  { name: '数据库', icon: Connection },
]

// 过滤后的分类
const filteredCategories = computed(() => {
  const search = searchText.value.toLowerCase()
  return categoryConfig.map(cat => ({
    ...cat,
    packages: packages.value.filter(pkg => 
      pkg.category === cat.name && 
      (search === '' || pkg.name.toLowerCase().includes(search))
    )
  }))
})

// 执行命令获取版本（使用多策略扫描引擎）
async function getVersion(pkg: Omit<PackageInfo, 'installed' | 'version' | 'path' | 'versions' | 'status'>): Promise<PackageInfo> {
  // 有 exeNames 配置的工具使用多策略扫描引擎
  if (pkg.exeNames && pkg.exeNames.length > 0 && pkg.versionArgs) {
    try {
      const result = await window.electronAPI.scanTool({
        id: pkg.scanId || pkg.exeNames[0],
        exeNames: pkg.exeNames,
        versionArgs: pkg.versionArgs,
        versionRegex: pkg.versionRegex.source,
        serviceName: pkg.serviceName,
      })

      if (result.success && result.versions.length > 0) {
        const versions: VersionInfo[] = result.versions.map(v => ({
          command: v.label,
          version: v.version,
          path: v.path,
        }))

        return {
          ...pkg,
          installed: true,
          version: versions[0].version,
          path: result.versions[0].path,
          versions: versions.length > 1 ? versions : undefined,
          status: result.status,
        }
      }

      return { ...pkg, installed: false, version: '', path: '', versions: undefined, status: 'not_installed' }
    } catch {
      // 后端引擎失败，回退到旧方式
    }
  }

  // 回退：没有 exeNames 或后端引擎不可用时，使用旧方式（自定义包等）
  try {
    const result = await window.electronAPI.execCommand(pkg.command)
    if (result.success && result.output) {
      const match = result.output.match(pkg.versionRegex)
      if (match) {
        const version = match[1] || match[2] || match[0]
        // 获取路径
        let toolPath = ''
        try {
          const cmdParts = pkg.command.split(/\s+/)
          const exe = cmdParts[0].replace(/^"/, '').replace(/"$/, '')
          const whereResult = await window.electronAPI.execCommand(`where "${exe}"`)
          if (whereResult.success && whereResult.output) {
            toolPath = whereResult.output.trim().split(/\r?\n/)[0].trim()
          }
        } catch {}
        return { ...pkg, installed: true, version, path: toolPath, versions: undefined, status: 'installed' }
      }
    }
  } catch {}

  return { ...pkg, installed: false, version: '', path: '', versions: undefined, status: 'not_installed' }
}

// 扫描所有包
async function scanAll() {
  scanning.value = true
  try {
    const results = await Promise.all(packageDefinitions.value.map(pkg => getVersion(pkg)))
    packages.value = results
    
    const installedCount = results.filter(p => p.installed).length
    ElMessage.success(`扫描完成，检测到 ${installedCount} 个已安装的包`)
  } catch (error) {
    ElMessage.error('扫描失败')
  } finally {
    scanning.value = false
  }
}

// 复制单个版本
function copyVersion(pkg: PackageInfo) {
  let text = `${pkg.name}: ${pkg.version}`
  if (pkg.versions && pkg.versions.length > 1) {
    text = `${pkg.name}:\n` + pkg.versions.map(v => `  ${v.command}: ${v.version}`).join('\n')
  }
  if (pkg.path) text += `\n路径: ${pkg.path}`
  navigator.clipboard.writeText(text)
  ElMessage.success(`已复制: ${pkg.name}`)
}

// 复制所有版本
function copyAllVersions() {
  const installedPackages = packages.value.filter(p => p.installed)
  if (installedPackages.length === 0) {
    ElMessage.warning('没有已安装的包')
    return
  }
  
  const lines = ['=== 环境配置信息 ===', '']
  
  categoryConfig.forEach(cat => {
    const categoryPackages = installedPackages.filter(p => p.category === cat.name)
    if (categoryPackages.length > 0) {
      lines.push(`【${cat.name}】`)
      categoryPackages.forEach(pkg => {
        if (pkg.versions && pkg.versions.length > 1) {
          lines.push(`  ${pkg.name}:`)
          pkg.versions.forEach(v => {
            lines.push(`    - ${v.command}: ${v.version}`)
          })
          if (pkg.path) lines.push(`    路径: ${pkg.path}`)
        } else {
          lines.push(`  ${pkg.name}: ${pkg.version}${pkg.path ? ' (' + pkg.path + ')' : ''}`)
        }
      })
      lines.push('')
    }
  })
  
  lines.push(`生成时间: ${new Date().toLocaleString()}`)
  
  navigator.clipboard.writeText(lines.join('\n'))
  ElMessage.success('已复制全部版本信息')
}

// 复制路径
function copyPath(path: string) {
  navigator.clipboard.writeText(path)
  ElMessage.success('路径已复制')
}

// 打开URL
function openUrl(url: string) {
  if (url) {
    window.electronAPI.openExternal(url)
  }
}

// 显示添加对话框
function showAddDialog() {
  isEditMode.value = false
  editingName.value = ''
  formData.value = {
    name: '',
    command: '',
    versionRegex: '([\\d.]+)',
    category: '编程语言',
    website: '',
    downloadUrl: ''
  }
  dialogVisible.value = true
}

// 显示编辑对话框
function showEditDialog(pkg: PackageInfo) {
  isEditMode.value = true
  editingName.value = pkg.name
  
  if (pkg.isCustom) {
    // 自定义包
    const stored = customPackages.value.find(p => p.name === pkg.name)
    if (!stored) return
    formData.value = {
      name: stored.name,
      command: stored.command,
      versionRegex: stored.versionRegex,
      category: stored.category,
      website: stored.website,
      downloadUrl: stored.downloadUrl
    }
  } else {
    // 内置包（可能已被编辑过）
    const edited = editedBuiltinPackages.value[pkg.name]
    if (edited) {
      formData.value = {
        name: edited.name,
        command: edited.command,
        versionRegex: edited.versionRegex,
        category: edited.category,
        website: edited.website,
        downloadUrl: edited.downloadUrl
      }
    } else {
      // 从内置包列表获取原始数据
      const builtin = builtinPackages.find(p => p.name === pkg.name)
      if (!builtin) return
      formData.value = {
        name: builtin.name,
        command: builtin.command,
        versionRegex: builtin.versionRegex.source,
        category: builtin.category,
        website: builtin.website,
        downloadUrl: builtin.downloadUrl
      }
    }
  }
  
  dialogVisible.value = true
}

// 保存包（添加或编辑）
async function savePackage() {
  if (!formData.value.name || !formData.value.command || !formData.value.versionRegex || !formData.value.category) {
    ElMessage.warning('请填写必填项')
    return
  }
  
  // 验证正则表达式
  try {
    new RegExp(formData.value.versionRegex)
  } catch {
    ElMessage.error('版本正则表达式格式错误')
    return
  }
  
  if (isEditMode.value) {
    // 编辑模式 - 判断是自定义包还是内置包
    const isCustomPkg = customPackages.value.some(p => p.name === editingName.value)
    
    if (isCustomPkg) {
      // 编辑自定义包
      const index = customPackages.value.findIndex(p => p.name === editingName.value)
      if (index > -1) {
        customPackages.value[index] = {
          name: formData.value.name,
          command: formData.value.command,
          versionRegex: formData.value.versionRegex,
          category: formData.value.category,
          website: formData.value.website,
          downloadUrl: formData.value.downloadUrl
        }
        await saveCustomPackages()
      }
    } else {
      // 编辑内置包
      editedBuiltinPackages.value[editingName.value] = {
        name: formData.value.name,
        command: formData.value.command,
        versionRegex: formData.value.versionRegex,
        category: formData.value.category,
        website: formData.value.website,
        downloadUrl: formData.value.downloadUrl
      }
      await saveEditedBuiltinPackages()
    }
    
    dialogVisible.value = false
    ElMessage.success('编辑成功')
    scanAll()
  } else {
    // 添加模式 - 检查名称是否重复
    const exists = packageDefinitions.value.some(p => p.name === formData.value.name)
    if (exists) {
      ElMessage.warning('包名称已存在')
      return
    }
    
    customPackages.value.push({
      name: formData.value.name,
      command: formData.value.command,
      versionRegex: formData.value.versionRegex,
      category: formData.value.category,
      website: formData.value.website,
      downloadUrl: formData.value.downloadUrl
    })
    
    await saveCustomPackages()
    dialogVisible.value = false
    ElMessage.success('添加成功')
    scanAll()
  }
}

// 删除自定义包
async function deleteCustomPackage(name: string) {
  try {
    await ElMessageBox.confirm('确定要删除该包吗？', '提示', {
      type: 'warning'
    })
    
    const index = customPackages.value.findIndex(p => p.name === name)
    if (index > -1) {
      customPackages.value.splice(index, 1)
      await saveCustomPackages()
      scanAll()
      ElMessage.success('删除成功')
    }
  } catch {
    // 用户取消
  }
}

// 加载自定义包
async function loadCustomPackages() {
  const stored = await window.electronAPI.storeGet<StoredPackage[]>('customPackages')
  if (stored && Array.isArray(stored)) {
    customPackages.value = stored
  }
}

// 保存自定义包
async function saveCustomPackages() {
  await window.electronAPI.storeSet('customPackages', customPackages.value)
}

// 加载已编辑的内置包
async function loadEditedBuiltinPackages() {
  const stored = await window.electronAPI.storeGet<Record<string, StoredPackage>>('editedBuiltinPackages')
  if (stored && typeof stored === 'object') {
    editedBuiltinPackages.value = stored
  }
}

// 保存已编辑的内置包
async function saveEditedBuiltinPackages() {
  await window.electronAPI.storeSet('editedBuiltinPackages', editedBuiltinPackages.value)
}

// 页面加载时自动扫描
onMounted(async () => {
  await loadCustomPackages()
  await loadEditedBuiltinPackages()
  scanAll()
})
</script>

<style scoped>
.package-manager {
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

.package-content {
  height: 100%;
  overflow-y: auto;
  padding: 20px;
}

.category-section {
  margin-bottom: 24px;
}

.category-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e4e7ed;
}

.category-title .el-icon {
  font-size: 18px;
  color: #409eff;
}

.package-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.package-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 14px;
  transition: all 0.2s;
}

.package-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.package-card.installed {
  border-left: 3px solid #67c23a;
}

.package-card.not-installed {
  border-left: 3px solid #909399;
  opacity: 0.8;
}

.package-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.package-name {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.package-version {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 13px;
}

.version-label {
  color: #909399;
}

.version-value {
  color: #606266;
  font-family: 'Consolas', 'Monaco', monospace;
}

.version-value.not-found {
  color: #909399;
  font-style: italic;
}

.package-path {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 13px;
}

.path-value {
  color: #606266;
  font-family: 'Consolas', 'Monaco', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
}

.path-value.clickable {
  cursor: pointer;
  transition: color 0.2s;
}

.path-value.clickable:hover {
  color: #409eff;
}

.package-actions {
  display: flex;
  gap: 8px;
}

.package-actions .el-button {
  --el-button-size: 28px;
}

.package-tags {
  display: flex;
  gap: 4px;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.multi-version-tag {
  margin-left: 6px;
  cursor: pointer;
}

.version-list {
  font-size: 13px;
}

.version-list-title {
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid #e4e7ed;
}

.version-list-item {
  padding: 6px 0;
  border-bottom: 1px solid #f0f0f0;
}

.version-list-item:last-child {
  border-bottom: none;
}

.version-list-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.version-list-path {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 11px;
  color: #909399;
  margin-top: 2px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-list-path:hover {
  color: #409eff;
}

.version-cmd {
  color: #909399;
  font-size: 12px;
}

.version-num {
  font-family: 'Consolas', 'Monaco', monospace;
  color: #409eff;
}
</style>
