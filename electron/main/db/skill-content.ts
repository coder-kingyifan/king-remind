import {getDatabase, saveDatabase} from './connection'

export interface SkillContent {
    id: number
    skill_key: string
    category: string
    content: string
    extra: string
    created_at: string
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

export const skillContentDb = {
    list(skillKey: string, category?: string): SkillContent[] {
        let sql = 'SELECT * FROM skill_content WHERE skill_key = ?'
        const params: any[] = [skillKey]
        if (category) {
            sql += ' AND category = ?'
            params.push(category)
        }
        sql += ' ORDER BY id'
        return queryAll(sql, params) as SkillContent[]
    },

    randomPick(skillKey: string, category?: string): SkillContent | undefined {
        let sql = 'SELECT * FROM skill_content WHERE skill_key = ?'
        const params: any[] = [skillKey]
        if (category) {
            sql += ' AND category = ?'
            params.push(category)
        }
        sql += ' ORDER BY RANDOM() LIMIT 1'
        const rows = queryAll(sql, params)
        return rows[0] as SkillContent | undefined
    },

    /** 随机取一条，支持多个 category（用 OR 匹配） */
    randomPickMultiCategory(skillKey: string, categories: string[]): SkillContent | undefined {
        if (categories.length === 0) return this.randomPick(skillKey)
        const placeholders = categories.map(() => '?').join(',')
        const sql = `SELECT * FROM skill_content WHERE skill_key = ? AND category IN (${placeholders}) ORDER BY RANDOM() LIMIT 1`
        const params = [skillKey, ...categories]
        const rows = queryAll(sql, params)
        return rows[0] as SkillContent | undefined
    },

    add(skillKey: string, category: string, content: string, extra?: Record<string, any>): SkillContent {
        const extraStr = extra ? JSON.stringify(extra) : '{}'
        run('INSERT INTO skill_content (skill_key, category, content, extra) VALUES (?, ?, ?, ?)',
            [skillKey, category, content, extraStr])
        const id = getLastInsertId()
        return queryAll('SELECT * FROM skill_content WHERE id = ?', [id])[0] as SkillContent
    },

    delete(id: number): boolean {
        const existing = queryAll('SELECT id FROM skill_content WHERE id = ?', [id])
        if (existing.length === 0) return false
        run('DELETE FROM skill_content WHERE id = ?', [id])
        return true
    },

    count(skillKey: string, category?: string): number {
        let sql = 'SELECT COUNT(*) as cnt FROM skill_content WHERE skill_key = ?'
        const params: any[] = [skillKey]
        if (category) {
            sql += ' AND category = ?'
            params.push(category)
        }
        const rows = queryAll(sql, params)
        return (rows[0] as any)?.cnt || 0
    }
}

// ======================== Seed Data ========================

/** 初始化技能内容数据（仅当表为空时写入）- 已移除内置技能种子数据 */
export function seedSkillContent(): void {
    // 内置技能种子数据已移除，所有技能通过技能商店安装
}
