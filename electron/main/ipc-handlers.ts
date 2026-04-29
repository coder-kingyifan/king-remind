import {app, BrowserWindow, dialog, ipcMain, nativeTheme} from 'electron'
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'fs'
import {extname, join} from 'path'
import {remindersDb} from './db/reminders'
import {notificationConfigsDb} from './db/notification-configs'
import {selectNotificationSoundFile, previewNotificationSound} from './notifications/notification-window'
import {settingsDb} from './db/settings'
import {reminderLogsDb} from './db/reminder-logs'
import {workdaysDb} from './db/workdays'
import {NotificationDispatcher} from './notifications/dispatcher'
import {getSolarDateFromLunar} from 'chinese-days'
import {chatWithLLM, generateSessionTitle, PROVIDERS, testModelConnection, hasTextModelConfigured, hasSearchModelConfigured} from './llm'
import {chatHistoryDb} from './db/chat-history'
import {modelConfigsDb} from './db/model-configs'
import {skillsDb} from './db/skills'
import {skillContentDb} from './db/skill-content'
import {startApiServer, stopApiServer} from './api-server'
import {ReminderScheduler} from './scheduler'
import {updateTrayAlwaysOnTop} from './tray'
import {
    isDatabaseEncrypted,
    setEncryptionPassword,
    removeEncryption as removeDbEncryption,
    saveDatabase
} from './db/connection'
import {weChatBot} from './wechat-bot/wechat-bot'
import {checkForUpdate} from './updater'
import {todosDb} from './db/todos'
import {meetingsDb} from './db/meetings'
import {meetingSegmentsDb} from './db/meeting-segments'
import {createRealtimeSttSession, hasRealtimeSttConfig, transcribeAudio, type RealtimeSttSession} from './stt'

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

let schedulerRef: any = null
let dispatcherRef: any = null
const realtimeSttSessions = new Map<string, RealtimeSttSession>()

export function registerIpcHandlers(mainWindow: BrowserWindow, dispatcher: NotificationDispatcher, scheduler: any): void {
    schedulerRef = scheduler
    dispatcherRef = dispatcher
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

    safeHandle('notifications:select-sound-file', async () => {
        return await selectNotificationSoundFile()
    })

    safeHandle('notifications:preview-sound', () => {
        previewNotificationSound()
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
            app.setLoginItemSettings({openAtLogin: value === 'true'})
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

    safeHandle('window:toggle-always-on-top', () => {
        const isOnTop = mainWindow.isAlwaysOnTop()
        const newState = !isOnTop
        mainWindow.setAlwaysOnTop(newState)
        settingsDb.set('always_on_top', String(newState))
        // 同步托盘菜单勾选状态
        updateTrayAlwaysOnTop(newState)
        return newState
    })

    safeHandle('window:is-always-on-top', () => {
        return mainWindow.isAlwaysOnTop()
    })

    // ========== 仪表盘统计 ==========
    safeHandle('dashboard:stats', () => {
        const reminderStats = remindersDb.getTodayStats()
        const chatSessionCount = chatHistoryDb.sessionCount()
        const chatMessageCount = chatHistoryDb.count()
        const modelCount = modelConfigsDb.list().length
        const skillCount = skillsDb.list().length
        const enabledSkillCount = skillsDb.list({is_enabled: 1}).length
        const notifConfigs = notificationConfigsDb.getAll()
        const enabledChannels = notifConfigs.filter((c: any) => c.enabled).length
        const todoStats = todosDb.stats()
        const meetingStats = meetingsDb.stats()

        return {
            totalReminders: reminderStats.total,
            activeReminders: reminderStats.active,
            triggeredToday: reminderStats.triggeredToday,
            chatSessionCount,
            chatMessageCount,
            modelCount,
            skillCount,
            enabledSkillCount,
            enabledChannels,
            totalChannels: notifConfigs.length,
            todoTotal: todoStats.total,
            todoCompleted: todoStats.completed,
            todoPending: todoStats.pending,
            todoOverdue: todoStats.overdue,
            meetingTotal: meetingStats.total,
            meetingPending: meetingStats.pending,
            meetingOngoing: meetingStats.ongoing,
            meetingCompleted: meetingStats.completed,
            meetingToday: meetingStats.today
        }
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
            filters: [{name: 'JSON', extensions: ['json']}],
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
    // ---- 图片保存 ----
    safeHandle('ai:save-images', (_event, dataUrls: string[]) => {
        const imagesDir = join(app.getPath('userData'), 'images')
        if (!existsSync(imagesDir)) {
            mkdirSync(imagesDir, {recursive: true})
        }
        const paths: string[] = []
        for (const dataUrl of dataUrls) {
            const matches = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/)
            if (!matches) continue
            const mimeMap: Record<string, string> = {
                'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
                'image/webp': 'webp', 'image/bmp': 'bmp'
            }
            const ext = mimeMap[matches[1]] || 'png'
            const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`
            writeFileSync(join(imagesDir, filename), Buffer.from(matches[2], 'base64'))
            paths.push(`images/${filename}`)
        }
        return paths
    })

    // Resolve image_paths in messages to multimodal content
    function resolveImagePaths(messages: Array<Record<string, any>>): Array<Record<string, any>> {
        const userDataPath = app.getPath('userData')
        return messages.map(m => {
            if (!m.image_paths || !Array.isArray(m.image_paths) || m.image_paths.length === 0) return m
            const content: any[] = []
            for (const p of m.image_paths as string[]) {
                const fullPath = join(userDataPath, p)
                if (existsSync(fullPath)) {
                    const buf = readFileSync(fullPath)
                    const base64 = buf.toString('base64')
                    const ext = extname(p).slice(1)
                    const mimeMap: Record<string, string> = {
                        'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                        'gif': 'image/gif', 'webp': 'image/webp', 'bmp': 'image/bmp'
                    }
                    const mime = mimeMap[ext] || 'image/png'
                    content.push({type: 'image_url', image_url: {url: `data:${mime};base64,${base64}`}})
                }
            }
            const textContent = typeof m.content === 'string' ? m.content : ''
            if (textContent && textContent !== '(图片)') {
                content.push({type: 'text', text: textContent})
            }
            const resolved = {...m}
            resolved.content = content.length === 1 && content[0].type === 'text' ? content[0].text : content
            delete resolved.image_paths
            return resolved
        })
    }

    safeHandle('ai:chat', async (_event, messages: Array<{
        role: string;
        content: string
    }>, _configId?: number, _sessionId?: number, _modelOverride?: string) => {
        // Extract image_paths from the last user message BEFORE resolving
        const lastOriginalUser = messages[messages.length - 1]?.role === 'user' ? messages[messages.length - 1] : null
        const originalImagePaths = (lastOriginalUser as any)?.image_paths || []

        // Resolve image file paths to base64 multimodal content
        const resolvedMessages = resolveImagePaths(messages)
        const sender = mainWindow.webContents
        const result = await chatWithLLM(resolvedMessages, scheduler, _configId, _modelOverride, (streamEvent) => {
            if (!sender.isDestroyed()) {
                sender.send('ai:stream', JSON.parse(JSON.stringify(streamEvent)))
            }
        })
        // Helper: strip image content from message for history storage
        const stripImages = (content: any): string => {
            if (typeof content === 'string') return content
            if (Array.isArray(content)) {
                const textParts = content
                    .filter((b: any) => b.type === 'text' && b.text)
                    .map((b: any) => b.text)
                return textParts.join('\n') || '(图片)'
            }
            return String(content || '')
        }

        if (_sessionId) {
            const lastUser = messages[messages.length - 1]
            if (lastUser?.role === 'user') {
                chatHistoryDb.appendToSession(_sessionId, [{
                    role: 'user',
                    content: stripImages(lastUser.content),
                    images: originalImagePaths.length > 0 ? originalImagePaths : undefined
                }])
            }
            if (result.reply) {
                chatHistoryDb.appendToSession(_sessionId, [{ role: 'assistant', content: result.reply }])
            }
        } else {
            const lastUser = messages[messages.length - 1]
            if (lastUser?.role === 'user') {
                chatHistoryDb.append([{ role: 'user', content: stripImages(lastUser.content) }])
            }
            if (result.reply) {
                chatHistoryDb.append([{ role: 'assistant', content: result.reply }])
            }
        }
        return result
    })

    safeHandle('ai:providers', () => {
        return PROVIDERS.map(p => ({
            id: p.id,
            name: p.name,
            baseUrl: p.baseUrl,
            apiKeyRequired: p.apiKeyRequired,
            defaultModel: p.defaultModel,
            models: p.models,
            modelType: p.modelType || null
        }))
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

    safeHandle('ai:session:clear-all', () => {
        chatHistoryDb.clear()
        return true
    })

    safeHandle('ai:session:update-title', (_event, id: number, title: string) => {
        chatHistoryDb.updateSessionTitle(id, title)
        return true
    })

    safeHandle('ai:generate-title', async (_event, configId: number, userMsg: string, aiReply: string) => {
        return await generateSessionTitle(configId, userMsg, aiReply)
    })

    safeHandle('ai:session:load-messages', (_event, sessionId: number) => {
        const msgs = chatHistoryDb.loadBySession(sessionId)
        const userDataPath = app.getPath('userData')
        const mimeMap: Record<string, string> = {
            'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
            'gif': 'image/gif', 'webp': 'image/webp', 'bmp': 'image/bmp'
        }
        return msgs.map(m => {
            if (m.images && Array.isArray(m.images)) {
                m.images = m.images.map((p: string) => {
                    const fullPath = join(userDataPath, p)
                    if (existsSync(fullPath)) {
                        try {
                            const buf = readFileSync(fullPath)
                            const ext = extname(p).slice(1)
                            const mime = mimeMap[ext] || 'image/png'
                            return `data:${mime};base64,${buf.toString('base64')}`
                        } catch { return p }
                    }
                    return p
                })
            }
            return m
        })
    })

    safeHandle('ai:generate-greeting', async () => {
        try {
            const allConfigs = modelConfigsDb.list()
            const textConfig = allConfigs.find(c => c.model_type === 'text' && c.is_default === 1)
                || allConfigs.find(c => c.model_type === 'text')
                || allConfigs.find(c => c.is_default === 1 && c.model_type !== 'web_search')
                || allConfigs.find(c => c.model_type !== 'web_search')
            if (!textConfig) return null

            const now = new Date()
            const hour = now.getHours()
            const dateInfo = `${now.toLocaleDateString('zh-CN', {timeZone: 'Asia/Shanghai'})} ${now.toLocaleDateString('zh-CN', {timeZone: 'Asia/Shanghai', weekday: 'long'})} ${now.toLocaleTimeString('zh-CN', {timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit'})}`
            const period = hour < 6 ? '凌晨' : hour < 12 ? '早上' : hour < 14 ? '中午' : hour < 18 ? '下午' : '晚上'

            // 并行生成问候和建议
            const prompt1 = `现在是${period}，${dateInfo}。请用简短友好的中文给我一句鼓励的话（不超过20个字，不要标点结尾，不要引号，不要"加油"）。只输出鼓励语本身。`
            const prompt2 = `请生成5条具体的提醒建议（每条不超过15字），用JSON数组格式返回，如["建议1","建议2","建议3","建议4","建议5"]。要求具体可操作，如"新增每日喝水提醒"、"周末提醒我去运动"、"下周一提醒我交周报"等，不要笼统。随机多样。只输出JSON数组。`

            const [r1, r2] = await Promise.all([
                chatWithLLM([{role: 'user', content: prompt1}], null, textConfig.id, undefined, undefined),
                chatWithLLM([{role: 'user', content: prompt2}], null, textConfig.id, undefined, undefined)
            ])

            const encouragement = r1.reply?.trim().replace(/["""'"']/g, '') || ''
            let suggestions: string[] = []
            try {
                const arr = JSON.parse(r2.reply?.trim() || '[]')
                if (Array.isArray(arr) && arr.length > 0) suggestions = arr.filter((s: any) => typeof s === 'string' && s.length > 0)
            } catch { /* ignore */ }

            return { encouragement, suggestions }
        } catch {
            return null
        }
    })

    // ---- 旧接口（兼容） ----
    safeHandle('ai:chat-history:load', () => {
        return chatHistoryDb.load()
    })

    safeHandle('ai:chat-history:clear', () => {
        chatHistoryDb.clear()
        return true
    })

    // ========== 技能管理 ==========
    safeHandle('skills:list', (_event, filters?) => {
        return skillsDb.list(filters)
    })

    safeHandle('skills:get', (_event, id: number) => {
        return skillsDb.get(id)
    })

    safeHandle('skills:create', (_event, data: any) => {
        return skillsDb.create(data)
    })

    safeHandle('skills:update', (_event, id: number, data: any) => {
        return skillsDb.update(id, data)
    })

    safeHandle('skills:delete', (_event, id: number) => {
        return skillsDb.delete(id)
    })

    safeHandle('skills:toggle', (_event, id: number) => {
        return skillsDb.toggleEnabled(id)
    })

    safeHandle('skills:execute', async (_event, id: number, options?: { skipEnabledCheck?: boolean }) => {
        const {executeSkill} = await import('./skills/executor')
        return await executeSkill(id, options)
    })

    safeHandle('skills:update-config', (_event, id: number, userConfig: string) => {
        return skillsDb.updateConfig(id, userConfig)
    })

    // ========== 技能内容管理 ==========
    safeHandle('skills:content:list', (_event, skillKey: string, category?: string) => {
        return skillContentDb.list(skillKey, category)
    })

    safeHandle('skills:content:add', (_event, skillKey: string, category: string, content: string, extra?: Record<string, any>) => {
        return skillContentDb.add(skillKey, category, content, extra)
    })

    safeHandle('skills:content:delete', (_event, id: number) => {
        return skillContentDb.delete(id)
    })

    safeHandle('skills:content:count', (_event, skillKey: string, category?: string) => {
        return skillContentDb.count(skillKey, category)
    })

    // ========== 技能商店 ==========
    safeHandle('skill-store:fetch', async () => {
        const {fetchStoreManifest, getStoreSkillsWithStatus} = await import('./skill-store')
        try {
            const manifest = await fetchStoreManifest()
            return getStoreSkillsWithStatus(manifest)
        } catch (e: any) {
            throw new Error(`获取技能商店失败: ${e.message}`)
        }
    })

    safeHandle('skill-store:install', async (_event, skillKey: string) => {
        const {fetchStoreManifest, installStoreSkill} = await import('./skill-store')
        const manifest = await fetchStoreManifest()
        const storeSkill = manifest.skills.find(s => s.skill_key === skillKey)
        if (!storeSkill) throw new Error('未找到该技能')
        return installStoreSkill(storeSkill)
    })

    safeHandle('skill-store:uninstall', async (_event, skillKey: string) => {
        const {uninstallStoreSkill} = await import('./skill-store')
        return uninstallStoreSkill(skillKey)
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

    safeHandle('models:test', async (_event, data: {
        provider: string;
        base_url: string;
        api_key: string;
        model: string
    }) => {
        return await testModelConnection(data)
    })

    safeHandle('models:has-text-model', () => {
        return hasTextModelConfigured()
    })

    safeHandle('models:has-search-model', () => {
        return hasSearchModelConfigured()
    })

    // ========== 应用控制 ==========
    safeHandle('app:restart', () => {
        app.relaunch()
        app.exit(0)
    })

    safeHandle('app:version', () => {
        return app.getVersion()
    })

    safeHandle('updater:check', async () => {
        return await checkForUpdate()
    })

    safeHandle('app:api-status', () => {
        const enabled = settingsDb.get('api_enabled')
        const port = settingsDb.get('api_port') || '33333'
        const host = settingsDb.get('api_host') || '0.0.0.0'
        const token = settingsDb.get('api_token') || ''
        return { enabled: enabled === 'true', port, host, token }
    })

    // ========== API 接口控制 ==========
    safeHandle('api:toggle', (_event, enabled: boolean) => {
        settingsDb.set('api_enabled', String(enabled))
        if (enabled) {
            const scheduler = schedulerRef
            if (scheduler) {
                stopApiServer()
                startApiServer(scheduler, dispatcherRef)
            }
        } else {
            stopApiServer()
        }
        return true
    })

    safeHandle('api:restart', (_event) => {
        const apiEnabled = settingsDb.get('api_enabled')
        stopApiServer()
        if (apiEnabled === 'true') {
            const scheduler = schedulerRef
            if (scheduler) {
                startApiServer(scheduler, dispatcherRef)
            }
        }
        return true
    })

    // ========== 数据库加密 ==========
    safeHandle('db:is-encrypted', () => {
        return isDatabaseEncrypted()
    })

    safeHandle('db:set-encryption', (_event, password: string) => {
        setEncryptionPassword(password)
        settingsDb.set('db_encrypted', 'true')
        saveDatabase()
        return true
    })

    safeHandle('db:remove-encryption', () => {
        removeDbEncryption()
        settingsDb.set('db_encrypted', 'false')
        saveDatabase()
        return true
    })

    // ========== 微信机器人 ==========
    weChatBot.setScheduler(scheduler)

    safeHandle('wechat-bot:get-qrcode', async () => {
        return await weChatBot.getQRCode()
    })

    safeHandle('wechat-bot:check-status', async () => {
        return await weChatBot.checkQRCodeStatus()
    })

    safeHandle('wechat-bot:login', async () => {
        await weChatBot.login()
        return weChatBot.getState()
    })

    safeHandle('wechat-bot:logout', async () => {
        await weChatBot.logout()
        return weChatBot.getState()
    })

    safeHandle('wechat-bot:get-state', () => {
        return weChatBot.getState()
    })

    // ========== 待办 ==========
    safeHandle('todos:list', (_event, filters?) => {
        return todosDb.list(filters)
    })

    safeHandle('todos:get', (_event, id: number) => {
        return todosDb.get(id)
    })

    safeHandle('todos:create', (_event, data) => {
        return todosDb.create(data)
    })

    safeHandle('todos:update', (_event, id: number, data) => {
        return todosDb.update(id, data)
    })

    safeHandle('todos:delete', (_event, id: number) => {
        return todosDb.delete(id)
    })

    safeHandle('todos:toggle', (_event, id: number) => {
        return todosDb.toggle(id)
    })

    safeHandle('todos:stats', () => {
        return todosDb.stats()
    })

    // 将图片相对路径解析为 data URL
    safeHandle('todos:resolve-images', (_event, paths: string[]) => {
        const userDataPath = app.getPath('userData')
        return paths.map(p => {
            const fullPath = join(userDataPath, p)
            if (!existsSync(fullPath)) return null
            try {
                const buf = readFileSync(fullPath)
                const base64 = buf.toString('base64')
                const ext = extname(p).slice(1)
                const mimeMap: Record<string, string> = {
                    'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                    'gif': 'image/gif', 'webp': 'image/webp', 'bmp': 'image/bmp'
                }
                const mime = mimeMap[ext] || 'image/png'
                return `data:${mime};base64,${base64}`
            } catch {
                return null
            }
        })
    })

    // ========== 会议管理 ==========
    safeHandle('meetings:list', (_event, filters?) => {
        return meetingsDb.list(filters)
    })

    safeHandle('meetings:get', (_event, id: number) => {
        return meetingsDb.get(id)
    })

    safeHandle('meetings:create', (_event, data) => {
        return meetingsDb.create(data)
    })

    safeHandle('meetings:update', (_event, id: number, data) => {
        return meetingsDb.update(id, data)
    })

    safeHandle('meetings:delete', (_event, id: number) => {
        return meetingsDb.delete(id)
    })

    safeHandle('meetings:update-status', (_event, id: number, status: string) => {
        return meetingsDb.updateStatus(id, status)
    })

    safeHandle('meetings:stats', () => {
        return meetingsDb.stats()
    })

    // 上传会议附件
    safeHandle('meetings:upload-files', async (_event, files: Array<{ name: string; data: string; type: string }>) => {
        const meetingsDir = join(app.getPath('userData'), 'meetings', 'attachments')
        if (!existsSync(meetingsDir)) {
            mkdirSync(meetingsDir, {recursive: true})
        }
        const results: Array<{ name: string; path: string; type: string; size: number }> = []
        for (const file of files) {
            const matches = file.data.match(/^data:[^;]+;base64,(.+)$/)
            if (!matches) continue
            const ext = extname(file.name).toLowerCase()
            const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`
            const filePath = join(meetingsDir, filename)
            const buffer = Buffer.from(matches[1], 'base64')
            writeFileSync(filePath, buffer)
            results.push({
                name: file.name,
                path: `meetings/attachments/${filename}`,
                type: file.type,
                size: buffer.length
            })
        }
        return results
    })

    // 解析会议附件路径
    safeHandle('meetings:resolve-files', (_event, paths: string[]) => {
        const userDataPath = app.getPath('userData')
        return paths.map(p => {
            const fullPath = join(userDataPath, p)
            if (!existsSync(fullPath)) return null
            try {
                const buf = readFileSync(fullPath)
                const base64 = buf.toString('base64')
                const ext = extname(p).slice(1).toLowerCase()
                const mimeMap: Record<string, string> = {
                    'txt': 'text/plain', 'md': 'text/markdown',
                    'pdf': 'application/pdf',
                    'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'm4a': 'audio/mp4',
                    'ogg': 'audio/ogg', 'webm': 'audio/webm', 'flac': 'audio/flac',
                    'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                    'gif': 'image/gif', 'webp': 'image/webp'
                }
                const mime = mimeMap[ext] || 'application/octet-stream'
                return `data:${mime};base64,${base64}`
            } catch {
                return null
            }
        })
    })

    // 保存录音文件
    safeHandle('meetings:save-recording', (_event, dataUrl: string, meetingId?: number) => {
        const recordingsDir = join(app.getPath('userData'), 'meetings', 'recordings')
        if (!existsSync(recordingsDir)) {
            mkdirSync(recordingsDir, {recursive: true})
        }
        const matches = dataUrl.match(/^data:[^;]+;base64,(.+)$/)
        if (!matches) return null
        const filename = `recording-${meetingId || Date.now()}-${Math.random().toString(36).substring(2, 6)}.webm`
        const filePath = join(recordingsDir, filename)
        writeFileSync(filePath, Buffer.from(matches[1], 'base64'))
        const relativePath = `meetings/recordings/${filename}`
        if (meetingId) {
            meetingsDb.update(meetingId, {recording_path: relativePath, has_recording: 1})
        }
        return relativePath
    })

    // AI 会议摘要
    safeHandle('meetings:ai-summarize', async (_event, meetingId: number) => {
        const meeting = meetingsDb.get(meetingId)
        if (!meeting) throw new Error('会议不存在')

        const allConfigs = modelConfigsDb.list()
        const textConfig = allConfigs.find(c => c.model_type === 'text' && c.is_default === 1)
            || allConfigs.find(c => c.model_type === 'text')
            || allConfigs.find(c => c.is_default === 1 && c.model_type !== 'web_search')
        if (!textConfig) throw new Error('请先配置文本模型')

        // 构建会议内容
        let content = `会议标题：${meeting.title}\n`
        if (meeting.location) content += `地点：${meeting.location}\n`
        content += `时间：${meeting.start_time}${meeting.end_time ? ' - ' + meeting.end_time : ''}\n`
        try {
            const participants = JSON.parse(meeting.participants || '[]')
            if (participants.length) content += `参会人：${participants.join('、')}\n`
        } catch {}
        if (meeting.minutes) content += `\n会议记录：\n${meeting.minutes}\n`

        const prompt = `请对以下会议内容进行分析，生成结构化摘要。请用 JSON 格式返回，包含以下字段：
- topics: 议题列表（字符串数组）
- decisions: 决议列表（字符串数组）
- action_items: 待办事项列表，每项包含 task(任务)、assignee(负责人)、deadline(截止时间，如未提及则null)（对象数组）
- key_points: 关键要点（字符串数组）
- summary: 一段话总结（字符串）

只输出 JSON，不要其他内容。

${content}`

        const result = await chatWithLLM([{role: 'user', content: prompt}], null, textConfig.id, undefined, undefined)
        let summary: any = null
        try {
            const text = result.reply?.trim() || ''
            const jsonMatch = text.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                summary = JSON.parse(jsonMatch[0])
            }
        } catch {}

        if (summary) {
            meetingsDb.update(meetingId, {ai_summary: summary})
        }
        return summary
    })

    // AI 会议问答
    safeHandle('meetings:ai-chat', async (_event, meetingId: number, question: string, chatHistory?: Array<{role: string; content: string}>) => {
        const meeting = meetingsDb.get(meetingId)
        if (!meeting) throw new Error('会议不存在')

        const allConfigs = modelConfigsDb.list()
        const textConfig = allConfigs.find(c => c.model_type === 'text' && c.is_default === 1)
            || allConfigs.find(c => c.model_type === 'text')
            || allConfigs.find(c => c.is_default === 1 && c.model_type !== 'web_search')
        if (!textConfig) throw new Error('请先配置文本模型')

        // 构建会议上下文
        let meetingContext = `会议标题：${meeting.title}\n`
        if (meeting.location) meetingContext += `地点：${meeting.location}\n`
        meetingContext += `时间：${meeting.start_time}${meeting.end_time ? ' - ' + meeting.end_time : ''}\n`
        try {
            const participants = JSON.parse(meeting.participants || '[]')
            if (participants.length) meetingContext += `参会人：${participants.join('、')}\n`
        } catch {}
        if (meeting.minutes) meetingContext += `\n会议记录：\n${meeting.minutes}\n`
        if (meeting.ai_summary) {
            try {
                const summary = typeof meeting.ai_summary === 'string' ? JSON.parse(meeting.ai_summary) : meeting.ai_summary
                meetingContext += `\nAI 摘要：${JSON.stringify(summary, null, 2)}\n`
            } catch {}
        }

        const systemMsg = {role: 'system', content: `你是一个会议助手。请根据以下会议内容回答用户的问题。如果问题不在会议内容范围内，请说明。\n\n${meetingContext}`}
        const messages: Array<{role: string; content: string}> = [systemMsg as any]
        if (chatHistory && chatHistory.length) {
            messages.push(...chatHistory)
        }
        messages.push({role: 'user', content: question})

        const result = await chatWithLLM(messages, null, textConfig.id, undefined, undefined)
        return result.reply || ''
    })

    // ========== 会议分段 ==========
    safeHandle('meetings:segments:list', (_event, meetingId: number) => {
        return meetingSegmentsDb.listByMeeting(meetingId)
    })

    safeHandle('meetings:segments:add', (_event, data: {
        meeting_id: number
        segment_type: 'text' | 'audio'
        content: string
        speaker?: string
        sort_order?: number
    }) => {
        return meetingSegmentsDb.add(data)
    })

    safeHandle('meetings:segments:add-batch', (_event, segments: Array<{
        meeting_id: number
        segment_type: 'text' | 'audio'
        content: string
        speaker?: string
        sort_order?: number
    }>) => {
        return meetingSegmentsDb.addBatch(segments)
    })

    safeHandle('meetings:segments:update', (_event, id: number, data: Partial<{
        segment_type: 'text' | 'audio'
        content: string
        speaker: string
        sort_order: number
    }>) => {
        return meetingSegmentsDb.update(id, data)
    })

    safeHandle('meetings:segments:delete', (_event, id: number) => {
        return meetingSegmentsDb.delete(id)
    })

    safeHandle('meetings:segments:delete-by-meeting', (_event, meetingId: number) => {
        return meetingSegmentsDb.deleteByMeeting(meetingId)
    })

    safeHandle('meetings:segments:reorder', (_event, meetingId: number, orderedIds: number[]) => {
        return meetingSegmentsDb.reorder(meetingId, orderedIds)
    })

    // ========== 语音转文字 (STT) ==========
    safeHandle('meetings:stt', async (_event, meetingId: number, enableDiarization?: boolean) => {
        const meeting = meetingsDb.get(meetingId)
        if (!meeting) throw new Error('会议不存在')

        // 更新状态为 pending
        meetingsDb.update(meetingId, {stt_status: 'pending'} as any)

        try {
            // 查找录音文件路径
            let audioPath = meeting.recording_path
            if (!audioPath) {
                // 检查分段中是否有音频
                const segments = meetingSegmentsDb.listByMeeting(meetingId)
                const audioSegment = segments.find(s => s.segment_type === 'audio' && s.content)
                if (audioSegment) audioPath = audioSegment.content
            }
            if (!audioPath) throw new Error('没有找到录音文件')

            const result = await transcribeAudio(audioPath, enableDiarization !== false)

            // 更新会议转写文本
            meetingsDb.update(meetingId, {
                stt_text: result.full_text,
                stt_status: 'done'
            } as any)

            // 将说话人分离结果写入分段
            if (result.utterances.length > 1 || (result.utterances.length === 1 && result.utterances[0].speaker !== '说话人1')) {
                // 删除旧的 STT 生成的分段，保留手动添加的
                const existingSegments = meetingSegmentsDb.listByMeeting(meetingId)
                const sttSegments = existingSegments.filter(s => s.speaker && s.speaker.startsWith('说话人'))
                for (const s of sttSegments) {
                    meetingSegmentsDb.delete(s.id)
                }

                // 添加新的 STT 分段
                const maxOrder = existingSegments.length > 0
                    ? Math.max(...existingSegments.map(s => s.sort_order)) + 1
                    : 0
                const newSegments = result.utterances.map((u, i) => ({
                    meeting_id: meetingId,
                    segment_type: 'text' as const,
                    content: u.text,
                    speaker: u.speaker,
                    sort_order: maxOrder + i
                }))
                meetingSegmentsDb.addBatch(newSegments)
            }

            return result
        } catch (e: any) {
            meetingsDb.update(meetingId, {stt_status: 'error'} as any)
            throw e
        }
    })

    safeHandle('meetings:stt-realtime:available', () => {
        return hasRealtimeSttConfig()
    })

    safeHandle('meetings:stt-realtime:start', (event) => {
        const session = createRealtimeSttSession((payload) => {
            event.sender.send('meetings:stt-realtime:event', {
                sessionId: session.id,
                ...payload
            })
        })
        realtimeSttSessions.set(session.id, session)
        return {sessionId: session.id}
    })

    ipcMain.on('meetings:stt-realtime:chunk', (_event, sessionId: string, base64Audio: string) => {
        const session = realtimeSttSessions.get(sessionId)
        if (!session || !base64Audio) return
        session.sendAudio(Buffer.from(base64Audio, 'base64'))
    })

    safeHandle('meetings:stt-realtime:stop', (_event, sessionId: string) => {
        const session = realtimeSttSessions.get(sessionId)
        if (!session) return {full_text: ''}
        const fullText = session.stop()
        realtimeSttSessions.delete(sessionId)
        return {full_text: fullText}
    })
}
