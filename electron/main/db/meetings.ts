import {getDatabase, saveDatabase} from './connection'

export interface MeetingRow {
    id: number
    title: string
    description: string
    meeting_type: string // regular | project | adhoc
    status: string // pending | ongoing | completed
    start_time: string
    end_time: string | null
    location: string
    participants: string // JSON array
    minutes: string
    ai_summary: string | null // JSON
    attachments: string // JSON array
    recording_path: string | null
    has_recording: number
    todo_ids: string // JSON array
    stt_text: string | null
    stt_status: string
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

export const meetingsDb = {
    list(filters?: {
        status?: string
        meeting_type?: string
        search?: string
        start_date?: string
        end_date?: string
    }): MeetingRow[] {
        let sql = 'SELECT * FROM meetings WHERE 1=1'
        const params: any[] = []

        if (filters?.status) {
            sql += ' AND status = ?'
            params.push(filters.status)
        }
        if (filters?.meeting_type) {
            sql += ' AND meeting_type = ?'
            params.push(filters.meeting_type)
        }
        if (filters?.search) {
            sql += ' AND (title LIKE ? OR description LIKE ? OR location LIKE ?)'
            params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`)
        }
        if (filters?.start_date) {
            sql += ' AND start_time >= ?'
            params.push(filters.start_date)
        }
        if (filters?.end_date) {
            sql += ' AND start_time <= ?'
            params.push(filters.end_date + ' 23:59:59')
        }

        sql += ' ORDER BY start_time DESC, created_at DESC'
        return queryAll(sql, params) as MeetingRow[]
    },

    get(id: number): MeetingRow | undefined {
        const rows = queryAll('SELECT * FROM meetings WHERE id = ?', [id]) as MeetingRow[]
        return rows[0]
    },

    create(data: {
        title: string
        description?: string
        meeting_type?: string
        status?: string
        start_time: string
        end_time?: string | null
        location?: string
        participants?: string[]
        minutes?: string
        attachments?: Array<{ name: string; path: string; type: string; size?: number }>
        recording_path?: string | null
        has_recording?: number
        todo_ids?: number[]
        stt_text?: string | null
        stt_status?: string
    }): MeetingRow {
        const db = getDatabase()

        run(`
            INSERT INTO meetings (title, description, meeting_type, status, start_time, end_time, location, participants, minutes, attachments, recording_path, has_recording, todo_ids, stt_text, stt_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            data.title,
            data.description || '',
            data.meeting_type || 'regular',
            data.status || 'pending',
            data.start_time,
            data.end_time || null,
            data.location || '',
            JSON.stringify(data.participants || []),
            data.minutes || '',
            JSON.stringify(data.attachments || []),
            data.recording_path || null,
            data.has_recording || 0,
            JSON.stringify(data.todo_ids || []),
            data.stt_text || null,
            data.stt_status || 'none'
        ])

        const idResult = db.exec('SELECT last_insert_rowid() as id')
        const id = idResult[0].values[0][0] as number
        saveDatabase()
        return meetingsDb.get(id)!
    },

    update(id: number, data: Partial<{
        title: string
        description: string
        meeting_type: string
        status: string
        start_time: string
        end_time: string | null
        location: string
        participants: string[]
        minutes: string
        ai_summary: any
        attachments: Array<{ name: string; path: string; type: string; size?: number }>
        recording_path: string | null
        has_recording: number
        todo_ids: number[]
        stt_text: string | null
        stt_status: string
    }>): MeetingRow | undefined {
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
        if (data.meeting_type !== undefined) {
            fields.push('meeting_type = ?');
            params.push(data.meeting_type)
        }
        if (data.status !== undefined) {
            fields.push('status = ?');
            params.push(data.status)
        }
        if (data.start_time !== undefined) {
            fields.push('start_time = ?');
            params.push(data.start_time)
        }
        if (data.end_time !== undefined) {
            fields.push('end_time = ?');
            params.push(data.end_time)
        }
        if (data.location !== undefined) {
            fields.push('location = ?');
            params.push(data.location)
        }
        if (data.participants !== undefined) {
            fields.push('participants = ?');
            params.push(JSON.stringify(data.participants))
        }
        if (data.minutes !== undefined) {
            fields.push('minutes = ?');
            params.push(data.minutes)
        }
        if (data.ai_summary !== undefined) {
            fields.push('ai_summary = ?');
            params.push(typeof data.ai_summary === 'string' ? data.ai_summary : JSON.stringify(data.ai_summary))
        }
        if (data.attachments !== undefined) {
            fields.push('attachments = ?');
            params.push(JSON.stringify(data.attachments))
        }
        if (data.recording_path !== undefined) {
            fields.push('recording_path = ?');
            params.push(data.recording_path)
        }
        if (data.has_recording !== undefined) {
            fields.push('has_recording = ?');
            params.push(data.has_recording)
        }
        if (data.todo_ids !== undefined) {
            fields.push('todo_ids = ?');
            params.push(JSON.stringify(data.todo_ids))
        }
        if (data.stt_text !== undefined) {
            fields.push('stt_text = ?');
            params.push(data.stt_text)
        }
        if (data.stt_status !== undefined) {
            fields.push('stt_status = ?');
            params.push(data.stt_status)
        }

        if (fields.length === 0) return meetingsDb.get(id)

        fields.push("updated_at = datetime('now','localtime')")
        params.push(id)

        run(`UPDATE meetings SET ${fields.join(', ')} WHERE id = ?`, params)
        return meetingsDb.get(id)
    },

    delete(id: number): void {
        run('DELETE FROM meetings WHERE id = ?', [id])
    },

    updateStatus(id: number, status: string): MeetingRow | undefined {
        return meetingsDb.update(id, {status})
    },

    stats(): { total: number; pending: number; ongoing: number; completed: number; today: number } {
        const db = getDatabase()
        const total = (db.exec('SELECT COUNT(*) FROM meetings')[0]?.values[0]?.[0] as number) || 0
        const pending = (db.exec("SELECT COUNT(*) FROM meetings WHERE status = 'pending'")[0]?.values[0]?.[0] as number) || 0
        const ongoing = (db.exec("SELECT COUNT(*) FROM meetings WHERE status = 'ongoing'")[0]?.values[0]?.[0] as number) || 0
        const completed = (db.exec("SELECT COUNT(*) FROM meetings WHERE status = 'completed'")[0]?.values[0]?.[0] as number) || 0
        const today = (db.exec("SELECT COUNT(*) FROM meetings WHERE date(start_time) = date('now','localtime')")[0]?.values[0]?.[0] as number) || 0
        return {total, pending, ongoing, completed, today}
    }
}
