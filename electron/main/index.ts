import {app, BrowserWindow, shell} from 'electron'
import {join} from 'path'
import {is} from '@electron-toolkit/utils'
import {closeDatabase, initDatabase} from './db/connection'
import {runMigrations} from './db/migrations'
import {createTray, destroyTray} from './tray'
import {registerIpcHandlers} from './ipc-handlers'
import {NotificationDispatcher} from './notifications/dispatcher'
import {ReminderScheduler} from './scheduler'
import {settingsDb} from './db/settings'
import {closeAllNotifications} from './notifications/notification-window'
import {startApiServer, stopApiServer} from './api-server'
import {seedBuiltinSkills} from './db/skills'
import {execSync} from 'child_process'

// Windows 控制台中文乱码修复
try {
    execSync('chcp 65001', {stdio: 'ignore'})
} catch { /* ignore */
}

const isHeadless = process.argv.includes('--headless')

let mainWindow: BrowserWindow | null = null
let scheduler: ReminderScheduler | null = null

function createWindow(): BrowserWindow {
    mainWindow = new BrowserWindow({
        width: 960,
        height: 680,
        resizable: false,
        maximizable: false,
        show: false,
        frame: false,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#00000000',
            symbolColor: '#909399',
            height: 40
        },
        icon: is.dev
            ? join(__dirname, '../../resources/icon.png')
            : join(process.resourcesPath, 'resources/icon.png'),
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow?.show()
    })

    // F12 打开开发者工具
    mainWindow.webContents.on('before-input-event', (_event, input) => {
        if (input.key === 'F12' && input.type === 'keyDown') {
            mainWindow?.webContents.toggleDevTools()
        }
    })

    mainWindow.on('close', (event) => {
        if (!(app as any).isQuitting) {
            event.preventDefault()
            mainWindow?.hide()
        }
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return {action: 'deny'}
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    return mainWindow
}

// 确保单实例
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
    app.quit()
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.show()
            mainWindow.focus()
        }
    })

    app.whenReady().then(async () => {
        app.setAppUserModelId('com.kingyifan.king-remind')

        try {
            // 初始化数据库（异步）
            console.log('[主进程] 正在初始化数据库...')
            await initDatabase()
            console.log('[主进程] 数据库初始化成功')

            console.log('[主进程] 正在运行数据库迁移...')
            runMigrations()
            console.log('[主进程] 数据库迁移完成')

            // 初始化内置技能
            seedBuiltinSkills()
            console.log('[主进程] 内置技能初始化完成')

            // 创建主窗口（headless 模式下跳过）
            let win: BrowserWindow | null = null
            if (!isHeadless) {
                win = createWindow()
            } else {
                console.log('[主进程] headless 模式，跳过创建主窗口')
            }

            // 创建系统托盘
            createTray(win)

            // 创建通知分发器
            const dispatcher = new NotificationDispatcher(win)

            // 注册IPC处理器（headless 模式下跳过，无渲染进程）
            if (win) {
                registerIpcHandlers(win, dispatcher, scheduler)
                console.log('[主进程] IPC处理器已注册')
            }

            // 启动提醒调度器
            const intervalStr = settingsDb.get('scheduler_interval') || '60'
            const intervalMs = parseInt(intervalStr) * 1000
            scheduler = new ReminderScheduler(dispatcher)
            scheduler.start(intervalMs)

            // 启动本地 API Server（仅当用户启用时）
            const apiEnabled = settingsDb.get('api_enabled')
            if (apiEnabled === 'true') {
                startApiServer(scheduler)
            } else {
                console.log('[主进程] API 接口未启用，跳过启动')
            }

            // 应用启动项设置
            const launchAtStartup = settingsDb.get('launch_at_startup')
            if (launchAtStartup === 'true') {
                app.setLoginItemSettings({openAtLogin: true})
            }
            console.log('[主进程] 启动完成')
        } catch (error: any) {
            console.error('[主进程] 启动失败:', error.message, error.stack)
        }
    })

    app.on('window-all-closed', () => {
        // 保持托盘运行
    })

    app.on('before-quit', () => {
        (app as any).isQuitting = true
        if (scheduler) scheduler.stop()
        stopApiServer()
        closeAllNotifications()
        destroyTray()
        closeDatabase()
    })
}
