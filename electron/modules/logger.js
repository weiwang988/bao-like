const { ipcMain } = require('electron')

// 日志管理模块
module.exports = function createLogger(mainWindow) {
  // 内存中的日志存储（最多保留 1000 条）
  let appLogs = []
  const MAX_LOGS = 1000

  // 添加日志（内部函数）
  function addLog(level, category, message, detail = '') {
    const logItem = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      time: Date.now(),
      level,
      category,
      message,
      detail
    }
    
    appLogs.unshift(logItem)
    
    // 限制日志数量
    if (appLogs.length > MAX_LOGS) {
      appLogs = appLogs.slice(0, MAX_LOGS)
    }
    
    // 通知渲染进程有新日志
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('new-log', logItem)
    }
    
    return logItem
  }

  // 设置日志相关的 IPC 处理
  ipcMain.handle('get-logs', () => {
    return { success: true, logs: appLogs }
  })

  ipcMain.handle('clear-logs', () => {
    appLogs = []
    return { success: true }
  })

  ipcMain.handle('add-log', (event, level, category, message, detail) => {
    const logItem = addLog(level, category, message, detail)
    return { success: true, log: logItem }
  })

  // 返回公共接口
  return {
    addLog,
    getLogs: () => appLogs,
    clearLogs: () => { appLogs = [] }
  }
}