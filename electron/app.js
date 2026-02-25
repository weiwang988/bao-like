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
  //确定图标路径
  let iconPath = ''
  if (process.env.NODE_ENV === 'development') {
    // 开发环境：项目根目录下的public文件夹
    iconPath = path.join(__dirname, '../public/icon.ico')
  } else {
    // 生产环境：应用程序资源目录
    iconPath = path.join(__dirname, '../resources/icon.ico')
  }
  
  //调信息
  console.log('图标路径:', iconPath)
  console.log('图标文件存在:', require('fs').existsSync(iconPath))
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: false,
    resizable: true,
    icon: iconPath, // 设置窗口图标
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
ipcMain.handle('exec-command', async (event, command) => {
  return new Promise((resolve) => {
    // 对于Windows系统，使用正确的编码
    const options = {
      timeout: 10000,
      encoding: 'utf8',
      // Windows系统使用GBK编码处理中文
      ...(process.platform === 'win32' && { 
        env: { ...process.env, LANG: 'zh_CN.UTF-8' }
      })
    };
    
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        console.log(`Command failed: ${command}`, error.message);
        resolve({ success: false, output: '', error: error.message })
      } else {
        // 处理可能的编码问题
        let output = stdout || stderr;
        console.log(`Command succeeded: ${command}`, output);
        resolve({ success: true, output: output, error: '' })
      }
    })
  })
})

// 获取系统信息
ipcMain.handle('get-system-info', async () => {
  const os = require('os')
  
  // 获取详细的Windows版本信息
  let detailedOSVersion = '';
  if (process.platform === 'win32') {
    try {
      const { execSync } = require('child_process');
      // 使用WMIC获取详细的Windows版本信息
      const wmicOutput = execSync('wmic os get Caption,Version /value', { 
        encoding: 'utf8',
        timeout: 5000,
        windowsHide: true
      });
      
      const lines = wmicOutput.split('\n').filter(line => line.trim());
      let caption = '';
      let version = '';
      
      lines.forEach(line => {
        if (line.startsWith('Caption=')) {
          caption = line.substring(8).trim();
        } else if (line.startsWith('Version=')) {
          version = line.substring(8).trim();
        }
      });
      
      //根据版本号判断Windows版本
      if (version.startsWith('10.0.')) {
        const buildNumber = parseInt(version.split('.')[2]);
        if (buildNumber >= 22000) {
          detailedOSVersion = 'Windows 11';
        } else {
          detailedOSVersion = 'Windows 10';
        }
      } else if (version.startsWith('6.3')) {
        detailedOSVersion = 'Windows 8.1';
      } else if (version.startsWith('6.2')) {
        detailedOSVersion = 'Windows 8';
      } else if (version.startsWith('6.1')) {
        detailedOSVersion = 'Windows 7';
      } else {
        detailedOSVersion = caption.replace('Microsoft ', '') || 'Windows';
      }
    } catch (error) {
      console.warn('获取详细Windows版本信息失败:', error);
      detailedOSVersion = 'Windows';
    }
  } else {
    detailedOSVersion = os.type();
  }
  
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    electronVersion: process.versions.electron,
    osVersion: os.release(),
    detailedOSVersion: detailedOSVersion,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem()
  }
})

// 设置开机启动
ipcMain.handle('set-auto-start', async (event, enable) => {
  const AutoLaunch = (await import('auto-launch')).default
  
  try {
    const autoLaunch = new AutoLaunch({
      name: 'BaoLike',
      path: app.getPath('exe')
    })
    
    if (enable) {
      await autoLaunch.enable()
    } else {
      await autoLaunch.disable()
    }
    
    return true
  } catch (error) {
    console.error('设置开机启动失败:', error)
    return false
  }
})

// 初始化应用
async function initializeApp() {
  // 初始化存储
  await initStore()
  
  // 保存应用信息到存储
  if (store) {
    store.set('packageInfo', {
      name: 'BaoLike',
      version: '1.0.0',
      description: 'Electron + Vue3 + Vite Application'
    })
  }
  
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