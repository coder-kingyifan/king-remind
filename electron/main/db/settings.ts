import {getDatabase, saveDatabase} from './connection'

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

export const settingsDb = {
    getAll(): Record<string, string> {
        const rows = queryAll('SELECT key, value FROM settings')
        const result: Record<string, string> = {}
        for (const row of rows) {
            result[row.key] = row.value
        }
        return result
    },

    get(key: string): string | undefined {
        const row = queryOne('SELECT value FROM settings WHERE key = ?', [key])
        return row?.value
    },

    set(key: string, value: string): void {
        run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
    }
}
