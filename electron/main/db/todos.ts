import {getDatabase, saveDatabase} from './connection'

export interface TodoRow {
    id: number
    title: string
    description: string
    completed: number
    priority: string
    due_date: string | null
    category: string
    images: string
    sort_order: number
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

function run(sql: string, params: any[] = []): void {
    const db = getDatabase()
    db.run(sql, params)
    saveDatabase()
}

// 优先级排序权重：urgent=4, high=3, normal=2, low=1
const PRIORITY_ORDER = `
    CASE priority
        WHEN 'urgent' THEN 4
        WHEN 'high' THEN 3
        WHEN 'normal' THEN 2
        WHEN 'low' THEN 1
        ELSE 2
    END DESC
`

export const todosDb = {
    list(filters?: { completed?: number; category?: string; search?: string }): TodoRow[] {
        let sql = 'SELECT * FROM todos WHERE 1=1'
        const params: any[] = []

        if (filters?.completed !== undefined) {
            sql += ' AND completed = ?'
            params.push(filters.completed)
        }
        if (filters?.category) {
            sql += ' AND category = ?'
            params.push(filters.category)
        }
        if (filters?.search) {
            sql += ' AND title LIKE ?'
            params.push(`%${filters.search}%`)
        }

        // 优先级高的排最上面，同优先级按创建时间倒序
        sql += ` ORDER BY completed ASC, ${PRIORITY_ORDER}, created_at DESC`
        return queryAll(sql, params) as TodoRow[]
    },

    get(id: number): TodoRow | undefined {
        const rows = queryAll('SELECT * FROM todos WHERE id = ?', [id]) as TodoRow[]
        return rows[0]
    },

    create(data: {
        title: string
        description?: string
        priority?: string
        due_date?: string | null
        category?: string
        images?: string[]
    }): TodoRow {
        const db = getDatabase()
        const nextOrder = 1

        run(`
            INSERT INTO todos (title, description, priority, due_date, category, images, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            data.title,
            data.description || '',
            data.priority || 'normal',
            data.due_date || null,
            data.category || '',
            JSON.stringify(data.images || []),
            nextOrder
        ])

        const idResult = db.exec('SELECT last_insert_rowid() as id')
        const id = idResult[0].values[0][0] as number
        saveDatabase()
        return todosDb.get(id)!
    },

    update(id: number, data: Partial<{
        title: string
        description: string
        completed: number
        priority: string
        due_date: string | null
        category: string
        images: string[]
        sort_order: number
    }>): TodoRow | undefined {
        const fields: string[] = []
        const params: any[] = []

        if (data.title !== undefined) {
            fields.push('title = ?');
            params.push(data.title)
        }
        if (data.description !== undefined) {
            fields.push('description = ?');
            params.push(data.description)
        }
        if (data.completed !== undefined) {
            fields.push('completed = ?');
            params.push(data.completed)
        }
        if (data.priority !== undefined) {
            fields.push('priority = ?');
            params.push(data.priority)
        }
        if (data.due_date !== undefined) {
            fields.push('due_date = ?');
            params.push(data.due_date)
        }
        if (data.category !== undefined) {
            fields.push('category = ?');
            params.push(data.category)
        }
        if (data.images !== undefined) {
            fields.push('images = ?');
            params.push(JSON.stringify(data.images))
        }
        if (data.sort_order !== undefined) {
            fields.push('sort_order = ?');
            params.push(data.sort_order)
        }

        if (fields.length === 0) return todosDb.get(id)

        fields.push("updated_at = datetime('now','localtime')")
        params.push(id)

        run(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`, params)
        return todosDb.get(id)
    },

    delete(id: number): void {
        run('DELETE FROM todos WHERE id = ?', [id])
    },

    toggle(id: number): TodoRow | undefined {
        const todo = todosDb.get(id)
        if (!todo) return undefined
        const newCompleted = todo.completed === 1 ? 0 : 1
        return todosDb.update(id, {completed: newCompleted})
    },

    stats(): { total: number; completed: number; pending: number; overdue: number } {
        const db = getDatabase()
        const total = (db.exec('SELECT COUNT(*) FROM todos')[0]?.values[0]?.[0] as number) || 0
        const completed = (db.exec('SELECT COUNT(*) FROM todos WHERE completed = 1')[0]?.values[0]?.[0] as number) || 0
        const overdue = (db.exec("SELECT COUNT(*) FROM todos WHERE completed = 0 AND due_date IS NOT NULL AND due_date < date('now','localtime')")[0]?.values[0]?.[0] as number) || 0
        return {total, completed, pending: total - completed, overdue}
    }
}
