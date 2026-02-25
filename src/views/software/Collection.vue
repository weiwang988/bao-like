<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { Plus, Upload, Link, ChromeFilled, Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { UploadProps } from 'element-plus'

interface Software {
  id: number
  icon: string
  name: string
  websiteUrl: string
  downloadUrl: string
  backupUrl: string
}

// 默认软件列表
const defaultSoftwareList: Software[] = [
  {
    id: 1,
    icon: '',
    name: 'JetBrains Toolbox',
    websiteUrl: 'https://www.jetbrains.com/toolbox-app/',
    downloadUrl: 'https://www.jetbrains.com/toolbox-app/download/',
    backupUrl: ''
  },
  {
    id: 2,
    icon: '',
    name: 'IntelliJ IDEA',
    websiteUrl: 'https://www.jetbrains.com/idea/',
    downloadUrl: 'https://www.jetbrains.com/idea/download/',
    backupUrl: ''
  },
  {
    id: 3,
    icon: '',
    name: 'WebStorm',
    websiteUrl: 'https://www.jetbrains.com/webstorm/',
    downloadUrl: 'https://www.jetbrains.com/webstorm/download/',
    backupUrl: ''
  },
  {
    id: 4,
    icon: '',
    name: 'PyCharm',
    websiteUrl: 'https://www.jetbrains.com/pycharm/',
    downloadUrl: 'https://www.jetbrains.com/pycharm/download/',
    backupUrl: ''
  },
  {
    id: 5,
    icon: '',
    name: 'HBuilder X',
    websiteUrl: 'https://www.dcloud.io/hbuilderx.html',
    downloadUrl: 'https://www.dcloud.io/hbuilderx.html',
    backupUrl: ''
  },
  {
    id: 6,
    icon: '',
    name: 'Navicat',
    websiteUrl: 'https://www.navicat.com/',
    downloadUrl: 'https://www.navicat.com/en/download/navicat-premium',
    backupUrl: ''
  },
  {
    id: 7,
    icon: '',
    name: 'Xshell',
    websiteUrl: 'https://www.netsarang.com/en/xshell/',
    downloadUrl: 'https://www.netsarang.com/en/xshell-download/',
    backupUrl: ''
  },
  {
    id: 8,
    icon: '',
    name: 'Xftp',
    websiteUrl: 'https://www.netsarang.com/en/xftp/',
    downloadUrl: 'https://www.netsarang.com/en/xftp-download/',
    backupUrl: ''
  },
  {
    id: 9,
    icon: '',
    name: 'Apifox',
    websiteUrl: 'https://apifox.com/',
    downloadUrl: 'https://apifox.com/',
    backupUrl: ''
  },
  {
    id: 10,
    icon: '',
    name: 'XTerminal',
    websiteUrl: 'https://www.xterminal.cn/',
    downloadUrl: 'https://www.xterminal.cn/',
    backupUrl: ''
  },
  {
    id: 11,
    icon: '',
    name: 'Another Redis Desktop Manager',
    websiteUrl: 'https://github.com/qishibo/AnotherRedisDesktopManager',
    downloadUrl: 'https://github.com/qishibo/AnotherRedisDesktopManager/releases',
    backupUrl: ''
  },
  {
    id: 12,
    icon: '',
    name: 'Clash Verge',
    websiteUrl: 'https://github.com/clash-verge-rev/clash-verge-rev',
    downloadUrl: 'https://github.com/clash-verge-rev/clash-verge-rev/releases',
    backupUrl: ''
  },
  {
    id: 13,
    icon: '',
    name: 'v2rayN',
    websiteUrl: 'https://github.com/2dust/v2rayN',
    downloadUrl: 'https://github.com/2dust/v2rayN/releases',
    backupUrl: ''
  },
  {
    id: 14,
    icon: '',
    name: 'Qoder',
    websiteUrl: 'https://qoder.com/',
    downloadUrl: 'https://qoder.com/',
    backupUrl: ''
  },
  {
    id: 15,
    icon: '',
    name: 'Cursor',
    websiteUrl: 'https://www.cursor.com/',
    downloadUrl: 'https://www.cursor.com/',
    backupUrl: ''
  },
  {
    id: 16,
    icon: '',
    name: 'Trae CN',
    websiteUrl: 'https://www.trae.cn/',
    downloadUrl: 'https://www.trae.cn/',
    backupUrl: ''
  }
]

// 从 URL 获取基础地址
const getBaseUrl = (url: string): string => {
  try {
    const urlObj = new URL(url)
    return `${urlObj.protocol}//${urlObj.hostname}`
  } catch {
    return ''
  }
}

const softwareList = ref<Software[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const editIndex = ref(-1)
const fetchingIcon = ref(false)
const loading = ref(true)

const defaultForm = {
  icon: '',
  name: '',
  websiteUrl: '',
  downloadUrl: '',
  backupUrl: ''
}

const form = reactive({ ...defaultForm })

// 保存数据到 store
const saveToStore = async () => {
  if (window.electronAPI?.storeSet) {
    await window.electronAPI.storeSet('softwareList', softwareList.value)
  }
}

// 从 store 加载数据
const loadFromStore = async () => {
  loading.value = true
  try {
    if (window.electronAPI?.storeGet) {
      const data = await window.electronAPI.storeGet<Software[]>('softwareList')
      if (data && data.length > 0) {
        softwareList.value = data
      } else {
        // 如果没有数据，使用默认列表并保存
        softwareList.value = defaultSoftwareList
        await saveToStore()
      }
    } else {
      // 非 Electron 环境，使用默认数据
      softwareList.value = defaultSoftwareList
    }
  } catch (error) {
    console.error('加载数据失败:', error)
    softwareList.value = defaultSoftwareList
  } finally {
    loading.value = false
  }
}

// 监听数据变化，自动保存
watch(softwareList, () => {
  if (!loading.value) {
    saveToStore()
  }
}, { deep: true })

onMounted(() => {
  loadFromStore()
})

const openAddDialog = () => {
  isEdit.value = false
  Object.assign(form, defaultForm)
  dialogVisible.value = true
}

const openEditDialog = (index: number) => {
  isEdit.value = true
  editIndex.value = index
  const software = softwareList.value[index]
  Object.assign(form, {
    icon: software.icon,
    name: software.name,
    websiteUrl: software.websiteUrl,
    downloadUrl: software.downloadUrl,
    backupUrl: software.backupUrl
  })
  dialogVisible.value = true
}

const handleSubmit = () => {
  if (!form.name) {
    return
  }
  
  if (isEdit.value) {
    softwareList.value[editIndex.value] = {
      ...softwareList.value[editIndex.value],
      ...form
    }
  } else {
    softwareList.value.push({
      id: Date.now(),
      ...form
    })
  }
  dialogVisible.value = false
}

const handleDelete = (index: number) => {
  softwareList.value.splice(index, 1)
}

const handleIconChange: UploadProps['onChange'] = (uploadFile) => {
  if (uploadFile.raw) {
    const reader = new FileReader()
    reader.onload = (e) => {
      form.icon = e.target?.result as string
    }
    reader.readAsDataURL(uploadFile.raw)
  }
}

// 从网站直接获取 favicon
const fetchIconFromUrl = async () => {
  const url = form.websiteUrl || form.downloadUrl
  if (!url) {
    ElMessage.warning('请先输入官方地址或官方下载地址')
    return
  }
  
  const baseUrl = getBaseUrl(url)
  if (!baseUrl) {
    ElMessage.error('无效的 URL 地址')
    return
  }
  
  fetchingIcon.value = true
  
  // 尝试多种 favicon 路径
  const faviconPaths = [
    '/favicon.ico',
    '/favicon.png',
    '/apple-touch-icon.png',
    '/apple-touch-icon-precomposed.png'
  ]
  
  for (const path of faviconPaths) {
    try {
      const faviconUrl = baseUrl + path
      const response = await fetch(faviconUrl)
      
      if (response.ok) {
        const blob = await response.blob()
        if (blob.size > 0 && blob.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.onload = (e) => {
            form.icon = e.target?.result as string
            ElMessage.success('图标获取成功')
          }
          reader.readAsDataURL(blob)
          fetchingIcon.value = false
          return
        }
      }
    } catch {
      // 继续尝试下一个路径
    }
  }
  
  // 如果直接获取失败，尝试解析 HTML 获取 link 标签
  try {
    const response = await fetch(url)
    const html = await response.text()
    
    // 解析 HTML 中的 icon link
    const iconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i)
      || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i)
    
    if (iconMatch) {
      let iconUrl = iconMatch[1]
      // 处理相对路径
      if (iconUrl.startsWith('//')) {
        iconUrl = 'https:' + iconUrl
      } else if (iconUrl.startsWith('/')) {
        iconUrl = baseUrl + iconUrl
      } else if (!iconUrl.startsWith('http')) {
        iconUrl = baseUrl + '/' + iconUrl
      }
      
      const iconResponse = await fetch(iconUrl)
      if (iconResponse.ok) {
        const blob = await iconResponse.blob()
        const reader = new FileReader()
        reader.onload = (e) => {
          form.icon = e.target?.result as string
          ElMessage.success('图标获取成功')
        }
        reader.readAsDataURL(blob)
        fetchingIcon.value = false
        return
      }
    }
  } catch {
    // 忽略错误
  }
  
  fetchingIcon.value = false
  ElMessage.error('获取图标失败，请手动上传')
}

// 打开外部链接
const openUrl = (url: string) => {
  if (url && window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url)
  }
}
</script>

<template>
  <div class="collection-page">
    <el-card class="page-card" v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>软件合集</span>
          <el-button type="primary" :icon="Plus" @click="openAddDialog">添加软件</el-button>
        </div>
      </template>
      
      <div v-if="softwareList.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无软件，点击上方按钮添加" />
      </div>
      
      <div v-else class="software-grid">
        <el-card 
          v-for="(item, index) in softwareList" 
          :key="item.id" 
          class="software-card"
          shadow="hover"
        >
          <div class="software-icon">
            <img v-if="item.icon" :src="item.icon" alt="icon" />
            <el-icon v-else :size="40"><Plus /></el-icon>
          </div>
          <div class="software-name">{{ item.name }}</div>
          <div class="software-links">
            <el-tooltip v-if="item.websiteUrl" content="官方地址" placement="top">
              <el-button size="small" :icon="ChromeFilled" circle @click="openUrl(item.websiteUrl)" />
            </el-tooltip>
            <el-tooltip v-if="item.downloadUrl" content="官方下载" placement="top">
              <el-button size="small" :icon="Download" circle type="primary" @click="openUrl(item.downloadUrl)" />
            </el-tooltip>
            <el-tooltip v-if="item.backupUrl" content="备用下载" placement="top">
              <el-button size="small" :icon="Link" circle type="success" @click="openUrl(item.backupUrl)" />
            </el-tooltip>
          </div>
          <div class="software-actions">
            <el-button size="small" @click="openEditDialog(index)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(index)">删除</el-button>
          </div>
        </el-card>
      </div>
    </el-card>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑软件' : '添加软件'"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="form" label-width="100px">
        <el-form-item label="图标">
          <div class="icon-upload">
            <el-upload
              class="icon-uploader"
              :show-file-list="false"
              :auto-upload="false"
              accept="image/*"
              :on-change="handleIconChange"
            >
              <div v-if="form.icon" class="icon-preview">
                <img :src="form.icon" alt="icon" />
              </div>
              <div v-else class="icon-placeholder">
                <el-icon :size="28"><Upload /></el-icon>
                <span>上传图标</span>
              </div>
            </el-upload>
            <div class="icon-actions">
              <el-button 
                size="small" 
                :icon="Link" 
                :loading="fetchingIcon"
                @click="fetchIconFromUrl"
              >
                从URL获取
              </el-button>
              <el-button v-if="form.icon" size="small" @click="form.icon = ''">清除</el-button>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="请输入软件名称" />
        </el-form-item>
        <el-form-item label="官方地址">
          <el-input v-model="form.websiteUrl" placeholder="请输入官方网站地址" />
        </el-form-item>
        <el-form-item label="官方下载地址">
          <el-input v-model="form.downloadUrl" placeholder="请输入官方下载地址" />
        </el-form-item>
        <el-form-item label="备用下载地址">
          <el-input v-model="form.backupUrl" placeholder="请输入备用下载地址" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.collection-page {
  height: 100%;
  display: flex;
}

.page-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.page-card :deep(.el-card__body) {
  flex: 1;
  overflow: auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.software-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.software-card {
  text-align: center;
}

.software-card :deep(.el-card__body) {
  padding: 16px;
}

.software-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 12px;
  border-radius: 12px;
  background-color: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.software-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.software-icon .el-icon {
  color: #c0c4cc;
}

.software-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.software-links {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 8px;
}

.software-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.icon-upload {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.icon-uploader {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
}

.icon-uploader :deep(.el-upload) {
  width: 100%;
  height: 100%;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.2s;
}

.icon-uploader :deep(.el-upload:hover) {
  border-color: #409eff;
}

.icon-preview {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
}

.icon-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.icon-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  gap: 4px;
}

.icon-placeholder span {
  font-size: 12px;
}

.icon-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
