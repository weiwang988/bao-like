<template>
  <div class="port-monitor">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>监控端口</span>
          <div class="header-actions">
            <el-input
              v-model="searchText"
              placeholder="搜索端口或进程..."
              :prefix-icon="Search"
              clearable
              style="width: 200px; margin-right: 12px;"
            />
            <el-select
              v-model="selectedProtocol"
              placeholder="全部协议"
              clearable
              style="width: 120px; margin-right: 12px;"
            >
              <el-option label="TCP" value="TCP" />
              <el-option label="UDP" value="UDP" />
            </el-select>
            <el-select
              v-model="selectedState"
              placeholder="全部状态"
              clearable
              style="width: 120px; margin-right: 12px;"
            >
              <el-option label="监听(Listen)" value="Listen" />
              <el-option label="已建立(Established)" value="Established" />
              <el-option label="等待(TimeWait)" value="TimeWait" />
              <el-option label="关闭等待(CloseWait)" value="CloseWait" />
            </el-select>
            <el-button type="primary" :icon="Refresh" :loading="loading" @click="loadPorts">
              {{ loading ? '刷新中...' : '刷新' }}
            </el-button>
          </div>
        </div>
      </template>

      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-label">监听端口</span>
          <span class="stat-value">{{ listeningCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">已建立连接</span>
          <span class="stat-value">{{ establishedCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">TCP 连接</span>
          <span class="stat-value">{{ tcpCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">UDP 连接</span>
          <span class="stat-value">{{ udpCount }}</span>
        </div>
      </div>

      <el-table
        :data="filteredPorts"
        stripe
        style="width: 100%"
        height="calc(100vh - 280px)"
        :default-sort="{ prop: 'localPort', order: 'ascending' }"
      >
        <el-table-column prop="localPort" label="端口" width="100" sortable>
          <template #default="{ row }">
            <span class="port-number">{{ row.localPort }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="protocol" label="协议" width="80">
          <template #default="{ row }">
            <el-tag :type="row.protocol === 'TCP' ? 'primary' : 'success'" size="small">
              {{ row.protocol }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="processName" label="进程" min-width="180" show-overflow-tooltip />
        <el-table-column prop="pid" label="PID" width="90" sortable />
        <el-table-column prop="state" label="状态" width="180">
          <template #default="{ row }">
            <el-tag :type="getStateType(row.state)" size="small">
              {{ getStateLabel(row.state) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-tooltip content="复制地址" placement="top">
              <el-button
                :icon="DocumentCopy"
                size="small"
                circle
                @click="copyAddress(row)"
              />
            </el-tooltip>
            <el-tooltip content="结束进程" placement="top">
              <el-button
                :icon="Close"
                size="small"
                circle
                type="danger"
                :disabled="!row.pid"
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
import { Refresh, Search, DocumentCopy, Close } from '@element-plus/icons-vue'

interface PortItem {
  protocol: string
  localAddress: string
  localPort: number
  remoteAddress: string
  remotePort: number | null
  state: string
  pid: number | null
  processName: string
}

const loading = ref(false)
const searchText = ref('')
const selectedProtocol = ref('')
const selectedState = ref('')
const ports = ref<PortItem[]>([])

// 状态颜色
function getStateType(state: string): string {
  const typeMap: Record<string, string> = {
    'Listen': 'success',
    'Established': 'primary',
    'TimeWait': 'warning',
    'CloseWait': 'warning',
    'FinWait1': 'info',
    'FinWait2': 'info',
    'SynSent': 'info',
    'SynReceived': 'info',
    'Closed': 'danger',
    'LastAck': 'info',
    'Closing': 'warning',
    'Bound': 'success',
  }
  return typeMap[state] || 'info'
}

// 状态中英文映射
function getStateLabel(state: string): string {
  const labelMap: Record<string, string> = {
    'Listen': '监听(Listen)',
    'Established': '已建立(Established)',
    'TimeWait': '等待(TimeWait)',
    'CloseWait': '关闭等待(CloseWait)',
    'FinWait1': '结束等待1(FinWait1)',
    'FinWait2': '结束等待2(FinWait2)',
    'SynSent': '同步发送(SynSent)',
    'SynReceived': '同步接收(SynReceived)',
    'Closed': '已关闭(Closed)',
    'LastAck': '最后确认(LastAck)',
    'Closing': '关闭中(Closing)',
    'Bound': '已绑定(Bound)',
  }
  return labelMap[state] || state || '-'
}

// 过滤后的端口列表
const filteredPorts = computed(() => {
  let result = ports.value
  
  if (searchText.value) {
    const search = searchText.value.toLowerCase()
    result = result.filter(p => 
      p.processName.toLowerCase().includes(search) ||
      p.localPort.toString().includes(search) ||
      (p.pid && p.pid.toString().includes(search))
    )
  }
  
  if (selectedProtocol.value) {
    result = result.filter(p => p.protocol === selectedProtocol.value)
  }
  
  if (selectedState.value) {
    result = result.filter(p => p.state === selectedState.value)
  }
  
  return result
})

// 统计信息
const listeningCount = computed(() => ports.value.filter(p => p.state === 'Listen').length)
const establishedCount = computed(() => ports.value.filter(p => p.state === 'Established').length)
const tcpCount = computed(() => ports.value.filter(p => p.protocol === 'TCP').length)
const udpCount = computed(() => ports.value.filter(p => p.protocol === 'UDP').length)

// 加载端口列表
async function loadPorts() {
  loading.value = true
  try {
    const result = await window.electronAPI.listPorts()
    if (result.success) {
      ports.value = result.ports
    } else {
      ElMessage.error('获取端口列表失败')
    }
  } catch (error) {
    ElMessage.error('获取端口列表失败')
  } finally {
    loading.value = false
  }
}

// 结束进程
async function killProcess(port: PortItem) {
  if (!port.pid) return
  
  try {
    await ElMessageBox.confirm(
      `确定要结束进程 "${port.processName}" (PID: ${port.pid}) 吗？\n这将释放端口 ${port.localPort}`,
      '警告',
      { type: 'warning' }
    )
    
    const result = await window.electronAPI.killProcess(port.pid)
    if (result.success) {
      ElMessage.success('进程已结束')
      loadPorts()
    } else {
      ElMessage.error(result.error || '结束进程失败')
    }
  } catch {
    // 用户取消
  }
}

// 复制地址
function copyAddress(port: PortItem) {
  const address = `${port.localAddress}:${port.localPort}`
  navigator.clipboard.writeText(address)
  ElMessage.success('地址已复制: ' + address)
}

onMounted(() => {
  loadPorts()
})
</script>

<style scoped>
.port-monitor {
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

.port-number {
  font-family: 'Consolas', 'Monaco', monospace;
  font-weight: 600;
  color: #409eff;
}

.no-value {
  color: #c0c4cc;
}
</style>
