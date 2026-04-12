export interface Reminder {
    id: number
    title: string
    description: string
    icon: string
    color: string
    remind_type: 'interval' | 'scheduled'
    interval_value: number
    interval_unit: 'minutes' | 'hours' | 'days' | 'months' | 'years'
    weekdays: string | null // JSON数组，如 "[1,3,5]" 表示周一三五
    workday_only: number // 0/1
    holiday_only: number // 0/1
    lunar_date: string | null // 农历日期，如 "01-01" 表示正月初一
    start_time: string
    end_time: string | null
    active_hours_start: string | null
    active_hours_end: string | null
    channels: string // JSON字符串
    skill_id: number | null
    is_active: number
    last_triggered_at: string | null
    next_trigger_at: string | null
    created_at: string
    updated_at: string
}

export interface CreateReminderInput {
    title: string
    description?: string
    icon?: string
    color?: string
    remind_type: 'interval' | 'scheduled'
    interval_value: number
    interval_unit: 'minutes' | 'hours' | 'days' | 'months' | 'years'
    weekdays?: number[] | null
    workday_only?: number
    holiday_only?: number
    lunar_date?: string | null
    start_time: string
    end_time?: string | null
    active_hours_start?: string | null
    active_hours_end?: string | null
    channels: string[]
    skill_id?: number | null
}

export interface ReminderStats {
    total: number
    active: number
    triggeredToday: number
}
