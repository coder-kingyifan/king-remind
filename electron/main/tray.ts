import {app, BrowserWindow, Menu, nativeImage, Tray} from 'electron'
import {join} from 'path'
import {is} from '@electron-toolkit/utils'
import {settingsDb} from './db/settings'

let tray: Tray | null = null
let mainWindowRef: BrowserWindow | null = null

function createTrayIcon(): nativeImage {
    const iconPath = is.dev
        ? join(__dirname, '../../resources/icon.png')
        : join(process.resourcesPath, 'resources/icon.png')
    return nativeImage.createFromPath(iconPath).resize({width: 32, height: 32})
}

function buildContextMenu(): Menu {
    const alwaysOnTopSaved = settingsDb.get('always_on_top') === 'true'

    return Menu.buildFromTemplate([
        ...(mainWindowRef ? [
            {
                label: '打开 king提醒助手',
                click: () => {
                    mainWindowRef!.show()
                    mainWindowRef!.focus()
                }
            },
            {type: 'separator' as const},
            {
                label: '暂停所有提醒',
                type: 'checkbox' as const,
                checked: false,
                click: (menuItem: Electron.MenuItem) => {
                    mainWindowRef!.webContents.send('scheduler:toggle-pause', menuItem.checked)
                }
            },
            {
                label: '置顶窗口',
                type: 'checkbox' as const,
                checked: alwaysOnTopSaved,
                click: (menuItem: Electron.MenuItem) => {
                    mainWindowRef!.setAlwaysOnTop(menuItem.checked)
                    settingsDb.set('always_on_top', String(menuItem.checked))
                    // 通知渲染进程同步置顶按钮状态
                    if (!mainWindowRef!.isDestroyed()) {
                        mainWindowRef!.webContents.send('window:always-on-top-changed', menuItem.checked)
                    }
                }
            },
            {type: 'separator' as const},
        ] : []),
        {
            label: '退出',
            click: () => {
                (app as any).isQuitting = true
                app.quit()
            }
        }
    ])
}

export function createTray(mainWindow: BrowserWindow | null): Tray {
    mainWindowRef = mainWindow
    const icon = createTrayIcon()
    tray = new Tray(icon)

    const contextMenu = buildContextMenu()
    tray.setToolTip('king提醒助手')
    tray.setContextMenu(contextMenu)

    tray.on('click', () => {
        if (!mainWindow) return
        if (mainWindow.isVisible()) {
            mainWindow.focus()
        } else {
            mainWindow.show()
        }
    })

    return tray
}

/** 更新托盘菜单中"置顶窗口"的勾选状态 */
export function updateTrayAlwaysOnTop(checked: boolean): void {
    if (!tray) return
    settingsDb.set('always_on_top', String(checked))
    const contextMenu = buildContextMenu()
    tray.setContextMenu(contextMenu)
}

export function destroyTray(): void {
    if (tray) {
        tray.destroy()
        tray = null
    }
}
