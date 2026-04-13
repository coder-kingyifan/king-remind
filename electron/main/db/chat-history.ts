import {getDatabase, saveDatabase} from './connection'

function queryAll(sql: string, params: any[] = []): any[] {
    const db = getDatabase()
    const stmt = db.prepare(sql)
    if (params.length > 0) stmt.bind(params)
    const rows: any[] = []
    while (stmt.step()) {
        rows.push(stmt.getAsObject())
    }
    stmt.free()
    return JSON.parse(JSON.stringify(rows))
}

function queryOne(sql: string, params: any[] = []): any | undefined {
    return queryAll(sql, params)[0]
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

// ======================== 会话管理 ========================

export interface ChatSession {
    id: number
    title: string
    model_id: number | null
    created_at: string
    updated_at: string
}

export const chatHistoryDb = {
    // ---- 会话 CRUD ----

    createSession(title?: string, modelId?: number): ChatSession {
        const t = title || '新对话'
        run(
            'INSERT INTO chat_sessions (title, model_id) VALUES (?, ?)',
            [t, modelId ?? null]
        )
        const id = getLastInsertId()
        return queryOne('SELECT * FROM chat_sessions WHERE id = ?', [id]) as ChatSession
    },

    listSessions(): ChatSession[] {
        return queryAll('SELECT * FROM chat_sessions ORDER BY updated_at DESC, id DESC') as ChatSession[]
    },

    getSession(id: number): ChatSession | undefined {
        return queryOne('SELECT * FROM chat_sessions WHERE id = ?', [id]) as ChatSession | undefined
    },

    updateSessionTitle(id: number, title: string): void {
        run('UPDATE chat_sessions SET title = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?', [title, id])
    },

    deleteSession(id: number): void {
        run('DELETE FROM chat_messages WHERE session_id = ?', [id])
        run('DELETE FROM chat_sessions WHERE id = ?', [id])
    },

    // ---- 按会话加载消息 ----

    loadBySession(sessionId: number): Array<{ role: string; content: string; images?: string[]; created_at?: string }> {
        const rows = queryAll('SELECT role, content, images, created_at FROM chat_messages WHERE session_id = ? ORDER BY id ASC', [sessionId])
        return rows.map(r => ({
            role: r.role,
            content: r.content,
            images: r.images ? JSON.parse(r.images as string) : undefined,
            created_at: r.created_at
        }))
    },

    appendToSession(sessionId: number, messages: Array<{ role: string; content: string; images?: string[] }>): void {
        for (const m of messages) {
            const imagesJson = m.images ? JSON.stringify(m.images) : null
            run('INSERT INTO chat_messages (role, content, session_id, images) VALUES (?, ?, ?, ?)', [m.role, m.content, sessionId, imagesJson])
        }
        run('UPDATE chat_sessions SET updated_at = datetime(\'now\',\'localtime\') WHERE id = ?', [sessionId])
    },

    // ---- 旧接口（兼容） ----

    load(): Array<{ role: string; content: string }> {
        const rows = queryAll('SELECT role, content FROM chat_messages ORDER BY id ASC')
        return rows.map(r => ({role: r.role, content: r.content}))
    },

    append(messages: Array<{ role: string; content: string }>): void {
        for (const m of messages) {
            run('INSERT INTO chat_messages (role, content) VALUES (?, ?)', [m.role, m.content])
        }
    },

    clear(): void {
        run('DELETE FROM chat_messages')
        run('DELETE FROM chat_sessions')
    },

    count(): number {
        const rows = queryAll('SELECT COUNT(*) as c FROM chat_messages')
        return (rows[0]?.c || 0) as number
    },

    sessionCount(): number {
        const rows = queryAll('SELECT COUNT(*) as c FROM chat_sessions')
        return (rows[0]?.c || 0) as number
    }
}
