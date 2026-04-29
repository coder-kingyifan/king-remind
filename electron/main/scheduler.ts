import {Reminder, remindersDb} from './db/reminders'
import {workdaysDb} from './db/workdays'
import {getSolarDateFromLunar} from 'chinese-days'
import {NotificationDispatcher} from './notifications/dispatcher'
import {skillsDb} from './db/skills'
import {executeSkill} from './skills/executor'
import {todosDb} from './db/todos'
import {settingsDb} from './db/settings'

function getLocalDateStr(date: Date = new Date()): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

function getLocalDateTimeStr(date: Date = new Date()): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    const s = String(date.getSeconds()).padStart(2, '0')
    return `${y}-${m}-${d}T${h}:${min}:${s}`
}

export class ReminderScheduler {
    private intervalId: NodeJS.Timeout | null = null
    private dispatcher: NotificationDispatcher

    constructor(dispatcher: NotificationDispatcher) {
        this.dispatcher = dispatcher
    }

    start(intervalMs: number = 60000): void {
        this.checkReminders()
        this.intervalId = setInterval(() => this.checkReminders(), intervalMs)
        console.log(`[调度器] 已启动，检查间隔: ${intervalMs / 1000}秒`)
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = null
            console.log('[调度器] 已停止')
        }
    }

    restart(intervalMs: number = 60000): void {
        this.stop()
        this.start(intervalMs)
    }

    triggerNow(): void {
        this.checkReminders()
    }

    private async checkReminders(): Promise<void> {
        try {
            const dueReminders = remindersDb.getDueReminders()

            for (const reminder of dueReminders) {
                if (!this.isWithinActiveHours(reminder)) continue
                if (!this.matchesWeekday(reminder)) {
                    // 不符合星期条件，跳到下一个触发时间
                    const nextTrigger = this.calculateNextTrigger(reminder)
                    remindersDb.updateAfterTrigger(reminder.id, nextTrigger)
                    continue
                }
                if (!this.matchesWorkday(reminder)) {
                    // 不是工作日，跳到下一个触发时间
                    const nextTrigger = this.calculateNextTrigger(reminder)
                    remindersDb.updateAfterTrigger(reminder.id, nextTrigger)
                    continue
                }
                if (!this.matchesHoliday(reminder)) {
                    // 不是节假日，跳到下一个触发时间
                    const nextTrigger = this.calculateNextTrigger(reminder)
                    remindersDb.updateAfterTrigger(reminder.id, nextTrigger)
                    continue
                }

                // Execute skill before dispatching if skill is bound
                let skillResult = ''
                if (reminder.skill_id) {
                    try {
                        skillResult = await executeSkill(reminder.skill_id)
                    } catch (e: any) {
                        console.error(`[调度器] 技能执行失败 [${reminder.title}]:`, e.message)
                    }
                }

                this.dispatcher.dispatch(reminder, skillResult).catch(err => {
                    console.error(`[调度器] 发送提醒失败 [${reminder.title}]:`, err.message)
                })

                if (reminder.remind_type === 'scheduled') {
                    remindersDb.updateAfterTrigger(reminder.id, null)
                } else {
                    let nextTrigger: string
                    if (reminder.lunar_date) {
                        // 农历提醒：计算下一年同农历日期的阳历日期
                        nextTrigger = this.calculateNextLunarTrigger(reminder)
                    } else {
                        nextTrigger = this.calculateNextTrigger(reminder)
                    }
                    remindersDb.updateAfterTrigger(reminder.id, nextTrigger)
                }
            }

            if (dueReminders.length > 0) {
                console.log(`[调度器] 触发了 ${dueReminders.length} 个提醒`)
            }

            // 检查待办截止通知
            this.checkTodoDue()
            // 检查待办总结通知
            this.checkTodoSummary()
        } catch (error: any) {
            console.error('[调度器] 检查提醒时出错:', error.message)
        }
    }

    private checkTodoDue(): void {
        try {
            const enabled = settingsDb.get('todo_notify_enabled')
            if (enabled !== 'true') return

            const notifyTime = settingsDb.get('todo_notify_time') || '18:00'
            const now = new Date()
            const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
            if (currentTime !== notifyTime) return

            // 防止同一分钟内重复触发
            const today = getLocalDateStr(now)
            const lastKey = `todo_last_notify_${today}_${notifyTime.replace(':', '')}`
            if (settingsDb.get(lastKey) === '1') return
            settingsDb.set(lastKey, '1')

            // 查询今天截止的未完成待办
            const todos = todosDb.list({completed: 0})
            const dueToday = todos.filter((t: any) => t.due_date === today)
            if (!dueToday.length) return

            // 解析通知渠道
            let channels: string[] = ['desktop']
            try {
                const raw = settingsDb.get('todo_notify_channels')
                if (raw) channels = JSON.parse(raw)
            } catch {}

            const titles = dueToday.map((t: any) => t.title).join('、')
            this.dispatcher.sendToChannels(channels, {
                title: `待办提醒：${dueToday.length} 项今日截止`,
                body: titles,
                icon: '📋',
                reminderId: 0
            }).catch(err => {
                console.error('[调度器] 发送待办通知失败:', err.message)
            })

            console.log(`[调度器] 发送待办截止通知: ${dueToday.length} 项`)
        } catch (error: any) {
            console.error('[调度器] 检查待办截止时出错:', error.message)
        }
    }

    private checkTodoSummary(): void {
        try {
            const enabled = settingsDb.get('todo_summary_enabled')
            if (enabled !== 'true') return

            const notifyTime = settingsDb.get('todo_summary_time') || '18:00'
            const now = new Date()
            const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
            if (currentTime !== notifyTime) return

            // 防止同一分钟内重复触发
            const today = getLocalDateStr(now)
            const lastKey = `todo_summary_last_${today}_${notifyTime.replace(':', '')}`
            if (settingsDb.get(lastKey) === '1') return
            settingsDb.set(lastKey, '1')

            // 查询所有未完成待办
            const todos = todosDb.list({completed: 0})
            if (!todos.length) return

            // 解析通知渠道
            let channels: string[] = ['desktop']
            try {
                const raw = settingsDb.get('todo_summary_channels')
                if (raw) channels = JSON.parse(raw)
            } catch {}

            // 按分类汇总
            const catMap = new Map<string, number>()
            for (const t of todos) {
                const cat = (t as any).category || '未分类'
                catMap.set(cat, (catMap.get(cat) || 0) + 1)
            }
            const summary = Array.from(catMap.entries()).map(([cat, n]) => `${cat} ${n}项`).join('，')

            this.dispatcher.sendToChannels(channels, {
                title: `待办总结：还有 ${todos.length} 项未完成`,
                body: summary,
                icon: '📊',
                reminderId: 0
            }).catch(err => {
                console.error('[调度器] 发送待办总结通知失败:', err.message)
            })

            console.log(`[调度器] 发送待办总结通知: ${todos.length} 项未完成`)
        } catch (error: any) {
            console.error('[调度器] 检查待办总结时出错:', error.message)
        }
    }

    private calculateNextTrigger(reminder: Reminder): string {
        const unit = reminder.interval_unit
        const value = reminder.interval_value

        if (['minutes', 'hours', 'days'].includes(unit)) {
            const multipliers: Record<string, number> = {
                minutes: 60 * 1000,
                hours: 60 * 60 * 1000,
                days: 24 * 60 * 60 * 1000
            }
            const intervalMs = value * multipliers[unit]
            return getLocalDateTimeStr(new Date(Date.now() + intervalMs))
        }

        // months / years
        const next = new Date()
        if (unit === 'months') {
            next.setMonth(next.getMonth() + value)
        } else if (unit === 'years') {
            next.setFullYear(next.getFullYear() + value)
        }
        return getLocalDateTimeStr(next)
    }

    private isWithinActiveHours(reminder: Reminder): boolean {
        if (!reminder.active_hours_start || !reminder.active_hours_end) return true

        const now = new Date()
        const currentMinutes = now.getHours() * 60 + now.getMinutes()

        const [startH, startM] = reminder.active_hours_start.split(':').map(Number)
        const [endH, endM] = reminder.active_hours_end.split(':').map(Number)
        const startMinutes = startH * 60 + startM
        const endMinutes = endH * 60 + endM

        return currentMinutes >= startMinutes && currentMinutes <= endMinutes
    }

    /** 检查当前星期几是否在提醒的 weekdays 列表中 */
    private matchesWeekday(reminder: Reminder): boolean {
        if (!reminder.weekdays) return true
        try {
            const days: number[] = JSON.parse(reminder.weekdays)
            if (days.length === 0) return true
            const today = new Date().getDay() // 0=周日, 1=周一, ..., 6=周六
            return days.includes(today)
        } catch {
            return true
        }
    }

    /** 检查今天是否是工作日（当 workday_only 开启时） */
    private matchesWorkday(reminder: Reminder): boolean {
        if (!reminder.workday_only) return true
        const today = getLocalDateStr()
        return workdaysDb.isWorkday(today)
    }

    /** 检查今天是否是节假日（当 holiday_only 开启时） */
    private matchesHoliday(reminder: Reminder): boolean {
        if (!reminder.holiday_only) return true
        const today = getLocalDateStr()
        return !workdaysDb.isWorkday(today)
    }

    /** 计算下一个农历日期对应的阳历触发时间 */
    private calculateNextLunarTrigger(reminder: Reminder): string {
        const lunarDate = reminder.lunar_date! // 格式: "01-01"
        const now = new Date()
        const currentYear = now.getFullYear()
        const time = reminder.start_time ? reminder.start_time.slice(11, 16) : '09:00'

        // 尝试当年和下一年
        for (let y = currentYear; y <= currentYear + 1; y++) {
            try {
                const result = getSolarDateFromLunar(`${y}-${lunarDate}`)
                if (result?.date) {
                    const triggerDate = new Date(`${result.date}T${time}:00`)
                    if (triggerDate > now) {
                        return getLocalDateTimeStr(triggerDate)
                    }
                }
            } catch { /* ignore */
            }
        }

        // 回退：1年后
        const next = new Date(now)
        next.setFullYear(next.getFullYear() + 1)
        return next.toISOString()
    }
}
