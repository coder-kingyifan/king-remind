import {app, BrowserWindow, Menu, nativeImage, Tray} from 'electron'
import {join} from 'path'
import {is} from '@electron-toolkit/utils'
import {settingsDb} from './db/settings'

let tray: Tray | null = null

function createTrayIcon(): nativeImage {
    const iconPath = is.dev
        ? join(__dirname, '../../resources/icon.png')
        : join(process.resourcesPath, 'resources/build/icons/win/icon.ico')
    return nativeImage.createFromPath(iconPath).resize({width: 16, height: 16})
}

export function createTray(mainWindow: BrowserWindow | null): Tray {
    const icon = createTrayIcon()
    tray = new Tray(icon)

    const alwaysOnTopSaved = settingsDb.get('always_on_top') === 'true'

    const contextMenu = Menu.buildFromTemplate([
        ...(mainWindow ? [
            {
                label: '打开 king提醒助手',
                click: () => {
                    mainWindow!.show()
                    mainWindow!.focus()
                }
            },
            {type: 'separator' as const},
            {
                label: '暂停所有提醒',
                type: 'checkbox' as const,
                checked: false,
                click: (menuItem: Electron.MenuItem) => {
                    mainWindow!.webContents.send('scheduler:toggle-pause', menuItem.checked)
                }
            },
            {
                label: '置顶窗口',
                type: 'checkbox' as const,
                checked: alwaysOnTopSaved,
                click: (menuItem: Electron.MenuItem) => {
                    mainWindow!.setAlwaysOnTop(menuItem.checked)
                    settingsDb.set('always_on_top', String(menuItem.checked))
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

export function destroyTray(): void {
    if (tray) {
        tray.destroy()
        tray = null
    }
}
