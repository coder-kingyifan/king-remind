import {getDatabase, saveDatabase} from './connection'

export interface Skill {
    id: number
    skill_key: string
    name: string
    description: string
    icon: string
    category: string
    action_type: string
    action_config: string
    config_schema: string
    user_config: string
    is_builtin: number
    is_enabled: number
    store_version: string | null
    store_source: string | null
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

function getLastInsertId(): number {
    const db = getDatabase()
    const result = db.exec('SELECT last_insert_rowid() as id')
    return result[0].values[0][0] as number
}

// 内置技能列表已清空，所有技能通过技能商店安装
export const BUILTIN_SKILLS: any[] = []

export function seedBuiltinSkills(): void {
    // 不再自动种子内置技能，用户通过技能商店安装
}

export const skillsDb = {
    list(filters?: { category?: string; is_enabled?: number; search?: string }): Skill[] {
        let sql = 'SELECT * FROM skills WHERE 1=1'
        const params: any[] = []

        if (filters?.category) {
            sql += ' AND category = ?'
            params.push(filters.category)
        }
        if (filters?.is_enabled !== undefined) {
            sql += ' AND is_enabled = ?'
            params.push(filters.is_enabled)
        }
        if (filters?.search) {
            sql += ' AND (name LIKE ? OR description LIKE ?)'
            params.push(`%${filters.search}%`, `%${filters.search}%`)
        }

        sql += ' ORDER BY is_builtin DESC, category, name'
        return queryAll(sql, params) as Skill[]
    },

    get(id: number): Skill | undefined {
        return queryOne('SELECT * FROM skills WHERE id = ?', [id]) as Skill | undefined
    },

    getByKey(key: string): Skill | undefined {
        return queryOne('SELECT * FROM skills WHERE skill_key = ?', [key]) as Skill | undefined
    },

    create(input: {
        name: string
        description?: string
        icon?: string
        category?: string
        action_type: string
        action_config: string
        config_schema?: string
        user_config?: string
    }): Skill {
        const skillKey = `custom_${Date.now()}`
        run(`INSERT INTO skills (skill_key, name, description, icon, category, action_type, action_config, config_schema, user_config, is_builtin, is_enabled)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`, [
            skillKey, input.name, input.description || '', input.icon || '⚡',
            input.category || 'custom', input.action_type, input.action_config,
            input.config_schema || '[]', input.user_config || '{}'
        ])
        const id = getLastInsertId()
        return this.get(id)!
    },

    createFromStore(input: {
        skill_key: string
        name: string
        description?: string
        icon?: string
        category?: string
        action_type: string
        action_config: string
        config_schema?: string
        user_config?: string
        is_builtin?: number
        store_version?: string
        store_source?: string
    }): Skill {
        run(`INSERT INTO skills (skill_key, name, description, icon, category, action_type, action_config, config_schema, user_config, is_builtin, is_enabled, store_version, store_source)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`, [
            input.skill_key, input.name, input.description || '', input.icon || '⚡',
            input.category || 'custom', input.action_type, input.action_config,
            input.config_schema || '[]', input.user_config || '{}',
            input.is_builtin ?? 0, input.store_version || null, input.store_source || null
        ])
        const id = getLastInsertId()
        return this.get(id)!
    },

    update(id: number, input: {
        name?: string
        description?: string
        icon?: string
        category?: string
        action_config?: string
        config_schema?: string
        user_config?: string
        is_enabled?: number
        store_version?: string
        store_source?: string
    }): Skill | undefined {
        const existing = this.get(id)
        if (!existing) return undefined

        run(`UPDATE skills SET
            name = ?, description = ?, icon = ?, category = ?,
            action_config = ?, config_schema = ?, user_config = ?, is_enabled = ?,
            store_version = ?, store_source = ?,
            updated_at = datetime('now', 'localtime')
            WHERE id = ?`, [
            input.name ?? existing.name,
            input.description ?? existing.description,
            input.icon ?? existing.icon,
            input.category ?? existing.category,
            input.action_config ?? existing.action_config,
            input.config_schema ?? existing.config_schema,
            input.user_config ?? existing.user_config,
            input.is_enabled !== undefined ? input.is_enabled : existing.is_enabled,
            input.store_version !== undefined ? input.store_version : existing.store_version,
            input.store_source !== undefined ? input.store_source : existing.store_source,
            id
        ])
        return this.get(id)
    },

    updateConfig(id: number, userConfig: string): Skill | undefined {
        const existing = this.get(id)
        if (!existing) return undefined

        run(`UPDATE skills SET user_config = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`, [userConfig, id])
        return this.get(id)
    },

    delete(id: number): boolean {
        const existing = this.get(id)
        if (!existing) return false
        run('DELETE FROM skills WHERE id = ?', [id])
        return true
    },

    toggleEnabled(id: number): Skill | undefined {
        const existing = this.get(id)
        if (!existing) return undefined
        run('UPDATE skills SET is_enabled = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?', [existing.is_enabled ? 0 : 1, id])
        return this.get(id)
    },

    getEnabled(): Skill[] {
        return queryAll('SELECT * FROM skills WHERE is_enabled = 1 ORDER BY category, name') as Skill[]
    }
}
