const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  onMaximizeChange: (callback) => {
    ipcRenderer.on('maximize-change', (event, isMaximized) => {
      callback(isMaximized)
    })
  },
  
  // 数据存储
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
  getStorePath: () => ipcRenderer.invoke('store-get-path'),
  
  // 打开外部链接
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // 执行命令
  execCommand: (command) => ipcRenderer.invoke('exec-command', command),
  
  // 多策略工具扫描
  scanTool: (toolConfig) => ipcRenderer.invoke('scan-tool', toolConfig),
  
  // 扫描服务版本
  scanServiceVersions: (serviceName) => ipcRenderer.invoke('scan-service-versions', serviceName),
  
  // 包管理
  listGlobalPackages: (manager) => ipcRenderer.invoke('list-global-packages', manager),
  manageGlobalPackage: (manager, action, packageName) => ipcRenderer.invoke('manage-global-package', manager, action, packageName),
  checkOutdatedPackages: (manager) => ipcRenderer.invoke('check-outdated-packages', manager),
  
  // 包缓存
  scanPackageCaches: () => ipcRenderer.invoke('scan-package-caches'),
  cleanPackageCache: (manager) => ipcRenderer.invoke('clean-package-cache', manager),
  
  // 进程和端口监控
  listProcesses: () => ipcRenderer.invoke('list-processes'),
  listPorts: () => ipcRenderer.invoke('list-ports'),
  killProcess: (pid) => ipcRenderer.invoke('kill-process', pid),
  showItemInFolder: (path) => ipcRenderer.invoke('show-item-in-folder', path),
  
  // PATH 环境变量
  getPathVariables: () => ipcRenderer.invoke('get-path-variables'),
  
  // 应用日志
  getLogs: () => ipcRenderer.invoke('get-logs'),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  addLog: (level, category, message, detail) => ipcRenderer.invoke('add-log', level, category, message, detail),
  onNewLog: (callback) => {
    ipcRenderer.on('new-log', (event, log) => {
      callback(log)
    })
  }
})
