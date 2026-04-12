import {getDatabase, saveDatabase} from './connection'

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

export interface ModelConfig {
    id: number
    name: string
    provider: string
    base_url: string
    api_key: string
    model: string
    models: string   // JSON array string, e.g. '["gpt-4o","gpt-4o-mini"]'
    model_notes: string  // JSON object string, e.g. '{"gpt-4o":"多模态模型","gpt-4o-mini":"轻量模型"}'
    model_type: string   // 'text' | 'multimodal' | 'web_search'
    is_default: number
    created_at: string
    updated_at: string
}

export const modelConfigsDb = {
    list(): ModelConfig[] {
        return queryAll('SELECT * FROM model_configs ORDER BY id ASC') as ModelConfig[]
    },

    get(id: number): ModelConfig | undefined {
        return queryOne('SELECT * FROM model_configs WHERE id = ?', [id]) as ModelConfig | undefined
    },

    getDefault(): ModelConfig | undefined {
        return queryOne('SELECT * FROM model_configs WHERE is_default = 1') as ModelConfig | undefined
    },

    create(input: {
        name: string;
        provider: string;
        base_url: string;
        api_key: string;
        model: string;
        models?: string[];
        model_notes?: Record<string, string>;
        model_type?: string;
        is_default?: boolean
    }): ModelConfig {
        if (input.is_default) {
            run('UPDATE model_configs SET is_default = 0')
        }
        const modelsJson = JSON.stringify(input.models || [])
        const notesJson = JSON.stringify(input.model_notes || {})
        const modelType = input.model_type || 'text'
        run(
            'INSERT INTO model_configs (name, provider, base_url, api_key, model, models, model_notes, model_type, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [input.name, input.provider, input.base_url, input.api_key, input.model, modelsJson, notesJson, modelType, input.is_default ? 1 : 0]
        )
        return this.get(getLastInsertId())!
    },

    update(id: number, input: Partial<{
        name: string;
        provider: string;
        base_url: string;
        api_key: string;
        model: string;
        models?: string[];
        model_notes?: Record<string, string>;
        model_type: string;
        is_default: boolean
    }>): ModelConfig | undefined {
        const existing = this.get(id)
        if (!existing) return undefined

        if (input.is_default) {
            run('UPDATE model_configs SET is_default = 0')
        }

        const modelsJson = input.models !== undefined
            ? JSON.stringify(input.models)
            : existing.models
        const notesJson = input.model_notes !== undefined
            ? JSON.stringify(input.model_notes)
            : existing.model_notes

        run(
            `UPDATE model_configs
             SET name=?,
                 provider=?,
                 base_url=?,
                 api_key=?,
                 model=?,
                 models=?,
                 model_notes=?,
                 model_type=?,
                 is_default=?,
                 updated_at=datetime('now', 'localtime')
             WHERE id = ?`,
            [
                input.name ?? existing.name,
                input.provider ?? existing.provider,
                input.base_url ?? existing.base_url,
                input.api_key ?? existing.api_key,
                input.model ?? existing.model,
                modelsJson,
                notesJson,
                input.model_type ?? existing.model_type,
                input.is_default !== undefined ? (input.is_default ? 1 : 0) : existing.is_default,
                id
            ]
        )
        return this.get(id)
    },

    delete(id: number): boolean {
        const before = queryOne('SELECT COUNT(*) as c FROM model_configs WHERE id = ?', [id])
        run('DELETE FROM model_configs WHERE id = ?', [id])
        return (before?.c || 0) > 0
    },

    setDefault(id: number): void {
        run('UPDATE model_configs SET is_default = 0')
        run('UPDATE model_configs SET is_default = 1 WHERE id = ?', [id])
        saveDatabase()
    }
}
