import {app, BrowserWindow, dialog, ipcMain, nativeTheme} from 'electron'
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'fs'
import {extname, join} from 'path'
import {remindersDb} from './db/reminders'
import {notificationConfigsDb} from './db/notification-configs'
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

export function registerIpcHandlers(mainWindow: BrowserWindow, dispatcher: NotificationDispatcher, scheduler: any): void {
    schedulerRef = scheduler
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
            totalChannels: notifConfigs.length
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
            models: p.models
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
                startApiServer(scheduler)
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
                startApiServer(scheduler)
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
}
