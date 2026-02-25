/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ExecResult {
  success: boolean
  output: string
  error: string
}

interface ServiceVersionResult {
  success: boolean
  versions: { name: string; versionOutput: string }[]
}

interface GlobalPackageInfo {
  name: string
  version: string
}

interface ListPackagesResult {
  success: boolean
  packages: GlobalPackageInfo[]
  error: string
}

interface ManagePackageResult {
  success: boolean
  output: string
}

interface CheckOutdatedResult {
  success: boolean
  outdated: Record<string, string>
}

interface CacheInfo {
  manager: string
  path: string
  size: number
  available: boolean
}

interface ScanCachesResult {
  success: boolean
  caches: CacheInfo[]
}

interface CleanCacheResult {
  success: boolean
  output: string
}

interface ToolScanConfig {
  id: string
  exeNames: string[]
  versionArgs: string
  versionRegex: string
  serviceName?: string
}

interface ToolVersionFound {
  version: string
  path: string
  label: string
  isActive: boolean
}

interface ToolScanResult {
  success: boolean
  versions: ToolVersionFound[]
  status: 'installed' | 'multiple_versions' | 'not_installed'
}

interface ProcessInfo {
  pid: number
  name: string
  memory: number
  cpu: number
  status: string
  path: string
}

interface ListProcessesResult {
  success: boolean
  processes: ProcessInfo[]
}

interface PortInfo {
  protocol: string
  localAddress: string
  localPort: number
  remoteAddress: string
  remotePort: number | null
  state: string
  pid: number | null
  processName: string
}

interface ListPortsResult {
  success: boolean
  ports: PortInfo[]
}

interface KillProcessResult {
  success: boolean
  error?: string
}

interface ShowItemResult {
  success: boolean
  error?: string
}

interface PathVariableItem {
  path: string
  exists: boolean
  problem: string
}

interface GetPathVariablesResult {
  success: boolean
  paths: PathVariableItem[]
}

interface LogItem {
  id: string
  time: number
  level: 'info' | 'warn' | 'error' | 'debug'
  category: 'tool' | 'deps' | 'cache' | 'system'
  message: string
  detail?: string
}

interface GetLogsResult {
  success: boolean
  logs: LogItem[]
}

interface AddLogResult {
  success: boolean
  log: LogItem
}

interface ClearLogsResult {
  success: boolean
}

interface SystemInfo {
  platform: string
  arch: string
  nodeVersion: string
  electronVersion: string
  osVersion: string
  totalMemory: number
  freeMemory: number
}

interface Window {
  electronAPI: {
    minimize: () => void
    maximize: () => void
    close: () => void
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => void
    storeGet: <T>(key: string) => Promise<T>
    storeSet: <T>(key: string, value: T) => Promise<boolean>
    getStorePath: () => Promise<string>
    openExternal: (url: string) => Promise<boolean>
    execCommand: (command: string) => Promise<ExecResult>
    scanTool: (toolConfig: ToolScanConfig) => Promise<ToolScanResult>
    scanServiceVersions: (serviceName: string) => Promise<ServiceVersionResult>
    listGlobalPackages: (manager: string) => Promise<ListPackagesResult>
    manageGlobalPackage: (manager: string, action: string, packageName: string) => Promise<ManagePackageResult>
    checkOutdatedPackages: (manager: string) => Promise<CheckOutdatedResult>
    scanPackageCaches: () => Promise<ScanCachesResult>
    cleanPackageCache: (manager: string) => Promise<CleanCacheResult>
    listProcesses: () => Promise<ListProcessesResult>
    listPorts: () => Promise<ListPortsResult>
    killProcess: (pid: number) => Promise<KillProcessResult>
    showItemInFolder: (path: string) => Promise<ShowItemResult>
    getPathVariables: () => Promise<GetPathVariablesResult>
    getLogs: () => Promise<GetLogsResult>
    clearLogs: () => Promise<ClearLogsResult>
    addLog: (level: string, category: string, message: string, detail?: string) => Promise<AddLogResult>
    onNewLog: (callback: (log: LogItem) => void) => void
    getSystemInfo: () => Promise<SystemInfo>
    setAutoStart: (enable: boolean) => Promise<boolean>
  }
}
