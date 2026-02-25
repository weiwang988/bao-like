const { ipcMain, shell } = require('electron')
const { exec, execFile } = require('child_process')
const fs = require('fs')
const path = require('path')

// 导出工具扫描模块
module.exports = function setupToolScanner(logger) {
  const { addLog } = logger

  // 执行命令的 Promise 封装（带超时和窗口隐藏）
  function execPromise(command, timeout = 8000) {
    return new Promise((resolve) => {
      exec(command, {
        timeout,
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 1024 * 1024
      }, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, output: '', error: error.message })
        } else {
          resolve({ success: true, output: (stdout || stderr || '').trim(), error: '' })
        }
      })
    })
  }

  // Windows 常见安装目录映射
  const WINDOWS_SCAN_DIRS = {
    python: () => {
      const dirs = []
      const localAppData = process.env.LOCALAPPDATA || ''
      const userProfile = process.env.USERPROFILE || ''
      const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
      const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
      
      // 环境变量优先
      if (process.env.PYTHON_HOME) dirs.push(process.env.PYTHON_HOME)
      if (process.env.PYTHONPATH) dirs.push(process.env.PYTHONPATH.split(';')[0])
      
      // Python 官方安装路径 (3.6 - 3.14)
      for (let minor = 6; minor <= 14; minor++) {
        dirs.push(path.join(localAppData, `Programs\\Python\\Python3${minor}`))
        dirs.push(path.join(programFiles, `Python3${minor}`))
        dirs.push(path.join(programFilesX86, `Python3${minor}`))
      }
      // Python 2.7
      dirs.push(path.join(programFiles, 'Python27'))
      dirs.push(path.join(programFilesX86, 'Python27'))
      
      // Anaconda / Miniconda (多种路径)
      const condaPaths = [
        path.join(userProfile, 'Anaconda3'),
        path.join(userProfile, 'Miniconda3'),
        path.join(userProfile, 'anaconda3'),
        path.join(userProfile, 'miniconda3'),
        path.join(localAppData, 'anaconda3'),
        path.join(localAppData, 'miniconda3'),
        path.join(localAppData, 'Continuum', 'anaconda3'),
        path.join(localAppData, 'Continuum', 'miniconda3'),
        path.join(programFiles, 'Anaconda3'),
        path.join(programFiles, 'Miniconda3'),
      ]
      dirs.push(...condaPaths)
      // Conda 环境变量
      if (process.env.CONDA_PREFIX) dirs.push(process.env.CONDA_PREFIX)
      
      // pyenv-win
      const pyenvRoot = process.env.PYENV_ROOT || process.env.PYENV || path.join(userProfile, '.pyenv')
      dirs.push(path.join(pyenvRoot, 'pyenv-win', 'shims'))
      dirs.push(path.join(pyenvRoot, 'pyenv-win', 'versions'))
      
      // Scoop
      dirs.push(path.join(userProfile, 'scoop', 'apps', 'python', 'current'))
      dirs.push(path.join(userProfile, 'scoop', 'shims'))
      
      // 多盘符扫描
      for (const drive of ['C:', 'D:', 'E:']) {
        dirs.push(path.join(drive, 'Python'))
        dirs.push(path.join(drive, 'Python3'))
        for (let minor = 6; minor <= 14; minor++) {
          dirs.push(path.join(drive, `Python3${minor}`))
          dirs.push(path.join(drive, `Python\\Python3${minor}`))
        }
      }
      
      return [...new Set(dirs.filter(Boolean))]
    },
    java: () => {
      const dirs = []
      const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
      const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
      const userProfile = process.env.USERPROFILE || ''
      
      // 环境变量优先
      if (process.env.JAVA_HOME) dirs.push(path.join(process.env.JAVA_HOME, 'bin'))
      if (process.env.JRE_HOME) dirs.push(path.join(process.env.JRE_HOME, 'bin'))
      
      // Program Files\Java 下的所有 JDK/JRE
      for (const baseDir of [path.join(programFiles, 'Java'), path.join(programFilesX86, 'Java')]) {
        try {
          if (fs.existsSync(baseDir)) {
            const entries = fs.readdirSync(baseDir)
            for (const entry of entries) {
              dirs.push(path.join(baseDir, entry, 'bin'))
            }
          }
        } catch {}
      }
      
      // Eclipse Adoptium / Temurin / Zulu / GraalVM
      const vendorPaths = [
        path.join(programFiles, 'Eclipse Adoptium'),
        path.join(programFiles, 'Temurin'),
        path.join(programFiles, 'Zulu'),
        path.join(programFiles, 'GraalVM'),
        path.join(programFiles, 'Amazon Corretto'),
        path.join(programFiles, 'BellSoft'),
        path.join(programFiles, 'Microsoft'),
      ]
      for (const vendorBase of vendorPaths) {
        try {
          if (fs.existsSync(vendorBase)) {
            const entries = fs.readdirSync(vendorBase)
            for (const entry of entries) {
              if (entry.toLowerCase().includes('jdk') || entry.toLowerCase().includes('jre')) {
                dirs.push(path.join(vendorBase, entry, 'bin'))
              }
            }
          }
        } catch {}
      }
      
      // Scoop
      dirs.push(path.join(userProfile, 'scoop', 'apps', 'openjdk', 'current', 'bin'))
      dirs.push(path.join(userProfile, 'scoop', 'apps', 'temurin-jdk', 'current', 'bin'))
      
      // 多盘符扫描常见 Java 目录
      for (const drive of ['C:', 'D:', 'E:']) {
        try {
          const javaDir = path.join(drive, 'Java')
          if (fs.existsSync(javaDir)) {
            const entries = fs.readdirSync(javaDir)
            for (const entry of entries) {
              dirs.push(path.join(javaDir, entry, 'bin'))
            }
          }
        } catch {}
      }
      
      return [...new Set(dirs.filter(Boolean))]
    },
    node: () => {
      const dirs = []
      const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
      const appData = process.env.APPDATA || ''
      const localAppData = process.env.LOCALAPPDATA || ''
      const userProfile = process.env.USERPROFILE || ''
      
      // 环境变量优先
      if (process.env.NODE_HOME) dirs.push(process.env.NODE_HOME)
      
      // 默认安装路径
      dirs.push(path.join(programFiles, 'nodejs'))
      
      // nvm for windows
      const nvmHome = process.env.NVM_HOME || path.join(appData, 'nvm')
      if (fs.existsSync(nvmHome)) {
        try {
          const entries = fs.readdirSync(nvmHome)
          for (const entry of entries) {
            const fullPath = path.join(nvmHome, entry)
            if (/^v?\d+\.\d+\.\d+$/.test(entry) && fs.existsSync(path.join(fullPath, 'node.exe'))) {
              dirs.push(fullPath)
            }
          }
        } catch {}
      }
      
      // fnm
      const fnmDir = process.env.FNM_DIR || path.join(localAppData, 'fnm')
      dirs.push(path.join(fnmDir, 'node-versions'))
      dirs.push(path.join(localAppData, 'fnm_multishells'))
      
      // Volta
      const voltaHome = process.env.VOLTA_HOME || path.join(localAppData, 'Volta')
      dirs.push(path.join(voltaHome, 'bin'))
      
      // Scoop
      dirs.push(path.join(userProfile, 'scoop', 'apps', 'nodejs', 'current'))
      dirs.push(path.join(userProfile, 'scoop', 'apps', 'nodejs-lts', 'current'))
      
      return [...new Set(dirs.filter(Boolean))]
    },
    // 其他工具的目录扫描函数可以按需添加...
  }

  // Windows 注册表扫描规则
  const REGISTRY_RULES = {
    python: 'HKLM\\SOFTWARE\\Python\\PythonCore',
    java: 'HKLM\\SOFTWARE\\JavaSoft',
    node: 'HKLM\\SOFTWARE\\Node.js',
    mysql: 'HKLM\\SOFTWARE\\MySQL AB',
    postgresql: 'HKLM\\SOFTWARE\\PostgreSQL\\Installations',
    git: 'HKLM\\SOFTWARE\\GitForWindows',
    mongodb: 'HKLM\\SOFTWARE\\MongoDB\\Server',
    dotnet: 'HKLM\\SOFTWARE\\dotnet\\Setup\\InstalledVersions',
  }

  // 策略1: where 命令查找所有 PATH 中的实例
  async function scanByWhere(exeName, scanDetails = null) {
    const results = []
    const cmd = `where "${exeName}" 2>nul`
    try {
      if (scanDetails) scanDetails.push(`  命令: ${cmd}`)
      const res = await execPromise(cmd, 5000)
      if (res.success && res.output) {
        const paths = res.output.split(/\r?\n/).map(p => p.trim()).filter(p => p && fs.existsSync(p))
        // 去重（路径不区分大小写）
        const seen = new Set()
        for (const p of paths) {
          const normalized = p.toLowerCase()
          if (!seen.has(normalized)) {
            seen.add(normalized)
            results.push(p)
          }
        }
        if (scanDetails && results.length > 0) {
          scanDetails.push(`  结果: ${results.join(', ')}`)
        }
      } else if (scanDetails) {
        scanDetails.push(`  结果: 未找到`)
      }
    } catch (e) {
      if (scanDetails) scanDetails.push(`  异常: ${e.message}`)
    }
    return results
  }

  // 策略2: 目录扫描
  function scanByDirectory(toolId, exeName) {
    const results = []
    const getDirs = WINDOWS_SCAN_DIRS[toolId]
    if (!getDirs) return results

    const dirs = getDirs()
    for (const dir of dirs) {
      try {
        if (!fs.existsSync(dir)) continue
        const exePath = path.join(dir, exeName + '.exe')
        if (fs.existsSync(exePath)) {
          results.push(exePath)
        }
      } catch {}
    }
    return results
  }

  // 策略3: 注册表扫描 (返回已安装版本的路径)
  async function scanByRegistry(toolId, scanDetails = null) {
    const results = []
    const regKey = REGISTRY_RULES[toolId]
    if (!regKey) {
      if (scanDetails) scanDetails.push(`  无注册表规则: ${toolId}`)
      return results
    }

    try {
      const cmd1 = `reg query "${regKey}" /s /v InstallPath 2>nul`
      if (scanDetails) scanDetails.push(`  命令: ${cmd1}`)
      const res = await execPromise(cmd1, 5000)
      if (res.success && res.output) {
        const matches = res.output.matchAll(/InstallPath\s+REG_SZ\s+(.+)/gi)
        for (const match of matches) {
          const installPath = match[1].trim()
          if (installPath && fs.existsSync(installPath)) {
            results.push(installPath)
          }
        }
        if (scanDetails && results.length > 0) {
          scanDetails.push(`  找到: ${results.join(', ')}`)
        }
      }
    } catch (e) {
      if (scanDetails) scanDetails.push(`  异常: ${e.message}`)
    }

    // 部分工具注册表结构不同，尝试 InstallLocation
    if (results.length === 0) {
      try {
        const cmd2 = `reg query "${regKey}" /s /v InstallLocation 2>nul`
        if (scanDetails) scanDetails.push(`  命令: ${cmd2}`)
        const res = await execPromise(cmd2, 5000)
        if (res.success && res.output) {
          const matches = res.output.matchAll(/InstallLocation\s+REG_SZ\s+(.+)/gi)
          for (const match of matches) {
            const installPath = match[1].trim()
            if (installPath && fs.existsSync(installPath)) {
              results.push(installPath)
            }
          }
          if (scanDetails && results.length > 0) {
            scanDetails.push(`  找到: ${results.join(', ')}`)
          }
        }
      } catch (e) {
        if (scanDetails) scanDetails.push(`  异常: ${e.message}`)
      }
    }

    if (scanDetails && results.length === 0) {
      scanDetails.push(`  结果: 未找到`)
    }

    return results
  }

  // 策略4: Windows 服务扫描
  async function scanByService(serviceName, exeName, scanDetails = null) {
    const results = []
    try {
      const script = `
        Get-WmiObject Win32_Service -Filter "Name LIKE '${serviceName}%'" | ForEach-Object {
          $rawPath = $_.PathName -replace '"', ''
          $exePath = ($rawPath -split ' ')[0]
          $dir = Split-Path $exePath
          Write-Output $dir
        }
      `
      if (scanDetails) {
        scanDetails.push(`  PowerShell: Get-WmiObject Win32_Service -Filter "Name LIKE '${serviceName}%'"`)
      }
      const res = await new Promise((resolve) => {
        execFile('powershell.exe', ['-NoProfile', '-Command', script],
          { timeout: 10000, windowsHide: true }, (error, stdout) => {
            if (error) {
              if (scanDetails) scanDetails.push(`  执行失败: ${error.message}`)
              resolve([])
            }
            else {
              const dirs = stdout.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean)
              resolve(dirs)
            }
          })
      })
      if (scanDetails) {
        if (res.length > 0) {
          scanDetails.push(`  服务目录: ${res.join(', ')}`)
        } else {
          scanDetails.push(`  结果: 未找到服务`)
        }
      }
      for (const dir of res) {
        const exePath = path.join(dir, exeName + '.exe')
        if (fs.existsSync(exePath)) {
          results.push(exePath)
        }
      }
    } catch (e) {
      if (scanDetails) scanDetails.push(`  异常: ${e.message}`)
    }
    return results
  }

  // 对指定路径的可执行文件运行版本命令
  async function getVersionFromPath(exePath, versionArgs, versionRegex, scanDetails = null) {
    const cmd = `"${exePath}" ${versionArgs}`
    try {
      const result = await execPromise(cmd, 8000)
      if (scanDetails) {
        scanDetails.push(`  命令: ${cmd}`)
        if (result.success) {
          scanDetails.push(`  输出: ${result.output.substring(0, 200)}${result.output.length > 200 ? '...' : ''}`)
        } else {
          scanDetails.push(`  执行失败: ${result.error}`)
        }
      }
      if (result.success && result.output) {
        const re = new RegExp(versionRegex)
        const match = result.output.match(re)
        if (match) {
          return match[1] || match[2] || match[3] || match[0]
        }
      }
      // 有些工具输出到 stderr（如 java -version）
      return null
    } catch (e) {
      if (scanDetails) {
        scanDetails.push(`  命令: ${cmd}`)
        scanDetails.push(`  异常: ${e.message}`)
      }
      return null
    }
  }

  // 统一扫描入口：多策略并行扫描
  ipcMain.handle('scan-tool', async (event, toolConfig) => {
    const {
      id,             // 工具标识（如 'python', 'java'）
      name,           // 工具显示名称
      exeNames,       // 可执行文件名列表（如 ['python', 'python3', 'py']）
      versionArgs,    // 版本参数（如 '--version'）
      versionRegex,   // 版本正则
      serviceName,    // Windows 服务名（可选，如 'MySQL'）
    } = toolConfig

    const foundVersions = []
    const seenPaths = new Set()
    const scanDetails = [] // 扫描详情日志

    addLog('info', 'tool', `开始扫描工具: ${name || id}`, `可执行文件: ${exeNames.join(', ')}\n版本参数: ${versionArgs}`)
    scanDetails.push(`[开始] 扫描 ${name || id}`)

    // 辅助函数：对路径执行版本检测并加入结果
    async function probeAndAdd(exePath, label) {
      const normalized = exePath.toLowerCase()
      if (seenPaths.has(normalized)) return
      seenPaths.add(normalized)

      scanDetails.push(`[检测] ${label}: ${exePath}`)
      const version = await getVersionFromPath(exePath, versionArgs, versionRegex, scanDetails)
      if (version) {
        foundVersions.push({
          version,
          path: exePath,
          label,
          isActive: foundVersions.length === 0,
        })
        scanDetails.push(`  [结果] 版本: ${version}`)
      } else {
        scanDetails.push(`  [结果] 无法解析版本`)
      }
    }

    // 对每个可执行文件名并行执行多策略
    const allExeScans = exeNames.map(async (exeName) => {
      // 策略1: where 命令（PATH 搜索）
      scanDetails.push(`[策略1] PATH搜索: ${exeName}`)
      const wherePaths = await scanByWhere(exeName, scanDetails)
      for (const p of wherePaths) {
        await probeAndAdd(p, `PATH: ${exeName}`)
      }

      // 策略2: 目录扫描
      scanDetails.push(`[策略2] 目录扫描: ${exeName}`)
      const dirPaths = scanByDirectory(id, exeName)
      if (dirPaths.length > 0) {
        scanDetails.push(`  扫描目录数: ${WINDOWS_SCAN_DIRS[id] ? WINDOWS_SCAN_DIRS[id]().length : 0}`)
        scanDetails.push(`  找到: ${dirPaths.join(', ')}`)
      } else {
        scanDetails.push(`  扫描目录数: ${WINDOWS_SCAN_DIRS[id] ? WINDOWS_SCAN_DIRS[id]().length : 0}`)
        scanDetails.push(`  结果: 未找到`)
      }
      for (const p of dirPaths) {
        await probeAndAdd(p, `目录: ${path.dirname(p)}`)
      }
    })

    // 策略3: 注册表扫描（与策略1/2并行）
    const registryScan = (async () => {
      scanDetails.push(`[策略3] 注册表扫描`)
      const regPaths = await scanByRegistry(id, scanDetails)
      for (const regDir of regPaths) {
        for (const exeName of exeNames) {
          const exePath = path.join(regDir, exeName + '.exe')
          if (fs.existsSync(exePath)) {
            await probeAndAdd(exePath, `注册表: ${regDir}`)
          }
          // 也检查 bin 子目录
          const binExePath = path.join(regDir, 'bin', exeName + '.exe')
          if (fs.existsSync(binExePath)) {
            await probeAndAdd(binExePath, `注册表: ${path.join(regDir, 'bin')}`)
          }
        }
      }
    })()

    // 策略4: 服务扫描（并行）
    const serviceScan = (async () => {
      if (serviceName) {
        scanDetails.push(`[策略4] 服务扫描: ${serviceName}`)
        const mainExe = exeNames[0]
        const svcPaths = await scanByService(serviceName, mainExe, scanDetails)
        for (const p of svcPaths) {
          await probeAndAdd(p, `服务: ${serviceName}`)
        }
      }
    })()

    // 并行执行所有策略
    await Promise.all([...allExeScans, registryScan, serviceScan])

    // 确定状态
    let status = 'not_installed'
    if (foundVersions.length > 1) {
      status = 'multiple_versions'
    } else if (foundVersions.length === 1) {
      status = 'installed'
    }

    // 记录扫描结果日志
    const resultMessage = foundVersions.length > 0 
      ? `扫描完成: ${name || id} - 找到 ${foundVersions.length} 个版本`
      : `扫描完成: ${name || id} - 未找到`
    
    const logLevel = foundVersions.length > 0 ? 'info' : 'warn'
    addLog(logLevel, 'tool', resultMessage, scanDetails.join('\n'))

    return {
      success: foundVersions.length > 0,
      versions: foundVersions,
      status,
    }
  })

  // 通过 Windows 服务扫描程序版本
  ipcMain.handle('scan-service-versions', (event, serviceName) => {
    return new Promise((resolve) => {
      const script = `
        Get-WmiObject Win32_Service -Filter "Name LIKE '${serviceName}%'" | ForEach-Object {
          $rawPath = $_.PathName -replace '"', ''
          $exePath = ($rawPath -split ' ')[0]
          $dir = Split-Path $exePath
          $client = Join-Path $dir '${serviceName.toLowerCase()}.exe'
          if (Test-Path $client) {
            $name = $_.Name
            $ver = & $client --version 2>&1
            Write-Output "$name|$ver"
          }
        }
      `
      execFile('powershell.exe', ['-NoProfile', '-Command', script], { timeout: 15000 }, (error, stdout) => {
        if (error) {
          resolve({ success: false, versions: [] })
        } else {
          const lines = stdout.trim().split(/\r?\n/).filter(l => l.includes('|'))
          const versions = lines.map(line => {
            const parts = line.split('|')
            return { name: parts[0].trim(), versionOutput: parts.slice(1).join('|').trim() }
          })
          resolve({ success: true, versions })
        }
      })
    })
  })
}