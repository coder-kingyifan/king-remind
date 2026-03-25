import { getDatabase, saveDatabase } from './connection'

export interface NotificationLog {
  id: number
  reminder_id: number
  channel: string
  status: string
  error_message: string | null
  sent_at: string
  reminder_title?: string
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

export const reminderLogsDb = {
  create(reminderId: number, channel: string, status: string, errorMessage?: string): void {
    run(`
      INSERT INTO notification_logs (reminder_id, channel, status, error_message)
      VALUES (?, ?, ?, ?)
    `, [reminderId, channel, status, errorMessage || null])
  },

  getRecent(limit: number = 50): NotificationLog[] {
    return queryAll(`
      SELECT nl.*, r.title as reminder_title
      FROM notification_logs nl
      LEFT JOIN reminders r ON r.id = nl.reminder_id
      ORDER BY nl.sent_at DESC
      LIMIT ?
    `, [limit]) as NotificationLog[]
  },

  getByReminder(reminderId: number, limit: number = 20): NotificationLog[] {
    return queryAll(`
      SELECT * FROM notification_logs
      WHERE reminder_id = ?
      ORDER BY sent_at DESC
      LIMIT ?
    `, [reminderId, limit]) as NotificationLog[]
  },

  cleanup(daysToKeep: number = 30): void {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - daysToKeep)
    run("DELETE FROM notification_logs WHERE sent_at < ?", [cutoff.toISOString()])
  }
}
