import initSqlJs, {Database as SqlJsDatabase} from 'sql.js'
import {app} from 'electron'
import {dirname, join} from 'path'
import {existsSync, readFileSync, writeFileSync} from 'fs'

let db: SqlJsDatabase | null = null
let dbPath: string = ''
let saveTimer: NodeJS.Timeout | null = null

export async function initDatabase(): Promise<SqlJsDatabase> {
    if (db) return db

    console.log('[数据库] 正在加载 sql.js...')

    // 查找 sql-wasm.wasm 文件路径
    // 在开发模式和打包后都需要正确定位
    let wasmPath: string
    const possiblePaths = [
        join(dirname(require.resolve('sql.js')), 'sql-wasm.wasm'),
        join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm'),
        join(app.getAppPath(), 'node_modules/sql.js/dist/sql-wasm.wasm')
    ]

    wasmPath = possiblePaths.find(p => existsSync(p)) || possiblePaths[0]
    console.log('[数据库] WASM路径:', wasmPath, '存在:', existsSync(wasmPath))

    let SQL: Awaited<ReturnType<typeof initSqlJs>>
    if (existsSync(wasmPath)) {
        const wasmBinary = readFileSync(wasmPath)
        SQL = await initSqlJs({wasmBinary})
    } else {
        // 回退：让 sql.js 自己查找
        SQL = await initSqlJs()
    }
    console.log('[数据库] sql.js 加载成功')

    // 数据库路径：优先使用环境变量，其次使用当前运行目录
    const dbDir = process.env['DB_DIR'] || process.cwd()
    dbPath = join(dbDir, 'remind.db')
    console.log('[数据库] 路径:', dbPath)

    if (existsSync(dbPath)) {
        console.log('[数据库] 读取已有数据库文件')
        const buffer = readFileSync(dbPath)
        db = new SQL.Database(buffer)
    } else {
        console.log('[数据库] 创建新数据库')
        db = new SQL.Database()
    }

    // 开启 WAL 模式
    db.run('PRAGMA journal_mode = WAL')
    db.run('PRAGMA foreign_keys = ON')

    console.log('[数据库] 初始化完成')
    return db
}

export function getDatabase(): SqlJsDatabase {
    if (!db) {
        throw new Error('数据库尚未初始化，请先调用 initDatabase()')
    }
    return db
}

// 保存数据库到磁盘（防抖，避免频繁写入）
export function saveDatabase(): void {
    if (!db) return

    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
        try {
            const data = db!.export()
            const buffer = Buffer.from(data)
            writeFileSync(dbPath, buffer)
        } catch (err) {
            console.error('[数据库] 保存失败:', err)
        }
    }, 1000)
}

// 立即保存并关闭数据库
export function closeDatabase(): void {
    if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
    }
    if (db) {
        try {
            const data = db.export()
            const buffer = Buffer.from(data)
            writeFileSync(dbPath, buffer)
        } catch (err) {
            console.error('[数据库] 关闭时保存失败:', err)
        }
        db.close()
        db = null
    }
}
