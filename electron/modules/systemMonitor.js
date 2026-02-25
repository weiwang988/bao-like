const { ipcMain, shell } = require('electron')
const { exec, execFile } = require('child_process')
const fs = require('fs')

// 导出系统监控模块
module.exports = function setupSystemMonitor(logger) {
  const { addLog } = logger

  // 获取进程列表
  ipcMain.handle('list-processes', () => {
    return new Promise((resolve) => {
      const script = `
Get-Process | Select-Object Id, ProcessName, PrivateMemorySize64, Path | ForEach-Object {
  $status = "Running"
  try {
    $proc = Get-Process -Id $_.Id -ErrorAction SilentlyContinue
    if ($proc -and -not $proc.Responding) { $status = "Not Responding" }
  } catch {}
  [PSCustomObject]@{
    PID = $_.Id
    Name = $_.ProcessName
    Memory = $_.PrivateMemorySize64
    CPU = 0
    Status = $status
    Path = if ($_.Path) { $_.Path } else { "" }
  }
} | ConvertTo-Json -Compress
`
      execFile('powershell.exe', ['-NoProfile', '-Command', script], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
        if (error) {
          resolve({ success: false, processes: [] })
        } else {
          try {
            let data = JSON.parse(stdout)
            if (!Array.isArray(data)) {
              data = [data]
            }
            const processes = data.map(p => ({
              pid: p.PID,
              name: p.Name,
              memory: p.Memory || 0,
              cpu: p.CPU || 0,
              status: p.Status,
              path: p.Path || ''
            }))
            resolve({ success: true, processes })
          } catch {
            resolve({ success: false, processes: [] })
          }
        }
      })
    })
  })

  // 获取端口列表
  ipcMain.handle('list-ports', () => {
    return new Promise((resolve) => {
      const script = `
      $connections = Get-NetTCPConnection | ForEach-Object {
        $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        [PSCustomObject]@{
          Protocol = "TCP"
          LocalAddress = $_.LocalAddress
          LocalPort = $_.LocalPort
          RemoteAddress = $_.RemoteAddress
          RemotePort = $_.RemotePort
          State = $_.State.ToString()
          PID = $_.OwningProcess
          ProcessName = if ($proc) { $proc.ProcessName } else { "-" }
        }
      }
      $udp = Get-NetUDPEndpoint | ForEach-Object {
        $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        [PSCustomObject]@{
          Protocol = "UDP"
          LocalAddress = $_.LocalAddress
          LocalPort = $_.LocalPort
          RemoteAddress = "*"
          RemotePort = $null
          State = ""
          PID = $_.OwningProcess
          ProcessName = if ($proc) { $proc.ProcessName } else { "-" }
        }
      }
      $all = @($connections) + @($udp)
      $all | ConvertTo-Json -Compress
    `
      execFile('powershell.exe', ['-NoProfile', '-Command', script], { timeout: 30000 }, (error, stdout) => {
        if (error) {
          resolve({ success: false, ports: [] })
        } else {
          try {
            let data = JSON.parse(stdout)
            if (!Array.isArray(data)) {
              data = [data]
            }
            const ports = data.map(p => ({
              protocol: p.Protocol,
              localAddress: p.LocalAddress,
              localPort: p.LocalPort,
              remoteAddress: p.RemoteAddress,
              remotePort: p.RemotePort,
              state: p.State,
              pid: p.PID,
              processName: p.ProcessName || '-'
            }))
            resolve({ success: true, ports })
          } catch {
            resolve({ success: false, ports: [] })
          }
        }
      })
    })
  })

  // 结束进程
  ipcMain.handle('kill-process', (event, pid) => {
    return new Promise((resolve) => {
      exec(`taskkill /F /PID ${pid}`, { timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: stderr || error.message })
        } else {
          resolve({ success: true })
        }
      })
    })
  })

  // 打开文件所在文件夹
  ipcMain.handle('show-item-in-folder', (event, filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath)
      return { success: true }
    }
    return { success: false, error: '文件不存在' }
  })

  // 获取 PATH 环境变量
  ipcMain.handle('get-path-variables', () => {
    return new Promise((resolve) => {
      try {
        // 获取系统 PATH 和用户 PATH
        const systemPath = process.env.PATH || ''
        const paths = systemPath.split(';').filter(p => p.trim())
        
        // 检查每个路径
        const seen = new Set()
        const results = paths.map((pathStr, index) => {
          const trimmedPath = pathStr.trim()
          let exists = false
          let problem = ''
          
          // 检查路径是否存在
          try {
            exists = fs.existsSync(trimmedPath)
          } catch {
            exists = false
          }
          
          // 检查问题
          if (!exists) {
            problem = '路径不存在'
          } else if (seen.has(trimmedPath.toLowerCase())) {
            problem = '重复路径'
          } else if (trimmedPath.includes(' ') && !trimmedPath.startsWith('"')) {
            // 包含空格但没有引号可能导致问题
            // 实际上 Windows PATH 不需要引号，这里不报问题
          }
          
          seen.add(trimmedPath.toLowerCase())
          
          return {
            path: trimmedPath,
            exists,
            problem
          }
        })
        
        resolve({ success: true, paths: results })
      } catch (error) {
        resolve({ success: false, paths: [] })
      }
    })
  })
}