import {getDatabase, saveDatabase} from './connection'

export interface NotificationConfig {
    id: number
    channel: string
    is_enabled: number
    config_json: string
    created_at: string
    updated_at: string
}

function toPlain<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj))
}

function queryAll(sql: string, params: any[] = []): any[] {
    const db = getDatabase()
    const stmt = db.prepare(sql)
    if (params.length > 0) stmt.bind(params)
    const rows: any[] = []
    while (stmt.step()) {
        rows.push(stmt.getAsObject())
    }
    stmt.free()
    return toPlain(rows)
}

function queryOne(sql: string, params: any[] = []): any | undefined {
    const rows = queryAll(sql, params)
    return rows[0]
}

function run(sql: string, params: any[] = []): void {
    const db = getDatabase()
    db.run(sql, params)
    saveDatabase()
}

export const notificationConfigsDb = {
    getAll(): NotificationConfig[] {
        return queryAll('SELECT * FROM notification_configs ORDER BY id') as NotificationConfig[]
    },

    getByChannel(channel: string): NotificationConfig | undefined {
        return queryOne('SELECT * FROM notification_configs WHERE channel = ?', [channel]) as NotificationConfig | undefined
    },

    update(channel: string, data: { is_enabled?: number; config_json?: string }): NotificationConfig | undefined {
        const existing = this.getByChannel(channel)
        if (!existing) return undefined

        const isEnabled = data.is_enabled !== undefined ? data.is_enabled : existing.is_enabled
        const configJson = data.config_json !== undefined ? data.config_json : existing.config_json

        run(`
      UPDATE notification_configs SET
        is_enabled = ?, config_json = ?,
        updated_at = datetime('now', 'localtime')
      WHERE channel = ?
    `, [isEnabled, configJson, channel])

        return this.getByChannel(channel)
    },

    isChannelEnabled(channel: string): boolean {
        const config = this.getByChannel(channel)
        return config ? config.is_enabled === 1 : false
    },

    getChannelConfig(channel: string): Record<string, any> {
        const config = this.getByChannel(channel)
        if (!config) return {}
        try {
            return JSON.parse(config.config_json)
        } catch {
            return {}
        }
    }
}
