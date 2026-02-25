const { ipcMain, shell } = require('electron')
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')

// 导出包管理器模块
module.exports = function setupPackageManager(logger) {
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

  // 解析各包管理器的输出
  function parsePackageList(manager, stdout, stderr) {
    const packages = []
    switch (manager) {
      case 'npm': {
        const skipNpm = new Set(['npm'])
        try {
          const data = JSON.parse(stdout)
          const deps = data.dependencies || {}
          for (const [name, info] of Object.entries(deps)) {
            if (skipNpm.has(name)) continue
            packages.push({ name, version: info.version || '未知' })
          }
        } catch {
          const lines = stdout.split(/\r?\n/)
          for (const line of lines) {
            const match = line.match(/[\s├└─│]+(.+?)@([\d.].*)/)
            if (match && !skipNpm.has(match[1].trim())) {
              packages.push({ name: match[1].trim(), version: match[2].trim() })
            }
          }
        }
        break
      }
      case 'pnpm': {
        try {
          const data = JSON.parse(stdout)
          const list = Array.isArray(data) ? data : [data]
          for (const item of list) {
            const deps = { ...(item.dependencies || {}), ...(item.devDependencies || {}) }
            for (const [name, info] of Object.entries(deps)) {
              packages.push({ name, version: info.version || (typeof info === 'string' ? info : '未知') })
            }
          }
        } catch {
          const lines = stdout.split(/\r?\n/)
          for (const line of lines) {
            const match = line.match(/(.+?)\s+([\d.].*)/)
            if (match) {
              packages.push({ name: match[1].trim(), version: match[2].trim() })
            }
          }
        }
        break
      }
      case 'yarn': {
        const lines = stdout.split(/\r?\n/)
        for (const line of lines) {
          const jsonMatch = line.match(/"([^@"]+)@([^"]+)"/)
          if (jsonMatch) {
            packages.push({ name: jsonMatch[1], version: jsonMatch[2] })
            continue
          }
          try {
            const obj = JSON.parse(line)
            if (obj.type === 'list' && obj.data && obj.data.trees) {
              for (const tree of obj.data.trees) {
                const treeMatch = tree.name.match(/^(.+?)@(.+)$/)
                if (treeMatch) {
                  packages.push({ name: treeMatch[1], version: treeMatch[2] })
                }
              }
            }
          } catch {}
        }
        break
      }
      case 'pip': {
        const skipPip = new Set(['pip', 'setuptools', 'wheel', 'pkg_resources', 'distribute'])
        try {
          const data = JSON.parse(stdout)
          for (const pkg of data) {
            if (skipPip.has(pkg.name) || skipPip.has(pkg.name.toLowerCase())) continue
            packages.push({ name: pkg.name, version: pkg.version })
          }
        } catch {
          const lines = stdout.split(/\r?\n/)
          for (const line of lines) {
            const match = line.match(/^(\S+)\s+([\d.].*)/)
            if (match && match[1] !== 'Package' && !match[1].startsWith('-') && !skipPip.has(match[1].toLowerCase())) {
              packages.push({ name: match[1], version: match[2].trim() })
            }
          }
        }
        break
      }
      case 'cargo': {
        const lines = stdout.split(/\r?\n/)
        for (const line of lines) {
          const pkgMatch = line.match(/^(\S+)\s+v([\d.]+.*)/)
          if (pkgMatch) {
            packages.push({ name: pkgMatch[1], version: pkgMatch[2].replace(/:$/, '') })
          }
        }
        break
      }
      case 'conda': {
        const skipConda = new Set(['conda', 'python', '_libgcc_mutex', '_openmp_mutex'])
        try {
          const data = JSON.parse(stdout)
          for (const pkg of data) {
            if (pkg.name.startsWith('_') || skipConda.has(pkg.name)) continue
            packages.push({ name: pkg.name, version: pkg.version })
          }
        } catch {
          const lines = stdout.split(/\r?\n/)
          for (const line of lines) {
            const match = line.match(/^(\S+)\s+([\d.]\S*)/)
            if (match && match[1] !== '#' && !match[1].startsWith('#') && !match[1].startsWith('_') && !skipConda.has(match[1])) {
              packages.push({ name: match[1], version: match[2] })
            }
          }
        }
        break
      }
      case 'composer': {
        try {
          const data = JSON.parse(stdout)
          const installed = data.installed || []
          for (const pkg of installed) {
            packages.push({ name: pkg.name, version: pkg.version })
          }
        } catch {
          const lines = stdout.split(/\r?\n/)
          for (const line of lines) {
            const match = line.match(/^(\S+\/\S+)\s+(v?[\d.].*)/)
            if (match) {
              packages.push({ name: match[1], version: match[2].trim() })
            }
          }
        }
        break
      }
    }
    return packages
  }

  // 列出全局安装的包（多候选命令 + 系统包过滤）
  ipcMain.handle('list-global-packages', async (event, manager) => {
    addLog('info', 'deps', `开始扫描包管理器: ${manager}`)
    
    // pip 多候选命令：不同系统 pip 可能在不同路径
    if (manager === 'pip') {
      const pipCandidates = [
        'pip list --format=json',
        'pip3 list --format=json',
        'py -m pip list --format=json',
        'python -m pip list --format=json',
        'python3 -m pip list --format=json',
      ]
      const triedCmds = []
      for (const cmd of pipCandidates) {
        try {
          triedCmds.push(cmd)
          const result = await execPromise(cmd, 30000)
          if (result.success && result.output) {
            const packages = parsePackageList('pip', result.output, '')
            addLog('info', 'deps', `pip 扫描完成: 找到 ${packages.length} 个包`, `使用命令: ${cmd}`)
            return { success: true, packages, error: '' }
          }
        } catch {}
      }
      addLog('warn', 'deps', 'pip 不可用', `尝试的命令:\n${triedCmds.join('\n')}`)
      return { success: false, packages: [], error: 'pip 不可用' }
    }

    // conda 多候选命令：可能在不同路径或需要激活环境
    if (manager === 'conda') {
      const condaCandidates = [
        'conda list --json',
        'conda.bat list --json',
      ]
      // 尝试常见 conda 路径
      const userProfile = process.env.USERPROFILE || ''
      const localAppData = process.env.LOCALAPPDATA || ''
      const condaPaths = [
        process.env.CONDA_PREFIX,
        path.join(userProfile, 'Anaconda3', 'Scripts', 'conda.exe'),
        path.join(userProfile, 'Miniconda3', 'Scripts', 'conda.exe'),
        path.join(userProfile, 'anaconda3', 'Scripts', 'conda.exe'),
        path.join(userProfile, 'miniconda3', 'Scripts', 'conda.exe'),
        path.join(localAppData, 'anaconda3', 'Scripts', 'conda.exe'),
        path.join(localAppData, 'miniconda3', 'Scripts', 'conda.exe'),
      ].filter(Boolean)
      
      const triedCmds = []
      for (const cmd of condaCandidates) {
        try {
          triedCmds.push(cmd)
          const result = await execPromise(cmd, 30000)
          if (result.success && result.output) {
            const packages = parsePackageList('conda', result.output, '')
            addLog('info', 'deps', `conda 扫描完成: 找到 ${packages.length} 个包`, `使用命令: ${cmd}`)
            return { success: true, packages, error: '' }
          }
        } catch {}
      }
      // 尝试绝对路径
      for (const condaPath of condaPaths) {
        if (condaPath && fs.existsSync(condaPath)) {
          try {
            const cmd = `"${condaPath}" list --json`
            triedCmds.push(cmd)
            const result = await execPromise(cmd, 30000)
            if (result.success && result.output) {
              const packages = parsePackageList('conda', result.output, '')
              addLog('info', 'deps', `conda 扫描完成: 找到 ${packages.length} 个包`, `使用命令: ${cmd}`)
              return { success: true, packages, error: '' }
            }
          } catch {}
        }
      }
      addLog('warn', 'deps', 'conda 不可用', `尝试的命令:\n${triedCmds.join('\n')}\n\n尝试的路径:\n${condaPaths.join('\n')}`)
      return { success: false, packages: [], error: 'conda 不可用' }
    }

    const commands = {
      npm: 'npm list -g --depth=0 --json',
      pnpm: 'pnpm list -g --json',
      yarn: 'yarn global list --json 2>nul || yarn global list',
      cargo: 'cargo install --list',
      composer: 'composer global show --format=json'
    }
    const cmd = commands[manager]
    if (!cmd) {
      addLog('error', 'deps', `不支持的包管理器: ${manager}`)
      return { success: false, packages: [], error: '不支持的包管理器' }
    }
    return new Promise((resolve) => {
      exec(cmd, { timeout: 30000, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
        try {
          const packages = parsePackageList(manager, stdout || '', stderr || '')
          addLog('info', 'deps', `${manager} 扫描完成: 找到 ${packages.length} 个包`, `使用命令: ${cmd}`)
          resolve({ success: true, packages, error: '' })
        } catch (e) {
          addLog('error', 'deps', `${manager} 扫描失败: ${e.message}`, `命令: ${cmd}\n错误: ${e.message}`)
          resolve({ success: false, packages: [], error: e.message })
        }
      })
    })
  })

  // 管理全局包（更新/卸载）
  ipcMain.handle('manage-global-package', (event, manager, action, packageName) => {
    return new Promise((resolve) => {
      const cmds = {
        npm: { update: `npm update -g ${packageName}`, uninstall: `npm uninstall -g ${packageName}` },
        pnpm: { update: `pnpm update -g ${packageName}`, uninstall: `pnpm remove -g ${packageName}` },
        yarn: { update: `yarn global upgrade ${packageName}`, uninstall: `yarn global remove ${packageName}` },
        pip: { update: `pip install --upgrade ${packageName}`, uninstall: `pip uninstall -y ${packageName}` },
        cargo: { update: `cargo install ${packageName}`, uninstall: `cargo uninstall ${packageName}` },
        conda: { update: `conda update -y ${packageName}`, uninstall: `conda remove -y ${packageName}` },
        composer: { update: `composer global update ${packageName}`, uninstall: `composer global remove ${packageName}` }
      }
      const managerCmds = cmds[manager]
      if (!managerCmds || !managerCmds[action]) {
        resolve({ success: false, output: '不支持的操作' })
        return
      }
      exec(managerCmds[action], { timeout: 120000, encoding: 'utf8' }, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, output: stderr || error.message })
        } else {
          resolve({ success: true, output: stdout || stderr || '操作完成' })
        }
      })
    })
  })

  // 检查可更新的包（返回有新版本的包名→最新版本映射）
  ipcMain.handle('check-outdated-packages', async (event, manager) => {
    const outdated = {} // { packageName: latestVersion }

    // 捕获 stdout（即使命令返回非零退出码，如 npm outdated 有更新时返回 1）
    function execCaptureStdout(command, timeout = 60000) {
      return new Promise((resolve) => {
        exec(command, { timeout, encoding: 'utf8', windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (_error, stdout) => {
          resolve((stdout || '').trim())
        })
      })
    }

    try {
      switch (manager) {
        case 'npm': {
          const output = await execCaptureStdout('npm outdated -g --json')
          if (output) {
            try {
              const data = JSON.parse(output)
              for (const [name, info] of Object.entries(data)) {
                if (info.latest) outdated[name] = info.latest
              }
            } catch {}
          }
          break
        }
        case 'pnpm': {
          const output = await execCaptureStdout('pnpm outdated -g --json')
          if (output) {
            try {
              const data = JSON.parse(output)
              for (const [name, info] of Object.entries(data)) {
                if (info.latest) outdated[name] = info.latest
              }
            } catch {}
          }
          break
        }
        case 'pip': {
          const pipCmds = [
            'pip list --outdated --format=json',
            'pip3 list --outdated --format=json',
            'py -m pip list --outdated --format=json',
            'python -m pip list --outdated --format=json',
            'python3 -m pip list --outdated --format=json',
          ]
          for (const cmd of pipCmds) {
            const output = await execCaptureStdout(cmd, 90000)
            if (output) {
              try {
                const data = JSON.parse(output)
                if (Array.isArray(data)) {
                  for (const pkg of data) {
                    if (pkg.latest_version) outdated[pkg.name] = pkg.latest_version
                  }
                  break
                }
              } catch {}
            }
          }
          break
        }
        case 'conda': {
          // conda search --outdated --json
          const output = await execCaptureStdout('conda search --outdated --json', 90000)
          if (output) {
            try {
              const data = JSON.parse(output)
              // conda search --outdated 返回 { "pkg_name": [{ version: "x.y" }, ...] }
              for (const [name, versions] of Object.entries(data)) {
                if (Array.isArray(versions) && versions.length > 0) {
                  outdated[name] = versions[versions.length - 1].version
                }
              }
            } catch {}
          }
          break
        }
        case 'composer': {
          const output = await execCaptureStdout('composer global outdated --format=json')
          if (output) {
            try {
              const data = JSON.parse(output)
              const installed = data.installed || []
              for (const pkg of installed) {
                if (pkg.latest) outdated[pkg.name] = pkg.latest
              }
            } catch {}
          }
          break
        }
        // yarn / cargo 暂无可靠的 outdated 检查方式，返回空
      }
    } catch {}

    return { success: true, outdated }
  })

  // 递归计算目录大小
  function getDirSize(dirPath) {
    let size = 0
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        try {
          if (entry.isDirectory()) {
            size += getDirSize(fullPath)
          } else {
            size += fs.statSync(fullPath).size
          }
        } catch {}
      }
    } catch {}
    return size
  }

  // 获取缓存目录路径（仅通过命令和环境变量检测，不使用硬编码路径）
  async function getCachePath(manager, scanDetails = null) {
    const userProfile = process.env.USERPROFILE || ''
    const localAppData = process.env.LOCALAPPDATA || ''
    
    try {
      switch (manager) {
        case 'npm': {
          // npm 自己知道缓存在哪里
          const cmd = 'npm config get cache'
          if (scanDetails) scanDetails.push(`  执行命令: ${cmd}`)
          const startTime = Date.now()
          const r = await execPromise(cmd, 10000)
          const duration = Date.now() - startTime
          
          if (scanDetails) {
            scanDetails.push(`  执行耗时: ${duration}ms`)
            if (r.success && r.output && r.output !== 'undefined') {
              scanDetails.push(`  命令输出: ${r.output.trim()}`)
            } else {
              scanDetails.push(`  执行失败:`)
              scanDetails.push(`    错误信息: ${r.error || '命令执行异常'}`)
              if (r.output) scanDetails.push(`    输出内容: ${r.output}`)
            }
          }
          
          if (r.success && r.output && r.output !== 'undefined') {
            const cachePath = r.output.trim()
            if (scanDetails) scanDetails.push(`  解析路径: ${cachePath}`)
            if (fs.existsSync(cachePath)) {
              const size = getDirSize(cachePath)
              if (scanDetails) scanDetails.push(`  路径验证: 存在 (大小: ${(size / 1024 / 1024).toFixed(2)} MB)`)
              return cachePath
            } else {
              if (scanDetails) scanDetails.push(`  路径验证: 不存在`)
            }
          } else {
            if (scanDetails) scanDetails.push(`  检测结果: 失败`)
          }
          return ''
        }
        case 'pnpm': {
          // pnpm store path 返回实际存储路径
          const cmd = 'pnpm store path'
          if (scanDetails) scanDetails.push(`  执行命令: ${cmd}`)
          const startTime = Date.now()
          const r = await execPromise(cmd, 10000)
          const duration = Date.now() - startTime
          
          if (scanDetails) {
            scanDetails.push(`  执行耗时: ${duration}ms`)
            if (r.success && r.output) {
              scanDetails.push(`  命令输出: ${r.output.trim()}`)
            } else {
              scanDetails.push(`  执行失败:`)
              scanDetails.push(`    错误信息: ${r.error || '命令执行异常'}`)
              if (r.output) scanDetails.push(`    输出内容: ${r.output}`)
            }
          }
          
          if (r.success && r.output) {
            const storePath = r.output.trim()
            if (scanDetails) scanDetails.push(`  解析路径: ${storePath}`)
            if (fs.existsSync(storePath)) {
              const size = getDirSize(storePath)
              if (scanDetails) scanDetails.push(`  路径验证: 存在 (大小: ${(size / 1024 / 1024).toFixed(2)} MB)`)
              return storePath
            } else {
              if (scanDetails) scanDetails.push(`  路径验证: 不存在`)
            }
          } else {
            if (scanDetails) scanDetails.push(`  检测结果: 失败`)
          }
          return ''
        }
        case 'yarn': {
          // yarn 1.x 和 yarn 2+ 都支持 cache dir
          const cmd1 = 'yarn cache dir'
          if (scanDetails) scanDetails.push(`  执行命令 (尝试1): ${cmd1}`)
          const startTime1 = Date.now()
          let r = await execPromise(cmd1, 10000)
          const duration1 = Date.now() - startTime1
          
          if (scanDetails) {
            scanDetails.push(`  执行耗时: ${duration1}ms`)
            if (r.success && r.output) {
              scanDetails.push(`  命令输出: ${r.output.trim()}`)
            } else {
              scanDetails.push(`  执行失败:`)
              scanDetails.push(`    错误信息: ${r.error || '命令执行异常'}`)
              if (r.output) scanDetails.push(`    输出内容: ${r.output}`)
            }
          }
          
          if (r.success && r.output) {
            const cachePath = r.output.trim()
            if (scanDetails) scanDetails.push(`  解析路径: ${cachePath}`)
            if (fs.existsSync(cachePath)) {
              const size = getDirSize(cachePath)
              if (scanDetails) scanDetails.push(`  路径验证: 存在 (大小: ${(size / 1024 / 1024).toFixed(2)} MB)`)
              return cachePath
            }
          }
          
          // yarn 2+ (berry) 使用不同命令
          const cmd2 = 'yarn config get cacheFolder'
          if (scanDetails) scanDetails.push(`  执行命令 (尝试2): ${cmd2}`)
          const startTime2 = Date.now()
          r = await execPromise(cmd2, 10000)
          const duration2 = Date.now() - startTime2
          
          if (scanDetails) {
            scanDetails.push(`  执行耗时: ${duration2}ms`)
            if (r.success && r.output && !r.output.includes('undefined')) {
              scanDetails.push(`  命令输出: ${r.output.trim()}`)
            } else {
              scanDetails.push(`  执行失败:`)
              scanDetails.push(`    错误信息: ${r.error || '命令执行异常'}`)
              if (r.output) scanDetails.push(`    输出内容: ${r.output}`)
            }
          }
          
          if (r.success && r.output && !r.output.includes('undefined')) {
            const cachePath = r.output.trim()
            if (scanDetails) scanDetails.push(`  解析路径: ${cachePath}`)
            if (fs.existsSync(cachePath)) {
              const size = getDirSize(cachePath)
              if (scanDetails) scanDetails.push(`  路径验证: 存在 (大小: ${(size / 1024 / 1024).toFixed(2)} MB)`)
              return cachePath
            }
          }
          
          if (scanDetails) scanDetails.push(`  检测结果: 未找到缓存目录`)
          return ''
        }
        case 'pip': {
          // 多候选命令检测 pip 缓存目录
          const cmds = [
            'pip cache dir',
            'pip3 cache dir',
            'py -m pip cache dir',
            'python -m pip cache dir',
            'python3 -m pip cache dir'
          ]
          
          for (let i = 0; i < cmds.length; i++) {
            const cmd = cmds[i]
            if (scanDetails) scanDetails.push(`  执行命令 (尝试${i + 1}/${cmds.length}): ${cmd}`)
            const startTime = Date.now()
            const r = await execPromise(cmd, 10000)
            const duration = Date.now() - startTime
            
            if (scanDetails) {
              scanDetails.push(`  执行耗时: ${duration}ms`)
              if (r.success && r.output) {
                scanDetails.push(`  命令输出: ${r.output.trim()}`)
              } else {
                scanDetails.push(`  执行失败:`)
                scanDetails.push(`    错误信息: ${r.error || '命令执行异常'}`)
                if (r.output) scanDetails.push(`    输出内容: ${r.output}`)
              }
            }
            
            if (r.success && r.output) {
              const cachePath = r.output.trim()
              if (scanDetails) scanDetails.push(`  解析路径: ${cachePath}`)
              if (fs.existsSync(cachePath)) {
                const size = getDirSize(cachePath)
                if (scanDetails) scanDetails.push(`  路径验证: 存在 (大小: ${(size / 1024 / 1024).toFixed(2)} MB)`)
                return cachePath
              } else {
                if (scanDetails) scanDetails.push(`  路径验证: 不存在`)
              }
            } else {
              if (scanDetails) scanDetails.push(`  当前命令检测失败，继续尝试下一个`)
            }
          }
          
          if (scanDetails) scanDetails.push(`  检测结果: 所有命令均失败`)
          return ''
        }
        case 'conda': {
          // conda info --json 返回 pkgs_dirs 数组
          const condaCmds = ['conda info --json', 'conda.bat info --json']
          for (const cmd of condaCmds) {
            if (scanDetails) scanDetails.push(`  命令: ${cmd}`)
            const r = await execPromise(cmd, 15000)
            if (r.success && r.output) {
              try {
                const data = JSON.parse(r.output)
                const pkgsDirs = data.pkgs_dirs || []
                if (scanDetails) scanDetails.push(`  pkgs_dirs: ${pkgsDirs.join(', ')}`)
                for (const dir of pkgsDirs) {
                  if (dir && fs.existsSync(dir)) {
                    if (scanDetails) scanDetails.push(`  结果: ${dir} 存在`)
                    return dir
                  }
                }
              } catch (e) {
                if (scanDetails) scanDetails.push(`  JSON解析失败: ${e.message}`)
              }
            }
          }
          // 尝试通过 CONDA_PREFIX 环境变量定位
          if (process.env.CONDA_PREFIX) {
            const pkgsDir = path.join(process.env.CONDA_PREFIX, 'pkgs')
            if (scanDetails) scanDetails.push(`  环境变量 CONDA_PREFIX: ${process.env.CONDA_PREFIX}`)
            if (fs.existsSync(pkgsDir)) {
              if (scanDetails) scanDetails.push(`  结果: ${pkgsDir} 存在`)
              return pkgsDir
            }
          }
          if (scanDetails) scanDetails.push(`  结果: 未找到缓存目录`)
          return ''
        }
        case 'cargo': {
          // 优先使用 CARGO_HOME 环境变量
          const cargoHome = process.env.CARGO_HOME
          if (cargoHome) {
            if (scanDetails) scanDetails.push(`  环境变量 CARGO_HOME: ${cargoHome}`)
            const registry = path.join(cargoHome, 'registry')
            if (fs.existsSync(registry)) {
              if (scanDetails) scanDetails.push(`  结果: ${registry} 存在`)
              return registry
            }
            // 整个 cargo home 也可作为缓存目录
            if (fs.existsSync(cargoHome)) {
              if (scanDetails) scanDetails.push(`  结果: ${cargoHome} 存在`)
              return cargoHome
            }
          }
          // 尝试通过 cargo 命令获取 home
          const cmd = 'cargo --version'
          if (scanDetails) scanDetails.push(`  命令: ${cmd}`)
          const r = await execPromise(cmd, 5000)
          if (r.success) {
            if (scanDetails) scanDetails.push(`  输出: ${r.output.trim()}`)
            // cargo 安装后默认在 ~/.cargo
            const defaultHome = path.join(userProfile, '.cargo')
            const registry = path.join(defaultHome, 'registry')
            if (fs.existsSync(registry)) {
              if (scanDetails) scanDetails.push(`  结果: ${registry} 存在`)
              return registry
            }
          }
          if (scanDetails) scanDetails.push(`  结果: 未找到缓存目录`)
          return ''
        }
        case 'composer': {
          // composer 自己知道缓存在哪里
          const cmd = 'composer config --global cache-dir'
          if (scanDetails) scanDetails.push(`  命令: ${cmd}`)
          const r = await execPromise(cmd, 10000)
          if (r.success && r.output) {
            const cachePath = r.output.trim()
            if (scanDetails) scanDetails.push(`  输出: ${cachePath}`)
            if (fs.existsSync(cachePath)) {
              if (scanDetails) scanDetails.push(`  结果: 路径存在`)
              return cachePath
            }
          }
          // 尝试 COMPOSER_CACHE_DIR 环境变量
          if (process.env.COMPOSER_CACHE_DIR) {
            if (scanDetails) scanDetails.push(`  环境变量 COMPOSER_CACHE_DIR: ${process.env.COMPOSER_CACHE_DIR}`)
            if (fs.existsSync(process.env.COMPOSER_CACHE_DIR)) {
              if (scanDetails) scanDetails.push(`  结果: 路径存在`)
              return process.env.COMPOSER_CACHE_DIR
            }
          }
          if (scanDetails) scanDetails.push(`  结果: 未找到缓存目录`)
          return ''
        }
        case 'gradle': {
          // 优先使用 GRADLE_USER_HOME 环境变量
          const gradleHome = process.env.GRADLE_USER_HOME
          if (gradleHome) {
            if (scanDetails) scanDetails.push(`  环境变量 GRADLE_USER_HOME: ${gradleHome}`)
            const caches = path.join(gradleHome, 'caches')
            if (fs.existsSync(caches)) {
              if (scanDetails) scanDetails.push(`  结果: ${caches} 存在`)
              return caches
            }
          }
          // 检测 gradle 是否安装，如果安装则检查默认目录
          const cmd = 'gradle --version'
          if (scanDetails) scanDetails.push(`  命令: ${cmd}`)
          const r = await execPromise(cmd, 10000)
          if (r.success) {
            if (scanDetails) scanDetails.push(`  输出: ${r.output.substring(0, 100)}...`)
            const defaultCaches = path.join(userProfile, '.gradle', 'caches')
            if (fs.existsSync(defaultCaches)) {
              if (scanDetails) scanDetails.push(`  结果: ${defaultCaches} 存在`)
              return defaultCaches
            }
          }
          if (scanDetails) scanDetails.push(`  结果: 未找到缓存目录`)
          return ''
        }
        case 'maven': {
          // 优先使用 mvn 命令获取实际配置的本地仓库路径
          const cmd = 'mvn help:evaluate -Dexpression=settings.localRepository -q -DforceStdout'
          if (scanDetails) scanDetails.push(`  命令: ${cmd}`)
          const r = await execPromise(cmd, 30000)
          if (r.success && r.output) {
            const repoPath = r.output.trim()
            if (scanDetails) scanDetails.push(`  输出: ${repoPath}`)
            if (repoPath && !repoPath.startsWith('$') && fs.existsSync(repoPath)) {
              if (scanDetails) scanDetails.push(`  结果: 路径存在`)
              return repoPath
            }
          }
          // 尝试 M2_HOME 或 MAVEN_HOME 环境变量
          const mavenHome = process.env.M2_HOME || process.env.MAVEN_HOME
          if (mavenHome) {
            if (scanDetails) scanDetails.push(`  环境变量 M2_HOME/MAVEN_HOME: ${mavenHome}`)
            // maven 安装存在，检查默认仓库位置
            const defaultRepo = path.join(userProfile, '.m2', 'repository')
            if (fs.existsSync(defaultRepo)) {
              if (scanDetails) scanDetails.push(`  结果: ${defaultRepo} 存在`)
              return defaultRepo
            }
          }
          // 检测 mvn 是否可用
          const versionCmd = 'mvn --version'
          if (scanDetails) scanDetails.push(`  命令: ${versionCmd}`)
          const versionCheck = await execPromise(versionCmd, 10000)
          if (versionCheck.success) {
            if (scanDetails) scanDetails.push(`  mvn 可用`)
            const defaultRepo = path.join(userProfile, '.m2', 'repository')
            if (fs.existsSync(defaultRepo)) {
              if (scanDetails) scanDetails.push(`  结果: ${defaultRepo} 存在`)
              return defaultRepo
            }
          }
          if (scanDetails) scanDetails.push(`  结果: 未找到缓存目录`)
          return ''
        }
        case 'nuget': {
          // dotnet nuget locals 命令列出所有缓存位置
          const cmd = 'dotnet nuget locals all --list'
          if (scanDetails) scanDetails.push(`  命令: ${cmd}`)
          const r = await execPromise(cmd, 15000)
          if (r.success && r.output) {
            if (scanDetails) scanDetails.push(`  输出: ${r.output.trim()}`)
            // 优先返回 global-packages（最大的缓存）
            const globalMatch = r.output.match(/global-packages:\s*(.+)/i)
            if (globalMatch) {
              const globalPath = globalMatch[1].trim()
              if (fs.existsSync(globalPath)) {
                if (scanDetails) scanDetails.push(`  结果: ${globalPath} 存在`)
                return globalPath
              }
            }
            // 其次返回 http-cache
            const httpMatch = r.output.match(/http-cache:\s*(.+)/i)
            if (httpMatch) {
              const httpPath = httpMatch[1].trim()
              if (fs.existsSync(httpPath)) {
                if (scanDetails) scanDetails.push(`  结果: ${httpPath} 存在`)
                return httpPath
              }
            }
          }
          // 尝试 NUGET_PACKAGES 环境变量
          if (process.env.NUGET_PACKAGES) {
            if (scanDetails) scanDetails.push(`  环境变量 NUGET_PACKAGES: ${process.env.NUGET_PACKAGES}`)
            if (fs.existsSync(process.env.NUGET_PACKAGES)) {
              if (scanDetails) scanDetails.push(`  结果: 路径存在`)
              return process.env.NUGET_PACKAGES
            }
          }
          if (scanDetails) scanDetails.push(`  结果: 未找到缓存目录`)
          return ''
        }
      }
    } catch (e) {
      if (scanDetails) scanDetails.push(`  异常: ${e.message}`)
    }
    return ''
  }

  // 扫描所有包管理器的缓存信息
  ipcMain.handle('scan-package-caches', async () => {
    const managers = ['npm', 'pnpm', 'yarn', 'pip', 'conda', 'cargo', 'composer', 'gradle', 'maven', 'nuget']
    const results = []
    const scanDetails = []

    addLog('info', 'cache', '开始扫描包缓存', `扫描目标: ${managers.join(', ')}`)
    scanDetails.push('=== 包缓存扫描详细过程 ===')

    const totalStartTime = Date.now()
    
    await Promise.all(managers.map(async (mgr) => {
      const mgrStartTime = Date.now()
      scanDetails.push(`\n[${mgr.toUpperCase()}] 开始检测缓存目录`)
      
      try {
        const cachePath = await getCachePath(mgr, scanDetails)
        const mgrDuration = Date.now() - mgrStartTime
        
        if (cachePath && fs.existsSync(cachePath)) {
          const size = getDirSize(cachePath)
          results.push({ manager: mgr, path: cachePath, size, available: true })
          scanDetails.push(`[${mgr.toUpperCase()}] 检测完成: 成功 (耗时: ${mgrDuration}ms)`)
          scanDetails.push(`  缓存路径: ${cachePath}`)
          scanDetails.push(`  缓存大小: ${(size / 1024 / 1024).toFixed(2)} MB`)
        } else {
          results.push({ manager: mgr, path: '', size: 0, available: false })
          scanDetails.push(`[${mgr.toUpperCase()}] 检测完成: 未找到 (耗时: ${mgrDuration}ms)`)
        }
      } catch (e) {
        const mgrDuration = Date.now() - mgrStartTime
        results.push({ manager: mgr, path: '', size: 0, available: false })
        scanDetails.push(`[${mgr.toUpperCase()}] 检测完成: 异常 (耗时: ${mgrDuration}ms)`)
        scanDetails.push(`  错误信息: ${e.message}`)
      }
    }))

    const totalDuration = Date.now() - totalStartTime
    const availableCount = results.filter(r => r.available).length
    
    scanDetails.push(`\n=== 扫描完成 ===`)
    scanDetails.push(`总耗时: ${totalDuration}ms`)
    scanDetails.push(`成功检测: ${availableCount}/${managers.length} 个包管理器`)
    
    addLog('info', 'cache', `包缓存扫描完成: 找到 ${availableCount}/${managers.length} 个`, scanDetails.join('\n'))

    return { success: true, caches: results }
  })

  // 清理指定包管理器的缓存
  ipcMain.handle('clean-package-cache', async (event, manager) => {
    const cleanCmds = {
      npm: 'npm cache clean --force',
      pnpm: 'pnpm store prune',
      yarn: 'yarn cache clean',
      pip: null, // 需要多候选
      conda: 'conda clean --all -y',
      composer: 'composer clear-cache',
      nuget: 'dotnet nuget locals all --clear',
    }

    try {
      // pip 多候选
      if (manager === 'pip') {
        const cmds = ['pip cache purge', 'pip3 cache purge', 'python -m pip cache purge']
        for (const cmd of cmds) {
          const r = await execPromise(cmd, 30000)
          if (r.success) return { success: true, output: r.output || '缓存已清理' }
        }
        return { success: false, output: 'pip cache purge 失败' }
      }

      // cargo / gradle / maven 无内置清理命令，手动删除目录内容
      if (manager === 'cargo' || manager === 'gradle' || manager === 'maven') {
        const cachePath = await getCachePath(manager)
        if (cachePath && fs.existsSync(cachePath)) {
          const entries = fs.readdirSync(cachePath)
          for (const entry of entries) {
            const fullPath = path.join(cachePath, entry)
            try {
              fs.rmSync(fullPath, { recursive: true, force: true })
            } catch {}
          }
          return { success: true, output: `已清理 ${cachePath}` }
        }
        return { success: false, output: '缓存目录不存在' }
      }

      const cmd = cleanCmds[manager]
      if (!cmd) return { success: false, output: '不支持的包管理器' }

      return new Promise((resolve) => {
        exec(cmd, { timeout: 60000, encoding: 'utf8', windowsHide: true }, (error, stdout, stderr) => {
          if (error) {
            resolve({ success: false, output: stderr || error.message })
          } else {
            resolve({ success: true, output: stdout || stderr || '缓存已清理' })
          }
        })
      })
    } catch (e) {
      return { success: false, output: e.message }
    }
  })
}