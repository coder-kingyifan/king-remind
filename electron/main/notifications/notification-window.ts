import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import { is } from '@electron-toolkit/utils'

interface FloatNotification {
  window: BrowserWindow
  timer: NodeJS.Timeout
}

const NOTIFICATION_WIDTH = 360
const NOTIFICATION_HEIGHT = 140
const NOTIFICATION_GAP = 0
const NOTIFICATION_DURATION = 6000

// 缓存提示音的 base64 数据
let notificationSoundBase64: string | null = null

function getNotificationSoundBase64(): string {
  if (notificationSoundBase64) return notificationSoundBase64
  try {
    const soundPath = is.dev
      ? join(__dirname, '../../resources/notification.wav')
      : join(process.resourcesPath, 'resources/notification.wav')
    const buf = readFileSync(soundPath)
    notificationSoundBase64 = buf.toString('base64')
  } catch {
    notificationSoundBase64 = ''
  }
  return notificationSoundBase64
}

function playNotificationSound(): void {
  const base64 = getNotificationSoundBase64()
  if (!base64) return

  const soundWin = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const html = `<!DOCTYPE html><html><body>
<audio autoplay onended="window.close()">
  <source src="data:audio/wav;base64,${base64}" type="audio/wav">
</audio>
<script>setTimeout(()=>window.close(),3000)</script>
</body></html>`

  soundWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  soundWin.on('closed', () => {})
}

// 当前显示的浮窗列表
const activeNotifications: FloatNotification[] = []

function getNotificationHTML(data: { title: string; body: string; icon: string; color: string }): string {
  const { title, body, icon, color } = data
  // 转义 HTML
  const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Microsoft YaHei', 'Segoe UI', sans-serif;
    background: transparent;
    overflow: hidden;
    -webkit-app-region: drag;
    cursor: default;
    user-select: none;
  }
  .card {
    width: ${NOTIFICATION_WIDTH}px;
    background: #ffffff;
    border-radius: 14px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08);
    padding: 18px 20px;
    display: flex;
    gap: 14px;
    align-items: flex-start;
    animation: slideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1);
    border: 1px solid rgba(0,0,0,0.06);
    position: relative;
  }
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  .icon-wrap {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
    background: ${color}18;
  }
  .content {
    flex: 1;
    min-width: 0;
    padding-top: 2px;
  }
  .app-label {
    font-size: 11px;
    color: #909399;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .app-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${color};
  }
  .title {
    font-size: 15px;
    font-weight: 600;
    color: #1d1d1f;
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .body {
    font-size: 13px;
    color: #6e6e73;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .close-btn {
    position: absolute;
    top: 10px;
    right: 12px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: none;
    background: rgba(0,0,0,0.06);
    color: #909399;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-app-region: no-drag;
    transition: background 0.15s;
    line-height: 1;
  }
  .close-btn:hover {
    background: rgba(0,0,0,0.12);
    color: #606266;
  }
  .progress {
    position: absolute;
    bottom: 0;
    left: 20px;
    right: 20px;
    height: 3px;
    border-radius: 2px;
    background: rgba(0,0,0,0.04);
    overflow: hidden;
  }
  .progress-bar {
    height: 100%;
    background: ${color};
    border-radius: 2px;
    animation: countdown ${NOTIFICATION_DURATION}ms linear forwards;
  }
  @keyframes countdown {
    from { width: 100%; }
    to { width: 0%; }
  }
  @media (prefers-color-scheme: dark) {
    .card {
      background: #2c2c2e;
      border-color: rgba(255,255,255,0.08);
      box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2);
    }
    .title { color: #f5f5f7; }
    .body { color: #a1a1a6; }
    .app-label { color: #8e8e93; }
    .close-btn { background: rgba(255,255,255,0.1); color: #8e8e93; }
    .close-btn:hover { background: rgba(255,255,255,0.18); color: #c7c7cc; }
    .progress { background: rgba(255,255,255,0.06); }
    .icon-wrap { background: ${color}28; }
  }
</style>
</head>
<body>
  <div class="card">
    <div class="icon-wrap">${escHtml(icon)}</div>
    <div class="content">
      <div class="app-label"><span class="app-dot"></span> king提醒助手</div>
      <div class="title">${escHtml(title)}</div>
      <div class="body">${escHtml(body)}</div>
    </div>
    <button class="close-btn" onclick="window.close()">✕</button>
    <div class="progress"><div class="progress-bar"></div></div>
  </div>
</body>
</html>`
}

function cleanupClosed(): void {
  for (let i = activeNotifications.length - 1; i >= 0; i--) {
    if (activeNotifications[i].window.isDestroyed()) {
      clearTimeout(activeNotifications[i].timer)
      activeNotifications.splice(i, 1)
    }
  }
}

function repositionAll(): void {
  cleanupClosed()
  const display = screen.getPrimaryDisplay()
  const { width: screenW, height: screenH } = display.workArea

  let offsetY = NOTIFICATION_GAP
  for (const notif of activeNotifications) {
    if (notif.window.isDestroyed()) continue
    const x = screenW - NOTIFICATION_WIDTH - NOTIFICATION_GAP
    const y = screenH - NOTIFICATION_HEIGHT - offsetY
    notif.window.setPosition(Math.round(x), Math.round(y), false)
    offsetY += NOTIFICATION_HEIGHT + NOTIFICATION_GAP
  }
}

export function showFloatNotification(data: {
  title: string
  body: string
  icon?: string
  color?: string
  onClick?: () => void
}): void {
  cleanupClosed()

  // 最多同时显示 3 个浮窗
  if (activeNotifications.length >= 3) {
    const oldest = activeNotifications.shift()
    if (oldest && !oldest.window.isDestroyed()) {
      clearTimeout(oldest.timer)
      oldest.window.close()
    }
  }

  const display = screen.getPrimaryDisplay()
  const { width: screenW, height: screenH } = display.workArea

  const win = new BrowserWindow({
    width: NOTIFICATION_WIDTH,
    height: NOTIFICATION_HEIGHT,
    x: screenW - NOTIFICATION_WIDTH - NOTIFICATION_GAP,
    y: screenH - NOTIFICATION_HEIGHT - NOTIFICATION_GAP,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 禁止拖拽改变位置后恢复原位
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const html = getNotificationHTML({
    title: data.title,
    body: data.body,
    icon: data.icon || '🔔',
    color: data.color || '#409EFF'
  })

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

  win.once('ready-to-show', () => {
    win.showInactive()
    playNotificationSound()
  })

  // 点击通知 → 回调
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'mouseDown') {
      data.onClick?.()
    }
  })

  // 自动关闭
  const timer = setTimeout(() => {
    if (!win.isDestroyed()) {
      win.close()
    }
    repositionAll()
  }, NOTIFICATION_DURATION)

  win.on('closed', () => {
    repositionAll()
  })

  const notif: FloatNotification = { window: win, timer }
  activeNotifications.push(notif)
  repositionAll()
}

export function closeAllNotifications(): void {
  for (const notif of activeNotifications) {
    clearTimeout(notif.timer)
    if (!notif.window.isDestroyed()) {
      notif.window.close()
    }
  }
  activeNotifications.length = 0
}
