import {getDatabase, saveDatabase} from './connection'

export interface Skill {
    id: number
    skill_key: string
    name: string
    description: string
    icon: string
    category: string
    action_type: string
    action_config: string
    config_schema: string
    user_config: string
    is_builtin: number
    is_enabled: number
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

function queryOne(sql: string, params: any[] = []): any | undefined {
    const rows = queryAll(sql, params)
    return rows[0]
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

export const BUILTIN_SKILLS = [
    {
        skill_key: 'weather',
        name: '天气查询',
        description: '查询指定城市的实时天气信息，包括温度、湿度、风速和天气状况',
        icon: '🌤️',
        category: 'weather',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: JSON.stringify([
            { key: 'city', label: '城市', type: 'string', default: '北京', required: true, placeholder: '请输入城市名称' },
            { key: 'unit', label: '温度单位', type: 'select', default: 'celsius', options: [{ label: '摄氏度', value: 'celsius' }, { label: '华氏度', value: 'fahrenheit' }] }
        ])
    },
    {
        skill_key: 'daily_quote',
        name: '每日一言',
        description: '每天随机展示一条励志名言或优美句子，给你满满的正能量',
        icon: '💬',
        category: 'daily',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: JSON.stringify([
            { key: 'type', label: '内容类型', type: 'select', default: 'mixed', options: [{ label: '混合', value: 'mixed' }, { label: '励志', value: 'motivational' }, { label: '哲理', value: 'philosophy' }, { label: '唯美', value: 'aesthetic' }] }
        ])
    },
    {
        skill_key: 'countdown',
        name: '倒计日',
        description: '计算距离重要日期还有多少天，如生日、考试、假期等',
        icon: '⏳',
        category: 'tools',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: JSON.stringify([
            { key: 'target_date', label: '目标日期', type: 'string', required: true, placeholder: '如：2025-12-31' },
            { key: 'event_name', label: '事件名称', type: 'string', required: true, placeholder: '如：新年' }
        ])
    },
    {
        skill_key: 'water_reminder',
        name: '喝水提醒',
        description: '智能提醒你喝水，包含当前时间和喝水建议',
        icon: '💧',
        category: 'health',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: JSON.stringify([
            { key: 'cup_ml', label: '杯容量(ml)', type: 'number', default: 250 }
        ])
    },
    {
        skill_key: 'poetry',
        name: '每日诗词',
        description: '每天欣赏一首优美的古诗词，品味传统文化之美',
        icon: '📜',
        category: 'study',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: '[]'
    },
    {
        skill_key: 'health_tip',
        name: '健康小贴士',
        description: '根据季节和时间段提供实用的健康养生建议',
        icon: '🍎',
        category: 'health',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: '[]'
    },
    {
        skill_key: 'exercise',
        name: '运动建议',
        description: '根据天气和时间段推荐适合的运动方式',
        icon: '🏃',
        category: 'health',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: '[]'
    },
    {
        skill_key: 'english',
        name: '每日英语',
        description: '每天学习一个实用英语表达，附中文翻译和例句',
        icon: '📚',
        category: 'study',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: '[]'
    },
    {
        skill_key: 'joke',
        name: '每日笑话',
        description: '每天一个轻松幽默的笑话，让你开心一整天',
        icon: '😄',
        category: 'daily',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: '[]'
    },
    {
        skill_key: 'horoscope',
        name: '星座运势',
        description: '查看今日十二星座运势，包含综合、爱情、事业运势',
        icon: '⭐',
        category: 'daily',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: JSON.stringify([
            { key: 'sign', label: '星座', type: 'select', default: 'aries', options: [{ label: '白羊座', value: 'aries' }, { label: '金牛座', value: 'taurus' }, { label: '双子座', value: 'gemini' }, { label: '巨蟹座', value: 'cancer' }, { label: '狮子座', value: 'leo' }, { label: '处女座', value: 'virgo' }, { label: '天秤座', value: 'libra' }, { label: '天蝎座', value: 'scorpio' }, { label: '射手座', value: 'sagittarius' }, { label: '摩羯座', value: 'capricorn' }, { label: '水瓶座', value: 'aquarius' }, { label: '双鱼座', value: 'pisces' }] }
        ])
    },
    {
        skill_key: 'lunar_info',
        name: '农历信息',
        description: '显示今日农历日期、节气、宜忌等传统信息',
        icon: '🌙',
        category: 'daily',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: '[]'
    },
    {
        skill_key: 'work_report',
        name: '工作小结',
        description: '定时提醒你总结工作进度，梳理待办事项',
        icon: '📝',
        category: 'tools',
        action_type: 'builtin',
        action_config: '{}',
        config_schema: '[]'
    }
]

export function seedBuiltinSkills(): void {
    for (const skill of BUILTIN_SKILLS) {
        const existing = queryOne('SELECT id FROM skills WHERE skill_key = ?', [skill.skill_key])
        if (!existing) {
            run(`INSERT INTO skills (skill_key, name, description, icon, category, action_type, action_config, config_schema, user_config, is_builtin, is_enabled)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', 1, 0)`, [
                skill.skill_key, skill.name, skill.description, skill.icon,
                skill.category, skill.action_type, skill.action_config, skill.config_schema
            ])
        }
    }
}

export const skillsDb = {
    list(filters?: { category?: string; is_enabled?: number; search?: string }): Skill[] {
        let sql = 'SELECT * FROM skills WHERE 1=1'
        const params: any[] = []

        if (filters?.category) {
            sql += ' AND category = ?'
            params.push(filters.category)
        }
        if (filters?.is_enabled !== undefined) {
            sql += ' AND is_enabled = ?'
            params.push(filters.is_enabled)
        }
        if (filters?.search) {
            sql += ' AND (name LIKE ? OR description LIKE ?)'
            params.push(`%${filters.search}%`, `%${filters.search}%`)
        }

        sql += ' ORDER BY is_builtin DESC, category, name'
        return queryAll(sql, params) as Skill[]
    },

    get(id: number): Skill | undefined {
        return queryOne('SELECT * FROM skills WHERE id = ?', [id]) as Skill | undefined
    },

    getByKey(key: string): Skill | undefined {
        return queryOne('SELECT * FROM skills WHERE skill_key = ?', [key]) as Skill | undefined
    },

    create(input: {
        name: string
        description?: string
        icon?: string
        category?: string
        action_type: string
        action_config: string
        config_schema?: string
        user_config?: string
    }): Skill {
        const skillKey = `custom_${Date.now()}`
        run(`INSERT INTO skills (skill_key, name, description, icon, category, action_type, action_config, config_schema, user_config, is_builtin, is_enabled)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`, [
            skillKey, input.name, input.description || '', input.icon || '⚡',
            input.category || 'custom', input.action_type, input.action_config,
            input.config_schema || '[]', input.user_config || '{}'
        ])
        const id = getLastInsertId()
        return this.get(id)!
    },

    update(id: number, input: {
        name?: string
        description?: string
        icon?: string
        category?: string
        action_config?: string
        config_schema?: string
        user_config?: string
        is_enabled?: number
    }): Skill | undefined {
        const existing = this.get(id)
        if (!existing) return undefined

        run(`UPDATE skills SET
            name = ?, description = ?, icon = ?, category = ?,
            action_config = ?, config_schema = ?, user_config = ?, is_enabled = ?,
            updated_at = datetime('now', 'localtime')
            WHERE id = ?`, [
            input.name ?? existing.name,
            input.description ?? existing.description,
            input.icon ?? existing.icon,
            input.category ?? existing.category,
            input.action_config ?? existing.action_config,
            input.config_schema ?? existing.config_schema,
            input.user_config ?? existing.user_config,
            input.is_enabled !== undefined ? input.is_enabled : existing.is_enabled,
            id
        ])
        return this.get(id)
    },

    updateConfig(id: number, userConfig: string): Skill | undefined {
        const existing = this.get(id)
        if (!existing) return undefined

        run(`UPDATE skills SET user_config = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`, [userConfig, id])
        return this.get(id)
    },

    delete(id: number): boolean {
        const existing = this.get(id)
        if (!existing) return false
        run('DELETE FROM skills WHERE id = ?', [id])
        return true
    },

    toggleEnabled(id: number): Skill | undefined {
        const existing = this.get(id)
        if (!existing) return undefined
        run('UPDATE skills SET is_enabled = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?', [existing.is_enabled ? 0 : 1, id])
        return this.get(id)
    },

    getEnabled(): Skill[] {
        return queryAll('SELECT * FROM skills WHERE is_enabled = 1 ORDER BY category, name') as Skill[]
    }
}
