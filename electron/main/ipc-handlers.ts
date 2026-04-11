import { ipcMain, nativeTheme, BrowserWindow, app, dialog } from 'electron'
import { readFileSync } from 'fs'
import { remindersDb } from './db/reminders'
import { notificationConfigsDb } from './db/notification-configs'
import { settingsDb } from './db/settings'
import { reminderLogsDb } from './db/reminder-logs'
import { workdaysDb } from './db/workdays'
import { NotificationDispatcher } from './notifications/dispatcher'
import { getSolarDateFromLunar } from 'chinese-days'
import { chatWithLLM, PROVIDERS, testModelConnection } from './llm'
import { chatHistoryDb } from './db/chat-history'
import { modelConfigsDb } from './db/model-configs'

// sql.js 返回的对象可能含有不可被 structured clone 序列化的属性（如 Uint8Array 等）
// 在 IPC 返回前必须转为纯 JS 对象
function safeClone<T>(obj: T): T {
  if (obj === undefined || obj === null) return obj
  try {
    return JSON.parse(JSON.stringify(obj))
  } catch {
    return obj
  }
}

// 包装 ipcMain.handle，自动对返回值做 safeClone
function safeHandle(channel: string, handler: (...args: any[]) => any): void {
  ipcMain.handle(channel, async (...args: any[]) => {
    const result = await handler(...args)
    return safeClone(result)
  })
}

export function registerIpcHandlers(mainWindow: BrowserWindow, dispatcher: NotificationDispatcher, scheduler: any): void {
  // ========== 提醒 ==========
  safeHandle('reminders:list', (_event, filters?) => {
    return remindersDb.list(filters)
  })

  safeHandle('reminders:get', (_event, id: number) => {
    return remindersDb.get(id)
  })

  safeHandle('reminders:create', (_event, data) => {
    return remindersDb.create(data)
  })

  safeHandle('reminders:update', (_event, id: number, data) => {
    return remindersDb.update(id, data)
  })

  safeHandle('reminders:delete', (_event, id: number) => {
    return remindersDb.delete(id)
  })

  safeHandle('reminders:toggle', (_event, id: number) => {
    return remindersDb.toggleActive(id)
  })

  safeHandle('reminders:stats', () => {
    return remindersDb.getTodayStats()
  })

  // ========== 通知配置 ==========
  safeHandle('notifications:get-configs', () => {
    return notificationConfigsDb.getAll()
  })

  safeHandle('notifications:update-config', (_event, channel: string, data) => {
    return notificationConfigsDb.update(channel, data)
  })

  safeHandle('notifications:test', async (_event, channel: string) => {
    return await dispatcher.testChannel(channel)
  })

  // ========== 设置 ==========
  safeHandle('settings:get-all', () => {
    return settingsDb.getAll()
  })

  safeHandle('settings:get', (_event, key: string) => {
    return settingsDb.get(key)
  })

  safeHandle('settings:set', (_event, key: string, value: string) => {
    settingsDb.set(key, value)

    // 处理特殊设置变更
    if (key === 'theme') {
      if (value === 'system') {
        nativeTheme.themeSource = 'system'
      } else {
        nativeTheme.themeSource = value as 'light' | 'dark'
      }
    }

    if (key === 'launch_at_startup') {
      app.setLoginItemSettings({ openAtLogin: value === 'true' })
    }

    return true
  })

  // ========== 主题 ==========
  safeHandle('theme:get', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  safeHandle('theme:set', (_event, mode: string) => {
    if (mode === 'system') {
      nativeTheme.themeSource = 'system'
    } else {
      nativeTheme.themeSource = mode as 'light' | 'dark'
    }
  })

  // 监听主题变化并通知渲染进程
  nativeTheme.on('updated', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('theme:changed', nativeTheme.shouldUseDarkColors)
    }
  })

  // ========== 窗口控制 ==========
  safeHandle('window:minimize', () => {
    mainWindow.minimize()
  })

  safeHandle('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
    return mainWindow.isMaximized()
  })

  safeHandle('window:close', () => {
    mainWindow.hide()
  })

  safeHandle('window:is-maximized', () => {
    return mainWindow.isMaximized()
  })

  // ========== 日志 ==========
  safeHandle('logs:recent', (_event, limit?: number) => {
    return reminderLogsDb.getRecent(limit)
  })

  safeHandle('logs:by-reminder', (_event, reminderId: number, limit?: number) => {
    return reminderLogsDb.getByReminder(reminderId, limit)
  })

  // ========== 工作日 ==========
  safeHandle('workdays:import-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '导入工作日数据',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const content = readFileSync(result.filePaths[0], 'utf-8')
    const data = JSON.parse(content)

    // 支持两种格式：
    // 格式1: { "holidays": [...], "workdays": [...] }
    // 格式2: { "2025": { "holidays": [...], "workdays": [...] } }
    let holidays: string[] = []
    let extraWorkdays: string[] = []

    if (data.holidays || data.workdays) {
      holidays = data.holidays || []
      extraWorkdays = data.workdays || []
    } else {
      for (const year of Object.keys(data)) {
        if (data[year].holidays) holidays.push(...data[year].holidays)
        if (data[year].workdays) extraWorkdays.push(...data[year].workdays)
      }
    }

    return workdaysDb.import(holidays, extraWorkdays)
  })

  safeHandle('workdays:count', () => {
    return workdaysDb.count()
  })

  safeHandle('workdays:clear', () => {
    workdaysDb.clear()
    return true
  })

  // ========== 农历转换 ==========
  safeHandle('lunar:to-solar', (_event, lunarDateStr: string) => {
    try {
      const result = getSolarDateFromLunar(lunarDateStr)
      return result?.date || null
    } catch {
      return null
    }
  })

  // ========== AI 对话 ==========
  safeHandle('ai:chat', async (_event, messages: Array<{ role: string; content: string }>, _configId?: number, _sessionId?: number, _modelOverride?: string) => {
    const result = await chatWithLLM(messages, scheduler, _configId, _modelOverride)
    if (_sessionId) {
      const lastUser = messages[messages.length - 1]
      if (lastUser?.role === 'user') {
        chatHistoryDb.appendToSession(_sessionId, [lastUser])
      }
      if (result.reply) {
        chatHistoryDb.appendToSession(_sessionId, [{ role: 'assistant', content: result.reply }])
      }
    } else {
      const lastUser = messages[messages.length - 1]
      if (lastUser?.role === 'user') {
        chatHistoryDb.append([lastUser])
      }
      if (result.reply) {
        chatHistoryDb.append([{ role: 'assistant', content: result.reply }])
      }
    }
    return result
  })

  safeHandle('ai:providers', () => {
    return PROVIDERS.map(p => ({ id: p.id, name: p.name, baseUrl: p.baseUrl, apiKeyRequired: p.apiKeyRequired, defaultModel: p.defaultModel, models: p.models }))
  })

  // ---- 会话管理 ----
  safeHandle('ai:session:create', (_event, title?: string, modelId?: number) => {
    return chatHistoryDb.createSession(title, modelId)
  })

  safeHandle('ai:session:list', () => {
    return chatHistoryDb.listSessions()
  })

  safeHandle('ai:session:get', (_event, id: number) => {
    return chatHistoryDb.getSession(id)
  })

  safeHandle('ai:session:delete', (_event, id: number) => {
    chatHistoryDb.deleteSession(id)
    return true
  })

  safeHandle('ai:session:update-title', (_event, id: number, title: string) => {
    chatHistoryDb.updateSessionTitle(id, title)
    return true
  })

  safeHandle('ai:session:load-messages', (_event, sessionId: number) => {
    return chatHistoryDb.loadBySession(sessionId)
  })

  // ---- 旧接口（兼容） ----
  safeHandle('ai:chat-history:load', () => {
    return chatHistoryDb.load()
  })

  safeHandle('ai:chat-history:clear', () => {
    chatHistoryDb.clear()
    return true
  })

  // ========== 模型配置 ==========
  safeHandle('models:list', () => {
    return modelConfigsDb.list()
  })

  safeHandle('models:get', (_event, id: number) => {
    return modelConfigsDb.get(id)
  })

  safeHandle('models:create', (_event, data: any) => {
    return modelConfigsDb.create(data)
  })

  safeHandle('models:update', (_event, id: number, data: any) => {
    return modelConfigsDb.update(id, data)
  })

  safeHandle('models:delete', (_event, id: number) => {
    return modelConfigsDb.delete(id)
  })

  safeHandle('models:set-default', (_event, id: number) => {
    modelConfigsDb.setDefault(id)
    return true
  })

  safeHandle('models:test', async (_event, data: { provider: string; base_url: string; api_key: string; model: string }) => {
    return await testModelConnection(data)
  })
}
