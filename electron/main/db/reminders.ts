import {getDatabase, saveDatabase} from './connection'

export interface Reminder {
    id: number
    title: string
    description: string
    icon: string
    color: string
    remind_type: 'interval' | 'scheduled'
    interval_value: number
    interval_unit: 'minutes' | 'hours' | 'days' | 'months' | 'years'
    weekdays: string | null
    workday_only: number
    holiday_only: number
    lunar_date: string | null
    start_time: string
    end_time: string | null
    active_hours_start: string | null
    active_hours_end: string | null
    channels: string
    skill_id: number | null
    is_active: number
    last_triggered_at: string | null
    next_trigger_at: string | null
    created_at: string
    updated_at: string
}

export interface CreateReminderInput {
    title: string
    description?: string
    icon?: string
    color?: string
    remind_type: 'interval' | 'scheduled'
    interval_value?: number
    interval_unit?: 'minutes' | 'hours' | 'days' | 'months' | 'years'
    weekdays?: number[] | null
    workday_only?: number
    holiday_only?: number
    lunar_date?: string | null
    start_time: string
    end_time?: string | null
    active_hours_start?: string | null
    active_hours_end?: string | null
    channels: string[]
    skill_id?: number | null
}

function getLocalDateStr(date: Date = new Date()): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

function getLocalDateTimeStr(date: Date = new Date()): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    const s = String(date.getSeconds()).padStart(2, '0')
    return `${y}-${m}-${d}T${h}:${min}:${s}`
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

function addInterval(date: Date, value: number, unit: string): Date {
    const result = new Date(date)
    switch (unit) {
        case 'minutes':
            result.setMinutes(result.getMinutes() + value)
            break
        case 'hours':
            result.setHours(result.getHours() + value)
            break
        case 'days':
            result.setDate(result.getDate() + value)
            break
        case 'months':
            result.setMonth(result.getMonth() + value)
            break
        case 'years':
            result.setFullYear(result.getFullYear() + value)
            break
    }
    return result
}

function calculateNextTrigger(startTime: string, intervalValue: number, intervalUnit: string): string {
    const now = new Date()
    let next = new Date(startTime)

    if (next <= now) {
        // 对于简单时间单位，用毫秒计算
        if (['minutes', 'hours', 'days'].includes(intervalUnit)) {
            const multipliers: Record<string, number> = {
                minutes: 60 * 1000,
                hours: 60 * 60 * 1000,
                days: 24 * 60 * 60 * 1000
            }
            const intervalMs = intervalValue * multipliers[intervalUnit]
            const elapsed = now.getTime() - next.getTime()
            const periods = Math.ceil(elapsed / intervalMs)
            next = new Date(next.getTime() + periods * intervalMs)
        } else {
            // months / years 需要逐步推进
            while (next <= now) {
                next = addInterval(next, intervalValue, intervalUnit)
            }
        }
    }

    return getLocalDateTimeStr(next)
}

function getLastInsertId(): number {
    const db = getDatabase()
    const result = db.exec('SELECT last_insert_rowid() as id')
    return result[0].values[0][0] as number
}

export const remindersDb = {
    list(filters?: { is_active?: number; search?: string }): Reminder[] {
        let sql = 'SELECT * FROM reminders WHERE 1=1'
        const params: any[] = []

        if (filters?.is_active !== undefined) {
            sql += ' AND is_active = ?'
            params.push(filters.is_active)
        }
        if (filters?.search) {
            sql += ' AND (title LIKE ? OR description LIKE ?)'
            params.push(`%${filters.search}%`, `%${filters.search}%`)
        }

        sql += ' ORDER BY created_at DESC'
        return queryAll(sql, params) as Reminder[]
    },

    get(id: number): Reminder | undefined {
        return queryOne('SELECT * FROM reminders WHERE id = ?', [id]) as Reminder | undefined
    },

    create(input: CreateReminderInput): Reminder {
        const remindType = input.remind_type || 'interval'
        const intervalValue = input.interval_value || 60
        const intervalUnit = input.interval_unit || 'minutes'

        let nextTrigger: string
        if (remindType === 'scheduled') {
            nextTrigger = getLocalDateTimeStr(new Date(input.start_time))
        } else {
            nextTrigger = calculateNextTrigger(input.start_time, intervalValue, intervalUnit)
        }

        const weekdays = input.weekdays ? JSON.stringify(input.weekdays) : null
        const workdayOnly = input.workday_only || 0
        const holidayOnly = input.holiday_only || 0
        const lunarDate = input.lunar_date || null

        run(`
      INSERT INTO reminders (title, description, icon, color, remind_type, interval_value, interval_unit,
        weekdays, workday_only, holiday_only, lunar_date, start_time, end_time, active_hours_start, active_hours_end, channels, skill_id, next_trigger_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            input.title,
            input.description || '',
            input.icon || '🔔',
            input.color || '#409EFF',
            remindType,
            intervalValue,
            intervalUnit,
            weekdays,
            workdayOnly,
            holidayOnly,
            lunarDate,
            input.start_time,
            input.end_time || null,
            input.active_hours_start || null,
            input.active_hours_end || null,
            JSON.stringify(input.channels),
            input.skill_id || null,
            nextTrigger
        ])

        const id = getLastInsertId()
        return this.get(id)!
    },

    update(id: number, input: Partial<CreateReminderInput>): Reminder | undefined {
        const existing = this.get(id)
        if (!existing) return undefined

        const title = input.title ?? existing.title
        const description = input.description ?? existing.description
        const icon = input.icon ?? existing.icon
        const color = input.color ?? existing.color
        const remindType = input.remind_type ?? existing.remind_type
        const intervalValue = input.interval_value ?? existing.interval_value
        const intervalUnit = input.interval_unit ?? existing.interval_unit
        const startTime = input.start_time ?? existing.start_time
        const endTime = input.end_time !== undefined ? input.end_time : existing.end_time
        const activeHoursStart = input.active_hours_start !== undefined ? input.active_hours_start : existing.active_hours_start
        const activeHoursEnd = input.active_hours_end !== undefined ? input.active_hours_end : existing.active_hours_end
        const channels = input.channels ? JSON.stringify(input.channels) : existing.channels
        const weekdays = input.weekdays !== undefined ? (input.weekdays ? JSON.stringify(input.weekdays) : null) : existing.weekdays
        const workdayOnly = input.workday_only !== undefined ? input.workday_only : existing.workday_only
        const holidayOnly = input.holiday_only !== undefined ? input.holiday_only : (existing.holiday_only || 0)
        const lunarDate = input.lunar_date !== undefined ? input.lunar_date : (existing.lunar_date || null)
        const skillId = input.skill_id !== undefined ? input.skill_id : existing.skill_id

        let nextTrigger: string
        if (remindType === 'scheduled') {
            nextTrigger = getLocalDateTimeStr(new Date(startTime))
        } else {
            nextTrigger = calculateNextTrigger(startTime, intervalValue, intervalUnit)
        }

        run(`
      UPDATE reminders SET
        title = ?, description = ?, icon = ?, color = ?, remind_type = ?,
        interval_value = ?, interval_unit = ?, weekdays = ?, workday_only = ?,
        holiday_only = ?, lunar_date = ?,
        start_time = ?, end_time = ?,
        active_hours_start = ?, active_hours_end = ?,
        channels = ?, skill_id = ?, next_trigger_at = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [
            title, description, icon, color, remindType,
            intervalValue, intervalUnit, weekdays, workdayOnly,
            holidayOnly, lunarDate,
            startTime, endTime,
            activeHoursStart, activeHoursEnd,
            channels, skillId, nextTrigger, id
        ])

        return this.get(id)
    },

    delete(id: number): boolean {
        const before = queryOne('SELECT COUNT(*) as c FROM reminders WHERE id = ?', [id])
        run('DELETE FROM reminders WHERE id = ?', [id])
        return (before?.c || 0) > 0
    },

    toggleActive(id: number): Reminder | undefined {
        const existing = this.get(id)
        if (!existing) return undefined

        const newActive = existing.is_active ? 0 : 1
        let nextTrigger = existing.next_trigger_at

        if (newActive === 1) {
            if (existing.remind_type === 'scheduled') {
                nextTrigger = getLocalDateTimeStr(new Date(existing.start_time))
            } else {
                nextTrigger = calculateNextTrigger(existing.start_time, existing.interval_value, existing.interval_unit)
            }
        }

        run(`
      UPDATE reminders SET is_active = ?, next_trigger_at = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [newActive, nextTrigger, id])

        return this.get(id)
    },

    getDueReminders(): Reminder[] {
        const now = getLocalDateTimeStr()
        return queryAll(`
      SELECT * FROM reminders
      WHERE is_active = 1
        AND next_trigger_at <= ?
        AND (end_time IS NULL OR end_time > ?)
    `, [now, now]) as Reminder[]
    },

    updateAfterTrigger(id: number, nextTriggerAt: string | null): void {
        if (nextTriggerAt === null) {
            run(`
        UPDATE reminders SET
          last_triggered_at = datetime('now', 'localtime'),
          is_active = 0,
          updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `, [id])
        } else {
            run(`
        UPDATE reminders SET
          last_triggered_at = datetime('now', 'localtime'),
          next_trigger_at = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `, [nextTriggerAt, id])
        }
    },

    getTodayStats(): { total: number; active: number; triggeredToday: number } {
        const total = (queryOne('SELECT COUNT(*) as count FROM reminders') as any)?.count || 0
        const active = (queryOne('SELECT COUNT(*) as count FROM reminders WHERE is_active = 1') as any)?.count || 0
        const today = getLocalDateStr()
        const triggeredToday = (queryOne(
            "SELECT COUNT(DISTINCT reminder_id) as count FROM notification_logs WHERE sent_at >= ?", [today]
        ) as any)?.count || 0

        return {total, active, triggeredToday}
    }
}
