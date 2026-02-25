const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const { exec } = require('child_process')

// 导入各个功能模块
const createLogger = require('./modules/logger')
const setupPackageManager = require('./modules/packageManager')
const setupToolScanner = require('./modules/toolScanner')
const setupSystemMonitor = require('./modules/systemMonitor')

let mainWindow = null
let store = null

// 动态导入 electron-store (ESM 模块)
async function initStore() {
  const Store = (await import('electron-store')).default
  
  // 获取应用程序目录
  let appPath
  if (process.env.NODE_ENV === 'development') {
    // 开发环境：项目根目录
    appPath = path.join(__dirname, '..')
  } else {
    // 生产环境：应用程序安装目录
    appPath = path.dirname(app.getPath('exe'))
  }
  
  store = new Store({
    name: 'baolike-data',
    cwd: appPath,
    defaults: {
      softwareList: [],
      customPackages: [],
      editedBuiltinPackages: {}
    }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 开发环境加载 Vite 开发服务器
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // 生产环境加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // 监听窗口最大化状态变化
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('maximize-change', true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('maximize-change', false)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 窗口控制 IPC 处理
ipcMain.on('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize()
  }
})

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.on('window-close', () => {
  if (mainWindow) {
    mainWindow.close()
  }
})

// 数据存储 IPC 处理
ipcMain.handle('store-get', (event, key) => {
  if (store) {
    return store.get(key)
  }
  return null
})

ipcMain.handle('store-set', (event, key, value) => {
  if (store) {
    store.set(key, value)
    return true
  }
  return false
})

ipcMain.handle('store-get-path', () => {
  if (store) {
    return store.path
  }
  return ''
})

// 打开外部链接
ipcMain.handle('open-external', async (event, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    await shell.openExternal(url)
    return true
  }
  return false
})

// 执行命令获取版本信息
ipcMain.handle('exec-command', (event, command) => {
  return new Promise((resolve) => {
    exec(command, { timeout: 10000, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, output: '', error: error.message })
      } else {
        resolve({ success: true, output: stdout || stderr, error: '' })
      }
    })
  })
})

// 初始化应用
async function initializeApp() {
  // 初始化存储
  await initStore()
  
  // 创建主窗口
  createWindow()
  
  // 初始化日志系统
  const logger = createLogger(mainWindow)
  
  // 初始化各个功能模块
  setupPackageManager(logger)
  setupToolScanner(logger)
  setupSystemMonitor(logger)
  
  // 应用生命周期事件
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
}

// 应用准备就绪时启动
app.whenReady().then(initializeApp)

// 窗口全部关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 导出模块（用于测试）
module.exports = {
  createWindow,
  initializeApp
}