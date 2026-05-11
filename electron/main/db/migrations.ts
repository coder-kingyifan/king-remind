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
          ('telegram', 0, '{"bot_token": "", "chat_id": ""}');
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
                OR IGNORE INTO settings (key, value) VALUES ('notification_sound', 'on');
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
        },
        {
            version: 14,
            sql: `
                ALTER TABLE model_configs ADD COLUMN model_type TEXT NOT NULL DEFAULT 'text';
            `
        },
        {
            version: 15,
            sql: `
                ALTER TABLE chat_messages ADD COLUMN images TEXT DEFAULT NULL;
            `
        },
        {
            version: 16,
            sql: `
                INSERT OR IGNORE INTO settings (key, value) VALUES ('setup_done', 'false');
                INSERT OR IGNORE INTO settings (key, value) VALUES ('api_enabled', 'false');
                INSERT OR IGNORE INTO settings (key, value) VALUES ('api_host', '0.0.0.0');
            `
        },
        {
            version: 17,
            sql: `
                INSERT OR IGNORE INTO settings (key, value) VALUES ('db_path', '');
                INSERT OR IGNORE INTO settings (key, value) VALUES ('db_encrypted', 'false');
            `
        },
        {
            version: 18,
            sql: `
                CREATE TABLE IF NOT EXISTS skill_content (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    skill_key TEXT NOT NULL,
                    category TEXT DEFAULT '',
                    content TEXT NOT NULL,
                    extra TEXT DEFAULT '{}',
                    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
                );
                CREATE INDEX IF NOT EXISTS idx_skill_content_key ON skill_content(skill_key);
                CREATE INDEX IF NOT EXISTS idx_skill_content_key_cat ON skill_content(skill_key, category);
            `
        },
        {
            version: 19,
            sql: `
                ALTER TABLE skills ADD COLUMN store_version TEXT DEFAULT NULL;
                ALTER TABLE skills ADD COLUMN store_source TEXT DEFAULT NULL;
            `
        },
        {
            version: 20,
            sql: `
                UPDATE skills SET is_enabled = 1 WHERE is_builtin = 1 AND is_enabled = 0;
                UPDATE skills SET is_builtin = 0 WHERE is_builtin = 1;
            `
        },
        {
            version: 21,
            sql: `
                DELETE FROM skills;
                DELETE FROM skill_content;
            `
        },
        {
            version: 22,
            sql: `
                INSERT OR IGNORE INTO notification_configs (channel, is_enabled, config_json) VALUES
          ('wechat_test', 0, '{"app_id": "", "app_secret": "", "to_openid": "", "msg_type": "text", "template_id": "", "template_url": "", "template_fields": [{"key": "first", "value": "{{icon}} {{title}}", "color": ""}, {"key": "keyword1", "value": "{{body}}", "color": ""}, {"key": "remark", "value": "{{app_name}} · {{time}}", "color": ""}]}');
            `
        },
        {
            version: 23,
            sql: `
                INSERT OR IGNORE INTO notification_configs (channel, is_enabled, config_json) VALUES
          ('dingtalk', 0, '{"webhook_url": "", "msg_type": "text", "secret": "", "mention_mode": "none", "mention_mobiles": "", "mention_userids": ""}');
                INSERT OR IGNORE INTO notification_configs (channel, is_enabled, config_json) VALUES
          ('feishu', 0, '{"webhook_url": "", "msg_type": "text"}');
                INSERT OR IGNORE INTO notification_configs (channel, is_enabled, config_json) VALUES
          ('bark', 0, '{"server_url": "", "sound": "alarm", "group": "king-mate"}');
                INSERT OR IGNORE INTO notification_configs (channel, is_enabled, config_json) VALUES
          ('discord', 0, '{"webhook_url": "", "username": "King Mate"}');
            `
        },
        {
            version: 24,
            sql: `
                UPDATE settings SET value = 'on' WHERE key = 'notification_sound' AND value = 'true';
                UPDATE notification_configs SET config_json = '{"server_url": "", "sound": "alarm", "group": "king-mate"}' WHERE channel = 'bark' AND config_json LIKE '%api.day.app%';
            `
        },
        {
            version: 25,
            sql: `
                INSERT OR IGNORE INTO notification_configs (channel, is_enabled, config_json) VALUES
          ('wechat_bot', 0, '{"message_template": ""}');
            `
        },
        {
            version: 26,
            sql: `
                CREATE TABLE IF NOT EXISTS todos
                (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    completed INTEGER NOT NULL DEFAULT 0,
                    priority TEXT NOT NULL DEFAULT 'normal',
                    due_date TEXT DEFAULT NULL,
                    category TEXT DEFAULT '',
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
                );
                CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
                CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
            `
        },
        {
            version: 27,
            sql: `
                ALTER TABLE todos ADD COLUMN images TEXT NOT NULL DEFAULT '[]';
            `
        },
        {
            version: 28,
            sql: `
                CREATE TABLE IF NOT EXISTS meetings
                (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    meeting_type TEXT NOT NULL DEFAULT 'regular',
                    status TEXT NOT NULL DEFAULT 'pending',
                    start_time TEXT NOT NULL,
                    end_time TEXT DEFAULT NULL,
                    location TEXT DEFAULT '',
                    participants TEXT NOT NULL DEFAULT '[]',
                    minutes TEXT DEFAULT '',
                    ai_summary TEXT DEFAULT NULL,
                    attachments TEXT NOT NULL DEFAULT '[]',
                    recording_path TEXT DEFAULT NULL,
                    has_recording INTEGER NOT NULL DEFAULT 0,
                    todo_ids TEXT NOT NULL DEFAULT '[]',
                    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
                );
                CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
                CREATE INDEX IF NOT EXISTS idx_meetings_start_time ON meetings(start_time);
                CREATE INDEX IF NOT EXISTS idx_meetings_type ON meetings(meeting_type);
            `
        },
        {
            version: 29,
            sql: `
                CREATE TABLE IF NOT EXISTS meeting_segments
                (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    meeting_id INTEGER NOT NULL,
                    segment_type TEXT NOT NULL DEFAULT 'text',
                    content TEXT NOT NULL DEFAULT '',
                    speaker TEXT DEFAULT '',
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_segments_meeting ON meeting_segments(meeting_id);

                ALTER TABLE meetings ADD COLUMN stt_text TEXT DEFAULT NULL;
                ALTER TABLE meetings ADD COLUMN stt_status TEXT NOT NULL DEFAULT 'none';
            `
        },
        {
            version: 30,
            sql: `
                ALTER TABLE meeting_segments ADD COLUMN start_time REAL DEFAULT 0;
                ALTER TABLE meeting_segments ADD COLUMN end_time REAL DEFAULT 0;
            `
        },
        {
            version: 31,
            sql: `
                ALTER TABLE notification_logs ADD COLUMN reminder_title TEXT DEFAULT NULL;
                ALTER TABLE notification_logs ADD COLUMN reminder_icon TEXT DEFAULT NULL;
            `
        },
        {
            version: 32,
            sql: `
                INSERT OR IGNORE INTO settings (key, value) VALUES ('network_proxy_mode', 'system');
                INSERT OR IGNORE INTO settings (key, value) VALUES ('network_proxy_url', 'http://127.0.0.1:7890');
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
