import { BrowserWindow } from 'electron'
import { NotificationChannel, NotificationMessage } from './types'
import { showFloatNotification } from './notification-window'
import { notificationConfigsDb } from '../db/notification-configs'

export class DesktopNotifier implements NotificationChannel {
  private mainWindow: BrowserWindow | null

  constructor(mainWindow: BrowserWindow | null) {
    this.mainWindow = mainWindow
  }

  async send(message: NotificationMessage): Promise<void> {
    // 读取通知配置
    const config = notificationConfigsDb.getChannelConfig('desktop')
    const duration = config?.duration || 6000

    // 显示桌面浮窗通知
    showFloatNotification({
      title: message.title,
      body: message.body,
      icon: message.icon,
      color: message.color,
      onClick: () => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.show()
          this.mainWindow.focus()
        }
      }
    })

    // 同时通知渲染进程显示应用内提醒（如果窗口可见）
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('notification:show', {
        title: message.title,
        body: message.body,
        icon: message.icon,
        reminderId: message.reminderId
      })
    }
  }
}
