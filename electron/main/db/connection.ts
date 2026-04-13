import initSqlJs, {Database as SqlJsDatabase} from 'sql.js'
import {app} from 'electron'
import {dirname, join} from 'path'
import {existsSync, readFileSync, unlinkSync, writeFileSync} from 'fs'
import {createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes} from 'crypto'

let db: SqlJsDatabase | null = null
let dbPath: string = ''
let encryptionPassword: string = ''
let saveTimer: NodeJS.Timeout | null = null

// AES-256-GCM constants
const SALT_LENGTH = 32
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const PBKDF2_ITERATIONS = 100000
const KEY_FILE = 'remind.key'

// ======================== Encryption helpers ========================

function deriveKey(password: string, salt: Buffer): Buffer {
    return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256')
}

function encryptBuffer(buffer: Buffer, password: string): Buffer {
    const salt = randomBytes(SALT_LENGTH)
    const key = deriveKey(password, salt)
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
    const authTag = cipher.getAuthTag()
    // Layout: salt(32) + iv(16) + authTag(16) + ciphertext
    return Buffer.concat([salt, iv, authTag, encrypted])
}

function decryptBuffer(buffer: Buffer, password: string): Buffer {
    const salt = buffer.subarray(0, SALT_LENGTH)
    const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const authTag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH)
    const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH)
    const key = deriveKey(password, salt)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(encrypted), decipher.final()])
}

function hashPassword(password: string): string {
    const salt = randomBytes(16)
    const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256')
    return salt.toString('hex') + ':' + hash.toString('hex')
}

function verifyPasswordHash(password: string, stored: string): boolean {
    const [saltHex, hashHex] = stored.split(':')
    const salt = Buffer.from(saltHex, 'hex')
    const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256')
    return hash.toString('hex') === hashHex
}

function getDbDir(): string {
    return process.env['DB_DIR'] || process.cwd()
}

function getEncryptedPath(): string {
    return dbPath + '.enc'
}

function getKeyFilePath(): string {
    return join(getDbDir(), KEY_FILE)
}

// ======================== Public encryption API ========================

export function isDatabaseEncrypted(): boolean {
    const dbDir = getDbDir()
    const encPath = join(dbDir, 'remind.db.enc')
    return existsSync(encPath)
}

export function setEncryptionPassword(password: string | null): void {
    if (password) {
        encryptionPassword = password
        // Save password hash for verification on next launch
        writeFileSync(getKeyFilePath(), hashPassword(password))
    } else {
        encryptionPassword = ''
    }
}

export function verifyEncryptionPassword(password: string): boolean {
    const keyFilePath = getKeyFilePath()
    if (!existsSync(keyFilePath)) return false
    const stored = readFileSync(keyFilePath, 'utf-8').trim()
    return verifyPasswordHash(password, stored)
}

/** Remove encryption: decrypt and save as plain .db, remove .enc and .key files */
export function removeEncryption(): void {
    if (!encryptionPassword) return
    // Save as plain .db
    if (db) {
        const data = db.export()
        const buffer = Buffer.from(data)
        writeFileSync(dbPath, buffer)
    }
    // Remove encrypted file
    const encPath = getEncryptedPath()
    if (existsSync(encPath)) {
        unlinkSync(encPath)
    }
    // Remove key file
    const keyFilePath = getKeyFilePath()
    if (existsSync(keyFilePath)) {
        unlinkSync(keyFilePath)
    }
    encryptionPassword = ''
}

// ======================== Database lifecycle ========================

export async function initDatabase(): Promise<SqlJsDatabase> {
    if (db) return db

    console.log('[数据库] 正在加载 sql.js...')

    // 查找 sql-wasm.wasm 文件路径
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
        SQL = await initSqlJs()
    }
    console.log('[数据库] sql.js 加载成功')

    // 数据库路径
    const customDbDir = process.env['DB_DIR']
    if (customDbDir) {
        dbPath = join(customDbDir, 'remind.db')
    } else {
        dbPath = join(process.cwd(), 'remind.db')
    }
    console.log('[数据库] 路径:', dbPath)

    const encPath = getEncryptedPath()

    if (existsSync(encPath)) {
        // Encrypted database - need password
        if (!encryptionPassword) {
            throw new Error('ENCRYPTION_PASSWORD_REQUIRED')
        }
        console.log('[数据库] 读取加密数据库文件')
        const encBuffer = readFileSync(encPath)
        const decBuffer = decryptBuffer(encBuffer, encryptionPassword)
        db = new SQL.Database(decBuffer)
    } else if (existsSync(dbPath)) {
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
        doSave()
    }, 1000)
}

// 立即保存并关闭数据库
export function closeDatabase(): void {
    if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
    }
    if (db) {
        doSave()
        db.close()
        db = null
    }
}

function doSave(): void {
    if (!db) return
    try {
        const data = db.export()
        const buffer = Buffer.from(data)

        if (encryptionPassword) {
            // Encrypt and write to .enc file
            const encrypted = encryptBuffer(buffer, encryptionPassword)
            writeFileSync(getEncryptedPath(), encrypted)
            // Remove the plain .db file for security
            if (existsSync(dbPath)) {
                unlinkSync(dbPath)
            }
        } else {
            writeFileSync(dbPath, buffer)
        }
    } catch (err) {
        console.error('[数据库] 保存失败:', err)
    }
}
