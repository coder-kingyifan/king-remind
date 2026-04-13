import {contextBridge, ipcRenderer} from 'electron'

// 安全包装：确保 IPC 发送参数和返回值都是纯 JS 对象，避免 structured clone 错误
// Vue 3 的响应式 Proxy 对象无法被 structured clone，必须先转为纯对象
async function safeInvoke(channel: string, ...args: any[]): Promise<any> {
    try {
        // 序列化发送参数（去除 Vue Proxy、Symbol 等不可克隆属性）
        const safeArgs = args.map(arg => {
            if (arg === undefined || arg === null || typeof arg !== 'object') return arg
            try {
                return JSON.parse(JSON.stringify(arg))
            } catch {
                return arg
            }
        })

        const result = await ipcRenderer.invoke(channel, ...safeArgs)
        return result
    } catch (e: any) {
        console.error('[preload] safeInvoke error:', channel, e.message)
        throw e
    }
}

const electronAPI = {
    // 仪表盘
    dashboard: {
        stats: () => safeInvoke('dashboard:stats')
    },

    // 提醒管理
    reminders: {
        list: (filters?: any) => safeInvoke('reminders:list', filters),
        get: (id: number) => safeInvoke('reminders:get', id),
        create: (data: any) => safeInvoke('reminders:create', data),
        update: (id: number, data: any) => safeInvoke('reminders:update', id, data),
        delete: (id: number) => safeInvoke('reminders:delete', id),
        toggle: (id: number) => safeInvoke('reminders:toggle', id),
        stats: () => safeInvoke('reminders:stats')
    },

    // 通知配置
    notifications: {
        getConfigs: () => safeInvoke('notifications:get-configs'),
        updateConfig: (channel: string, data: any) =>
            safeInvoke('notifications:update-config', channel, data),
        test: (channel: string) => safeInvoke('notifications:test', channel),
        onShow: (callback: (data: any) => void) => {
            ipcRenderer.on('notification:show', (_event, data) => callback(data))
        }
    },

    // 设置
    settings: {
        getAll: () => safeInvoke('settings:get-all'),
        get: (key: string) => safeInvoke('settings:get', key),
        set: (key: string, value: string) => safeInvoke('settings:set', key, value)
    },

    // 主题
    theme: {
        get: () => safeInvoke('theme:get'),
        set: (mode: string) => safeInvoke('theme:set', mode),
        onChange: (callback: (isDark: boolean) => void) => {
            ipcRenderer.on('theme:changed', (_event, isDark) => callback(isDark))
        }
    },

    // 窗口控制
    window: {
        minimize: () => safeInvoke('window:minimize'),
        maximize: () => safeInvoke('window:maximize'),
        close: () => safeInvoke('window:close'),
        isMaximized: () => safeInvoke('window:is-maximized'),
        toggleAlwaysOnTop: () => safeInvoke('window:toggle-always-on-top'),
        isAlwaysOnTop: () => safeInvoke('window:is-always-on-top'),
        onAlwaysOnTopChanged: (callback: (checked: boolean) => void) => {
            ipcRenderer.on('window:always-on-top-changed', (_event, checked) => callback(checked))
        }
    },

    // 日志
    logs: {
        recent: (limit?: number) => safeInvoke('logs:recent', limit),
        byReminder: (reminderId: number, limit?: number) =>
            safeInvoke('logs:by-reminder', reminderId, limit)
    },

    // 工作日
    workdays: {
        importFile: () => safeInvoke('workdays:import-file'),
        count: () => safeInvoke('workdays:count'),
        clear: () => safeInvoke('workdays:clear')
    },

    // 农历转换
    lunarToSolar: (lunarDateStr: string) => safeInvoke('lunar:to-solar', lunarDateStr),

    // AI 对话
    ai: {
        chat: (messages: Array<{
            role: string;
            content: string
        }>, configId?: number, sessionId?: number, modelOverride?: string) =>
            safeInvoke('ai:chat', messages, configId, sessionId, modelOverride),
        getProviders: () => safeInvoke('ai:providers'),
        loadHistory: () => safeInvoke('ai:chat-history:load'),
        clearHistory: () => safeInvoke('ai:chat-history:clear'),
        createSession: (title?: string, modelId?: number) =>
            safeInvoke('ai:session:create', title, modelId),
        listSessions: () => safeInvoke('ai:session:list'),
        getSession: (id: number) => safeInvoke('ai:session:get', id),
        deleteSession: (id: number) => safeInvoke('ai:session:delete', id),
        saveImages: (dataUrls: string[]) => safeInvoke('ai:save-images', dataUrls),
        clearAllSessions: () => safeInvoke('ai:session:clear-all'),
        updateSessionTitle: (id: number, title: string) =>
            safeInvoke('ai:session:update-title', id, title),
        loadSessionMessages: (sessionId: number) =>
            safeInvoke('ai:session:load-messages', sessionId),
        generateTitle: (configId: number, userMsg: string, aiReply: string) =>
            safeInvoke('ai:generate-title', configId, userMsg, aiReply),
        generateGreeting: () => safeInvoke('ai:generate-greeting'),
        onStreamEvent: (callback: (event: any) => void) => {
            ipcRenderer.on('ai:stream', (_event, data) => callback(data))
        },
        removeStreamListener: () => {
            ipcRenderer.removeAllListeners('ai:stream')
        }
    },

    // 模型配置
    models: {
        list: () => safeInvoke('models:list'),
        get: (id: number) => safeInvoke('models:get', id),
        create: (data: any) => safeInvoke('models:create', data),
        update: (id: number, data: any) => safeInvoke('models:update', id, data),
        delete: (id: number) => safeInvoke('models:delete', id),
        setDefault: (id: number) => safeInvoke('models:set-default', id),
        test: (data: { provider: string; base_url: string; api_key: string; model: string }) =>
            safeInvoke('models:test', data)
    },

    // 技能管理
    skills: {
        list: (filters?: any) => safeInvoke('skills:list', filters),
        get: (id: number) => safeInvoke('skills:get', id),
        create: (data: any) => safeInvoke('skills:create', data),
        update: (id: number, data: any) => safeInvoke('skills:update', id, data),
        delete: (id: number) => safeInvoke('skills:delete', id),
        toggle: (id: number) => safeInvoke('skills:toggle', id),
        execute: (id: number, options?: { skipEnabledCheck?: boolean }) => safeInvoke('skills:execute', id, options),
        updateConfig: (id: number, userConfig: string) => safeInvoke('skills:update-config', id, userConfig)
    },

    // 技能商店
    skillStore: {
        fetch: () => safeInvoke('skill-store:fetch'),
        install: (skillKey: string) => safeInvoke('skill-store:install', skillKey),
        uninstall: (skillKey: string) => safeInvoke('skill-store:uninstall', skillKey)
    },

    // 应用控制
    app: {
        restart: () => safeInvoke('app:restart'),
        getApiStatus: () => safeInvoke('app:api-status')
    },

    // API 接口控制
    api: {
        toggle: (enabled: boolean) => safeInvoke('api:toggle', enabled),
        restart: () => safeInvoke('api:restart')
    },

    // 数据库加密
    db: {
        isEncrypted: () => safeInvoke('db:is-encrypted'),
        setEncryption: (password: string) => safeInvoke('db:set-encryption', password),
        removeEncryption: () => safeInvoke('db:remove-encryption')
    },

    // 网络请求监控（主进程 axios 请求转发到渲染进程 DevTools）
    network: {
        onEvent: (callback: (event: any) => void) => {
            ipcRenderer.on('network:event', (_event, data) => callback(data))
        },
        removeListener: () => {
            ipcRenderer.removeAllListeners('network:event')
        }
    }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
