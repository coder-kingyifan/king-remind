import initSqlJs, {Database as SqlJsDatabase} from 'sql.js'
import {app} from 'electron'
import {dirname, join} from 'path'
import {copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync} from 'fs'
import {createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes} from 'crypto'

let db: SqlJsDatabase | null = null
let dbPath: string = ''
let encryptionPassword: string = ''
let saveTimer: NodeJS.Timeout | null = null

const DB_FILE = 'remind.db'
const KEY_FILE = 'remind.key'
const SALT_LENGTH = 32
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const PBKDF2_ITERATIONS = 100000

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

function getDbDir(): string {
    return process.env['DB_DIR'] || app.getPath('userData')
}

function getLegacyDbDir(): string {
    return process.cwd()
}

function isUsingCustomDbDir(): boolean {
    return Boolean(process.env['DB_DIR'])
}

function ensureDbDir(): void {
    mkdirSync(getDbDir(), {recursive: true})
}

function getDbFilePath(dbDir = getDbDir()): string {
    return join(dbDir, DB_FILE)
}

function getEncryptedFilePath(dbDir = getDbDir()): string {
    return join(dbDir, `${DB_FILE}.enc`)
}

function getKeyFilePath(dbDir = getDbDir()): string {
    return join(dbDir, KEY_FILE)
}

function getEncryptedPath(): string {
    return dbPath ? `${dbPath}.enc` : getEncryptedFilePath()
}

function hasPrimaryDatabase(): boolean {
    return existsSync(getDbFilePath()) || existsSync(getEncryptedFilePath())
}

function getReadableKeyFilePath(): string {
    const keyFilePath = getKeyFilePath()
    if (existsSync(keyFilePath)) return keyFilePath

    if (!isUsingCustomDbDir()) {
        const legacyKeyFilePath = getKeyFilePath(getLegacyDbDir())
        if (legacyKeyFilePath !== keyFilePath && existsSync(legacyKeyFilePath)) {
            return legacyKeyFilePath
        }
    }

    return keyFilePath
}

function getReadableEncryptedPath(): string {
    const encPath = getEncryptedPath()
    if (existsSync(encPath)) return encPath

    if (!isUsingCustomDbDir() && !hasPrimaryDatabase()) {
        const legacyEncPath = getEncryptedFilePath(getLegacyDbDir())
        if (legacyEncPath !== encPath && existsSync(legacyEncPath)) {
            return legacyEncPath
        }
    }

    return encPath
}

function copyLegacyPlainDbIfNeeded(): void {
    if (isUsingCustomDbDir() || existsSync(dbPath) || existsSync(getEncryptedPath())) return

    const legacyDbDir = getLegacyDbDir()
    const legacyDbPath = getDbFilePath(legacyDbDir)
    const legacyEncPath = getEncryptedFilePath(legacyDbDir)
    if (legacyDbPath === dbPath || !existsSync(legacyDbPath) || existsSync(legacyEncPath)) return

    copyFileSync(legacyDbPath, dbPath)
}

// ======================== Public encryption API ========================

export function isDatabaseEncrypted(): boolean {
    const encPath = getEncryptedFilePath()
    if (existsSync(encPath)) return true

    if (!isUsingCustomDbDir() && !existsSync(getDbFilePath())) {
        const legacyEncPath = getEncryptedFilePath(getLegacyDbDir())
        return legacyEncPath !== encPath && existsSync(legacyEncPath)
    }

    return false
}

export function setEncryptionPassword(password: string | null): void {
    if (password) {
        encryptionPassword = password
        ensureDbDir()
        writeFileSync(getKeyFilePath(), Buffer.from(password, 'utf-8').toString('base64'))
    } else {
        encryptionPassword = ''
    }
}

export function loadEncryptionKey(): boolean {
    if (!isDatabaseEncrypted()) return true

    const keyFilePath = getReadableKeyFilePath()
    if (!existsSync(keyFilePath)) {
        console.error('[database] encrypted database exists, but remind.key was not found')
        return false
    }

    try {
        const encoded = readFileSync(keyFilePath, 'utf-8').trim()
        encryptionPassword = Buffer.from(encoded, 'base64').toString('utf-8')

        const primaryKeyFilePath = getKeyFilePath()
        if (keyFilePath !== primaryKeyFilePath && !existsSync(primaryKeyFilePath)) {
            ensureDbDir()
            writeFileSync(primaryKeyFilePath, encoded)
        }

        return true
    } catch {
        console.error('[database] failed to read remind.key')
        return false
    }
}

export function verifyEncryptionPassword(password: string): boolean {
    const keyFilePath = getReadableKeyFilePath()
    if (!existsSync(keyFilePath)) return false

    try {
        const encoded = readFileSync(keyFilePath, 'utf-8').trim()
        const storedPassword = Buffer.from(encoded, 'base64').toString('utf-8')
        return storedPassword === password
    } catch {
        return false
    }
}

export function removeEncryption(): void {
    if (!encryptionPassword) return

    ensureDbDir()
    if (db) {
        const data = db.export()
        writeFileSync(dbPath, Buffer.from(data))
    }

    const encPath = getEncryptedPath()
    if (existsSync(encPath)) {
        unlinkSync(encPath)
    }

    const keyFilePath = getKeyFilePath()
    if (existsSync(keyFilePath)) {
        unlinkSync(keyFilePath)
    }

    encryptionPassword = ''
}

// ======================== Database lifecycle ========================

export async function initDatabase(): Promise<SqlJsDatabase> {
    if (db) return db

    console.log('[database] loading sql.js...')

    const possiblePaths = [
        join(dirname(require.resolve('sql.js')), 'sql-wasm.wasm'),
        join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm'),
        join(app.getAppPath(), 'node_modules/sql.js/dist/sql-wasm.wasm')
    ]

    const wasmPath = possiblePaths.find(p => existsSync(p)) || possiblePaths[0]
    console.log('[database] wasm path:', wasmPath, 'exists:', existsSync(wasmPath))

    let SQL: Awaited<ReturnType<typeof initSqlJs>>
    if (existsSync(wasmPath)) {
        const wasmBinary = readFileSync(wasmPath)
        SQL = await initSqlJs({wasmBinary})
    } else {
        SQL = await initSqlJs()
    }
    console.log('[database] sql.js loaded')

    ensureDbDir()
    dbPath = getDbFilePath()
    copyLegacyPlainDbIfNeeded()
    console.log('[database] path:', dbPath)

    const encPath = getReadableEncryptedPath()
    if (existsSync(encPath)) {
        if (!encryptionPassword) {
            throw new Error('ENCRYPTION_PASSWORD_REQUIRED')
        }

        console.log('[database] reading encrypted database')
        const encBuffer = readFileSync(encPath)
        const decBuffer = decryptBuffer(encBuffer, encryptionPassword)
        db = new SQL.Database(decBuffer)
    } else if (existsSync(dbPath)) {
        console.log('[database] reading existing database')
        const buffer = readFileSync(dbPath)
        db = new SQL.Database(buffer)
    } else {
        console.log('[database] creating new database')
        db = new SQL.Database()
    }

    db.run('PRAGMA journal_mode = WAL')
    db.run('PRAGMA foreign_keys = ON')

    console.log('[database] initialized')
    return db
}

export function getDatabase(): SqlJsDatabase {
    if (!db) {
        throw new Error('Database is not initialized. Call initDatabase() first.')
    }
    return db
}

export function saveDatabase(): void {
    if (!db) return

    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
        doSave()
    }, 1000)
}

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
        ensureDbDir()
        const data = db.export()
        const buffer = Buffer.from(data)

        if (encryptionPassword) {
            const encrypted = encryptBuffer(buffer, encryptionPassword)
            writeFileSync(getEncryptedPath(), encrypted)

            if (existsSync(dbPath)) {
                unlinkSync(dbPath)
            }
        } else {
            writeFileSync(dbPath, buffer)
        }
    } catch (err) {
        console.error('[database] save failed:', err)
    }
}
