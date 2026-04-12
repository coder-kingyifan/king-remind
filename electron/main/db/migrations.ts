import {getDatabase, saveDatabase} from './connection'

export function runMigrations(): void {
    const db = getDatabase()

    db.run(`
        CREATE TABLE IF NOT EXISTS schema_version
        (
            version
            INTEGER
            PRIMARY
            KEY,
            applied_at
            TEXT
            NOT
            NULL
            DEFAULT (
            datetime
        (
            'now',
            'localtime'
        ))
            )
    `)

    let currentVersion = 0
    const result = db.exec('SELECT MAX(version) as version FROM schema_version')
    if (result.length > 0 && result[0].values.length > 0 && result[0].values[0][0] !== null) {
        currentVersion = result[0].values[0][0] as number
    }

    const migrations: Array<{ version: number; sql: string }> = [
        {
            version: 1,
            sql: `
                CREATE TABLE IF NOT EXISTS reminders
                (
                    id
                    INTEGER
                    PRIMARY
                    KEY
                    AUTOINCREMENT,
                    title
                    TEXT
                    NOT
                    NULL,
                    description
                    TEXT
                    DEFAULT
                    '',
                    icon
                    TEXT
                    DEFAULT
                    '🔔',
                    color
                    TEXT
                    DEFAULT
                    '#409EFF',
                    remind_type
                    TEXT
                    NOT
                    NULL
                    DEFAULT
                    'interval',
                    interval_value
                    INTEGER
                    NOT
                    NULL
                    DEFAULT
                    60,
                    interval_unit
                    TEXT
                    NOT
                    NULL
                    DEFAULT
                    'minutes',
                    start_time
                    TEXT
                    NOT
                    NULL,
                    end_time
                    TEXT
                    DEFAULT
                    NULL,
                    active_hours_start
                    TEXT
                    DEFAULT
                    NULL,
                    active_hours_end
                    TEXT
                    DEFAULT
                    NULL,
                    channels
                    TEXT
                    NOT
                    NULL
                    DEFAULT
                    '["desktop"]',
                    is_active
                    INTEGER
                    NOT
                    NULL
                    DEFAULT
                    1,
                    last_triggered_at
                    TEXT
                    DEFAULT
                    NULL,
                    next_trigger_at
                    TEXT
                    DEFAULT
                    NULL,
                    created_at
                    TEXT
                    NOT
                    NULL
                    DEFAULT (
                    datetime
                (
                    'now',
                    'localtime'
                )),
                    updated_at TEXT NOT NULL DEFAULT
                (
                    datetime
                (
                    'now',
                    'localtime'
                ))
                    );

                CREATE INDEX IF NOT EXISTS idx_reminders_next_trigger ON reminders(next_trigger_at);
                CREATE INDEX IF NOT EXISTS idx_reminders_active ON reminders(is_active);

                CREATE TABLE IF NOT EXISTS notification_configs
                (
                    id
                    INTEGER
                    PRIMARY
                    KEY
                    AUTOINCREMENT,
                    channel
                    TEXT
                    NOT
                    NULL
                    UNIQUE,
                    is_enabled
                    INTEGER
                    NOT
                    NULL
                    DEFAULT
                    0,
                    config_json
                    TEXT
                    NOT
                    NULL
                    DEFAULT
                    '{}',
                    created_at
                    TEXT
                    NOT
                    NULL
                    DEFAULT (
                    datetime
                (
                    'now',
                    'localtime'
                )),
                    updated_at TEXT NOT NULL DEFAULT
                (
                    datetime
                (
                    'now',
                    'localtime'
                ))
                    );

                CREATE TABLE IF NOT EXISTS notification_logs
                (
                    id
                    INTEGER
                    PRIMARY
                    KEY
                    AUTOINCREMENT,
                    reminder_id
                    INTEGER
                    NOT
                    NULL,
                    channel
                    TEXT
                    NOT
                    NULL,
                    status
                    TEXT
                    NOT
                    NULL
                    DEFAULT
                    'pending',
                    error_message
                    TEXT
                    DEFAULT
                    NULL,
                    sent_at
                    TEXT
                    NOT
                    NULL
                    DEFAULT (
                    datetime
                (
                    'now',
                    'localtime'
                )),
                    FOREIGN KEY
                (
                    reminder_id
                ) REFERENCES reminders
                (
                    id
                ) ON DELETE CASCADE
                    );

                CREATE INDEX IF NOT EXISTS idx_logs_reminder ON notification_logs(reminder_id);
                CREATE INDEX IF NOT EXISTS idx_logs_sent_at ON notification_logs(sent_at);

                CREATE TABLE IF NOT EXISTS settings
                (
                    key
                    TEXT
                    PRIMARY
                    KEY,
                    value
                    TEXT
                    NOT
                    NULL
                );

                INSERT
                OR IGNORE INTO notification_configs (channel, is_enabled, config_json) VALUES
          ('desktop', 1, '{"sound": true, "duration": 5000}');
        INSERT
                OR IGNORE INTO notification_configs (channel, is_enabled, config_json) VALUES
          ('email', 0, '{"smtp_host": "", "smtp_port": 587, "smtp_secure": false, "smtp_user": "", "smtp_pass": "", "from_address": "", "to_addresses": []}');
        INSERT
                OR IGNORE INTO notification_configs (channel, is_enabled, config_json) VALUES
          ('telegram', 0, '{"bot_token": "", "chat_id": "", "proxy_url": ""}');
        INSERT
                OR IGNORE INTO notification_configs (channel, is_enabled, config_json) VALUES
          ('wechat_work', 0, '{"corp_id": "", "corp_secret": "", "agent_id": "", "to_user": "@all"}');
        INSERT
                OR IGNORE INTO notification_configs (channel, is_enabled, config_json) VALUES
          ('webhook', 0, '{"url": "", "method": "POST", "headers": "{}", "body_template": ""}');

        INSERT
                OR IGNORE INTO settings (key, value) VALUES ('theme', 'system');
        INSERT
                OR IGNORE INTO settings (key, value) VALUES ('launch_at_startup', 'false');
        INSERT
                OR IGNORE INTO settings (key, value) VALUES ('minimize_to_tray', 'true');
        INSERT
                OR IGNORE INTO settings (key, value) VALUES ('notification_sound', 'true');
        INSERT
                OR IGNORE INTO settings (key, value) VALUES ('language', 'zh-CN');
        INSERT
                OR IGNORE INTO settings (key, value) VALUES ('scheduler_interval', '60');
        INSERT
                OR IGNORE INTO settings (key, value) VALUES ('api_port', '33333');
        INSERT
                OR IGNORE INTO settings (key, value) VALUES ('api_token', '');
            `
        },
        {
            version: 2,
            sql: `
        -- 如果旧数据库没有 remind_type 列，添加它
        -- SQLite 的 ALTER TABLE ADD COLUMN 在列已存在时会报错，
        -- 所以这里用安全的方式处理
        ALTER TABLE reminders ADD COLUMN remind_type TEXT NOT NULL DEFAULT 'interval';
      `
        },
        {
            version: 3,
            sql: `
                ALTER TABLE reminders
                    ADD COLUMN weekdays TEXT DEFAULT NULL;
                ALTER TABLE reminders
                    ADD COLUMN workday_only INTEGER NOT NULL DEFAULT 0;

                CREATE TABLE IF NOT EXISTS workdays
                (
                    date
                    TEXT
                    PRIMARY
                    KEY,
                    is_workday
                    INTEGER
                    NOT
                    NULL
                    DEFAULT
                    1
                );
            `
        },
        {
            version: 4,
            sql: `
                ALTER TABLE reminders
                    ADD COLUMN holiday_only INTEGER NOT NULL DEFAULT 0;
                ALTER TABLE reminders
                    ADD COLUMN lunar_date TEXT DEFAULT NULL;
            `
        },
        {
            version: 5,
            sql: `
                INSERT
                OR IGNORE INTO notification_configs (channel, is_enabled, config_json) VALUES
          ('webhook', 0, '{"url": "", "method": "POST", "headers": "{}", "body_template": ""}');
            `
        },
        {
            version: 6,
            sql: `
                INSERT
                OR IGNORE INTO notification_configs (channel, is_enabled, config_json) VALUES
          ('wechat_work_webhook', 0, '{"webhook_url": ""}');
            `
        },
        {
            version: 7,
            sql: `
                UPDATE notification_configs
                SET channel = 'wechat_work_webhook'
                WHERE channel = 'wechat_work_bot';
                INSERT
                OR IGNORE INTO notification_configs (channel, is_enabled, config_json) VALUES
          ('wechat_work_webhook', 0, '{"webhook_url": ""}');
            `
        },
        {
            version: 8,
            sql: `
                CREATE TABLE IF NOT EXISTS chat_messages
                (
                    id
                    INTEGER
                    PRIMARY
                    KEY
                    AUTOINCREMENT,
                    role
                    TEXT
                    NOT
                    NULL,
                    content
                    TEXT
                    NOT
                    NULL,
                    created_at
                    TEXT
                    NOT
                    NULL
                    DEFAULT (
                    datetime
                (
                    'now',
                    'localtime'
                ))
                    );

                CREATE TABLE IF NOT EXISTS model_configs
                (
                    id
                    INTEGER
                    PRIMARY
                    KEY
                    AUTOINCREMENT,
                    name
                    TEXT
                    NOT
                    NULL,
                    provider
                    TEXT
                    NOT
                    NULL
                    DEFAULT
                    'ollama',
                    base_url
                    TEXT
                    NOT
                    NULL
                    DEFAULT
                    '',
                    api_key
                    TEXT
                    NOT
                    NULL
                    DEFAULT
                    '',
                    model
                    TEXT
                    NOT
                    NULL
                    DEFAULT
                    '',
                    is_default
                    INTEGER
                    NOT
                    NULL
                    DEFAULT
                    0,
                    created_at
                    TEXT
                    NOT
                    NULL
                    DEFAULT (
                    datetime
                (
                    'now',
                    'localtime'
                )),
                    updated_at TEXT NOT NULL DEFAULT
                (
                    datetime
                (
                    'now',
                    'localtime'
                ))
                    );
            `
        },
        {
            version: 9,
            sql: `
                CREATE TABLE IF NOT EXISTS chat_sessions
                (
                    id
                    INTEGER
                    PRIMARY
                    KEY
                    AUTOINCREMENT,
                    title
                    TEXT
                    NOT
                    NULL
                    DEFAULT
                    '新对话',
                    model_id
                    INTEGER
                    DEFAULT
                    NULL,
                    created_at
                    TEXT
                    NOT
                    NULL
                    DEFAULT (
                    datetime
                (
                    'now',
                    'localtime'
                )),
                    updated_at TEXT NOT NULL DEFAULT
                (
                    datetime
                (
                    'now',
                    'localtime'
                ))
                    );

                ALTER TABLE chat_messages
                    ADD COLUMN session_id INTEGER DEFAULT NULL;
            `
        },
        {
            version: 10,
            sql: `
                ALTER TABLE model_configs
                    ADD COLUMN models TEXT NOT NULL DEFAULT '[]';
            `
        },
        {
            version: 11,
            sql: `
        ALTER TABLE model_configs ADD COLUMN model_notes TEXT NOT NULL DEFAULT '{}';
      `
        },
        {
            version: 12,
            sql: `
                CREATE TABLE IF NOT EXISTS skills
                (
                    id
                    INTEGER
                    PRIMARY
                    KEY
                    AUTOINCREMENT,
                    skill_key
                    TEXT
                    NOT
                    NULL
                    UNIQUE,
                    name
                    TEXT
                    NOT
                    NULL,
                    description
                    TEXT
                    DEFAULT
                    '',
                    icon
                    TEXT
                    DEFAULT
                    '⚡',
                    category
                    TEXT
                    NOT
                    NULL
                    DEFAULT
                    'custom',
                    action_type
                    TEXT
                    NOT
                    NULL
                    DEFAULT
                    'builtin',
                    action_config
                    TEXT
                    DEFAULT
                    '{}',
                    config_schema
                    TEXT
                    DEFAULT
                    '[]',
                    user_config
                    TEXT
                    DEFAULT
                    '{}',
                    is_builtin
                    INTEGER
                    NOT
                    NULL
                    DEFAULT
                    0,
                    is_enabled
                    INTEGER
                    NOT
                    NULL
                    DEFAULT
                    1,
                    created_at
                    TEXT
                    NOT
                    NULL
                    DEFAULT (
                    datetime
                (
                    'now',
                    'localtime'
                )),
                    updated_at TEXT NOT NULL DEFAULT
                (
                    datetime
                (
                    'now',
                    'localtime'
                ))
                    );

                ALTER TABLE reminders ADD COLUMN skill_id INTEGER DEFAULT NULL;
            `
        },
        {
            version: 13,
            sql: `
                UPDATE skills SET is_enabled = 0 WHERE is_builtin = 1;
            `
        }
    ]

    for (const migration of migrations) {
        if (migration.version > currentVersion) {
            try {
                db.exec(migration.sql)
            } catch (e: any) {
                // ALTER TABLE ADD COLUMN 在列已存在时会报错，忽略此类错误
                if (!e.message?.includes('duplicate column name')) {
                    throw e
                }
            }
            db.run('INSERT INTO schema_version (version) VALUES (?)', [migration.version])
        }
    }

    saveDatabase()
}
