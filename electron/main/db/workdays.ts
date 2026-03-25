import { getDatabase, saveDatabase } from './connection'
import { isWorkday as chineseDaysIsWorkday } from 'chinese-days'

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

export const workdaysDb = {
  /**
   * 导入工作日数据
   * holidays: 法定节假日列表（这些天不上班）
   * extraWorkdays: 调休补班日列表（这些天虽然是周末但要上班）
   */
  import(holidays: string[], extraWorkdays: string[]): { imported: number } {
    let count = 0
    for (const date of holidays) {
      run('INSERT OR REPLACE INTO workdays (date, is_workday) VALUES (?, 0)', [date])
      count++
    }
    for (const date of extraWorkdays) {
      run('INSERT OR REPLACE INTO workdays (date, is_workday) VALUES (?, 1)', [date])
      count++
    }
    return { imported: count }
  },

  /**
   * 检查某天是否是工作日
   * 优先使用 chinese-days 包判断（包含法定节假日和调休数据）
   * 如果 chinese-days 无数据，回退到数据库查表
   * 最终回退到周一到周五为工作日的默认逻辑
   */
  isWorkday(dateStr: string): boolean {
    // 优先使用 chinese-days 包（内置中国法定节假日+调休数据）
    try {
      return chineseDaysIsWorkday(dateStr)
    } catch {
      // chinese-days 不支持的年份，回退到数据库查表
    }

    const row = queryAll('SELECT is_workday FROM workdays WHERE date = ?', [dateStr])
    if (row.length > 0) {
      return row[0].is_workday === 1
    }
    // 默认：周一(1)到周五(5)是工作日
    const day = new Date(dateStr).getDay()
    return day >= 1 && day <= 5
  },

  /** 获取指定年份的所有工作日配置 */
  getByYear(year: number): Array<{ date: string; is_workday: number }> {
    return queryAll(
      "SELECT * FROM workdays WHERE date >= ? AND date <= ? ORDER BY date",
      [`${year}-01-01`, `${year}-12-31`]
    )
  },

  /** 获取所有记录数 */
  count(): number {
    const db = getDatabase()
    const result = db.exec('SELECT COUNT(*) as count FROM workdays')
    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0] as number
    }
    return 0
  },

  /** 清空所有工作日数据 */
  clear(): void {
    run('DELETE FROM workdays')
  }
}
