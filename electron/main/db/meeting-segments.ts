import {getDatabase, saveDatabase} from './connection'

export interface MeetingSegmentRow {
    id: number
    meeting_id: number
    segment_type: 'text' | 'audio'
    content: string
    speaker: string
    sort_order: number
    start_time: number  // 秒，相对于录音开始
    end_time: number    // 秒，相对于录音开始
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

export const meetingSegmentsDb = {
    listByMeeting(meetingId: number): MeetingSegmentRow[] {
        return queryAll(
            'SELECT * FROM meeting_segments WHERE meeting_id = ? ORDER BY sort_order ASC, id ASC',
            [meetingId]
        ) as MeetingSegmentRow[]
    },

    add(data: {
        meeting_id: number
        segment_type: 'text' | 'audio'
        content: string
        speaker?: string
        sort_order?: number
        start_time?: number
        end_time?: number
    }): MeetingSegmentRow {
        const db = getDatabase()
        run(`
            INSERT INTO meeting_segments (meeting_id, segment_type, content, speaker, sort_order, start_time, end_time)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            data.meeting_id,
            data.segment_type,
            data.content,
            data.speaker || '',
            data.sort_order || 0,
            data.start_time || 0,
            data.end_time || 0
        ])
        const idResult = db.exec('SELECT last_insert_rowid() as id')
        const id = idResult[0].values[0][0] as number
        saveDatabase()
        const rows = queryAll('SELECT * FROM meeting_segments WHERE id = ?', [id]) as MeetingSegmentRow[]
        return rows[0]
    },

    addBatch(segments: Array<{
        meeting_id: number
        segment_type: 'text' | 'audio'
        content: string
        speaker?: string
        sort_order?: number
        start_time?: number
        end_time?: number
    }>): MeetingSegmentRow[] {
        const results: MeetingSegmentRow[] = []
        for (let i = 0; i < segments.length; i++) {
            const s = segments[i]
            results.push(meetingSegmentsDb.add({
                ...s,
                sort_order: s.sort_order ?? i
            }))
        }
        return results
    },

    update(id: number, data: Partial<{
        segment_type: 'text' | 'audio'
        content: string
        speaker: string
        sort_order: number
        start_time: number
        end_time: number
    }>): MeetingSegmentRow | undefined {
        const fields: string[] = []
        const params: any[] = []
        if (data.segment_type !== undefined) { fields.push('segment_type = ?'); params.push(data.segment_type) }
        if (data.content !== undefined) { fields.push('content = ?'); params.push(data.content) }
        if (data.speaker !== undefined) { fields.push('speaker = ?'); params.push(data.speaker) }
        if (data.sort_order !== undefined) { fields.push('sort_order = ?'); params.push(data.sort_order) }
        if (data.start_time !== undefined) { fields.push('start_time = ?'); params.push(data.start_time) }
        if (data.end_time !== undefined) { fields.push('end_time = ?'); params.push(data.end_time) }
        if (fields.length === 0) return undefined
        params.push(id)
        run(`UPDATE meeting_segments SET ${fields.join(', ')} WHERE id = ?`, params)
        const rows = queryAll('SELECT * FROM meeting_segments WHERE id = ?', [id]) as MeetingSegmentRow[]
        return rows[0]
    },

    delete(id: number): void {
        run('DELETE FROM meeting_segments WHERE id = ?', [id])
    },

    deleteByMeeting(meetingId: number): void {
        run('DELETE FROM meeting_segments WHERE meeting_id = ?', [meetingId])
    },

    reorder(meetingId: number, orderedIds: number[]): void {
        for (let i = 0; i < orderedIds.length; i++) {
            run('UPDATE meeting_segments SET sort_order = ? WHERE id = ? AND meeting_id = ?', [i, orderedIds[i], meetingId])
        }
    }
}
