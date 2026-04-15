import {BrowserWindow, screen, dialog, BrowserWindowConstructorOptions} from 'electron'
import {join} from 'path'
import {readFileSync, existsSync} from 'fs'
import {is} from '@electron-toolkit/utils'
import {settingsDb} from '../db/settings'

interface FloatNotification {
    window: BrowserWindow
    timer: NodeJS.Timeout | null
}

const NOTIFICATION_WIDTH = 360
const NOTIFICATION_HEIGHT = 140
const NOTIFICATION_GAP = 0

// 缓存提示音的 base64 数据
let notificationSoundBase64: string | null = null
// 缓存自定义提示音路径对应的 base64
let customSoundBase64: string | null = null
let customSoundPath: string | null = null

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

function getCustomSoundBase64(): string {
    const filePath = settingsDb.get('notification_sound_file') || ''
    if (!filePath) return ''
    // 路径没变，用缓存
    if (filePath === customSoundPath && customSoundBase64 !== null) return customSoundBase64
    try {
        if (!existsSync(filePath)) {
            customSoundBase64 = ''
            customSoundPath = filePath
            return ''
        }
        const buf = readFileSync(filePath)
        customSoundBase64 = buf.toString('base64')
        customSoundPath = filePath
    } catch {
        customSoundBase64 = ''
        customSoundPath = filePath
    }
    return customSoundBase64
}

function playNotificationSound(): void {
    // 读取提示音配置：on / off / system / custom
    const soundSetting = settingsDb.get('notification_sound') || 'on'
    if (soundSetting === 'off') return

    // system 模式使用系统通知声
    if (soundSetting === 'system') {
        try {
            const {Notification} = require('electron')
            const sysNotif = new Notification({silent: false, title: '', body: ''})
            sysNotif.close()
        } catch { /* fallback to built-in */
        }
        return
    }

    // custom 模式：播放用户自定义音效文件
    if (soundSetting === 'custom') {
        const base64 = getCustomSoundBase64()
        if (!base64) return
        const filePath = settingsDb.get('notification_sound_file') || ''
        const mimeType = getMimeType(filePath)
        playBase64Sound(base64, mimeType)
        return
    }

    // on 模式：播放内置音效
    const base64 = getNotificationSoundBase64()
    if (!base64) return
    playBase64Sound(base64)
}

function playBase64Sound(base64: string, mimeType: string = 'audio/wav'): void {
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
  <source src="data:${mimeType};base64,${base64}" type="${mimeType}">
</audio>
<script>setTimeout(()=>window.close(),5000)</script>
</body></html>`

    soundWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    soundWin.on('closed', () => {
    })
}

/** 根据文件扩展名推断 MIME 类型 */
function getMimeType(filePath: string): string {
    const ext = filePath.toLowerCase().split('.').pop()
    switch (ext) {
        case 'mp3': return 'audio/mpeg'
        case 'ogg': return 'audio/ogg'
        case 'flac': return 'audio/flac'
        default: return 'audio/wav'
    }
}

/** 打开文件选择对话框，选择自定义提示音文件 */
export async function selectNotificationSoundFile(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
        title: '选择提示音文件',
        filters: [
            {name: '音频文件', extensions: ['wav', 'mp3', 'ogg', 'flac']},
            {name: '所有文件', extensions: ['*']}
        ],
        properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    settingsDb.set('notification_sound_file', filePath)
    // 清除缓存，下次播放时重新读取
    customSoundBase64 = null
    customSoundPath = null
    return filePath
}

/** 试听当前提示音设置 */
export function previewNotificationSound(): void {
    playNotificationSound()
}

/** 获取通知关闭时长（毫秒），0 表示不自动关闭 */
function getNotificationDuration(): number {
    const val = settingsDb.get('notification_duration') || '5000'
    return parseInt(val, 10)
}

// 当前显示的浮窗列表
const activeNotifications: FloatNotification[] = []

function getNotificationHTML(data: { title: string; body: string; icon: string; color: string; duration: number }): string {
    const {title, body, icon, color, duration} = data
    // 转义 HTML
    const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

    // duration > 0 时显示进度条，duration === 0 时不显示（手动关闭）
    const progressHtml = duration > 0 ? `
    <div class="progress"><div class="progress-bar"></div></div>` : ''

    const progressStyle = duration > 0 ? `
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
    animation: countdown ${duration}ms linear forwards;
  }
  @keyframes countdown {
    from { width: 100%; }
    to { width: 0%; }
  }` : ''

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
    border-radius: 10px;
    padding: 18px 20px;
    display: flex;
    gap: 14px;
    align-items: flex-start;
    animation: slideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1);
    border: 1px solid rgba(0,0,0,0.08);
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
  ${progressStyle}
  @media (prefers-color-scheme: dark) {
    .card {
      background: #2c2c2e;
      border-color: rgba(255,255,255,0.1);
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
    ${progressHtml}
  </div>
</body>
</html>`
}

function cleanupClosed(): void {
    for (let i = activeNotifications.length - 1; i >= 0; i--) {
        if (activeNotifications[i].window.isDestroyed()) {
            if (activeNotifications[i].timer) clearTimeout(activeNotifications[i].timer)
            activeNotifications.splice(i, 1)
        }
    }
}

function repositionAll(): void {
    cleanupClosed()
    const display = screen.getPrimaryDisplay()
    const {width: screenW, height: screenH} = display.workArea

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
            if (oldest.timer) clearTimeout(oldest.timer)
            oldest.window.close()
        }
    }

    const display = screen.getPrimaryDisplay()
    const {width: screenW, height: screenH} = display.workArea

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
    win.setVisibleOnAllWorkspaces(true, {visibleOnFullScreen: true})

    const html = getNotificationHTML({
        title: data.title,
        body: data.body,
        icon: data.icon || '🔔',
        color: data.color || '#409EFF',
        duration: getNotificationDuration()
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

    // 自动关闭（duration > 0 时自动关闭，0 时不自动关闭需手动关闭）
    const duration = getNotificationDuration()
    let timer: NodeJS.Timeout | null = null
    if (duration > 0) {
        timer = setTimeout(() => {
            if (!win.isDestroyed()) {
                win.close()
            }
            repositionAll()
        }, duration)
    }

    win.on('closed', () => {
        repositionAll()
    })

    const notif: FloatNotification = {window: win, timer}
    activeNotifications.push(notif)
    repositionAll()
}

export function closeAllNotifications(): void {
    for (const notif of activeNotifications) {
        if (notif.timer) clearTimeout(notif.timer)
        if (!notif.window.isDestroyed()) {
            notif.window.close()
        }
    }
    activeNotifications.length = 0
}
