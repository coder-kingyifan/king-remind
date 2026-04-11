import { getDatabase, saveDatabase } from './connection'

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

function run(sql: string, params: any[] = []): void {
  const db = getDatabase()
  db.run(sql, params)
  saveDatabase()
}

export const chatHistoryDb = {
  /** 加载所有消息 */
  load(): Array<{ role: string; content: string }> {
    const rows = queryAll('SELECT role, content FROM chat_messages ORDER BY id ASC')
    return rows.map(r => ({ role: r.role, content: r.content }))
  },

  /** 追加多条消息 */
  append(messages: Array<{ role: string; content: string }>): void {
    for (const m of messages) {
      run('INSERT INTO chat_messages (role, content) VALUES (?, ?)', [m.role, m.content])
    }
  },

  /** 清空聊天记录 */
  clear(): void {
    run('DELETE FROM chat_messages')
  },

  /** 获取消息数量 */
  count(): number {
    const rows = queryAll('SELECT COUNT(*) as c FROM chat_messages')
    return (rows[0]?.c || 0) as number
  }
}
