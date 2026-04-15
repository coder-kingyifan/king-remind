import * as readline from 'readline'
import {app} from 'electron'
import {settingsDb} from './db/settings'
import {modelConfigsDb} from './db/model-configs'
import {remindersDb} from './db/reminders'
import {chatWithLLM, PROVIDERS, testModelConnection} from './llm'
import type {StreamEvent} from './llm'
import {ReminderScheduler} from './scheduler'
import {
    isDatabaseEncrypted,
    setEncryptionPassword,
    verifyEncryptionPassword,
    removeEncryption as removeDbEncryption,
    saveDatabase
} from './db/connection'
import {runMigrations} from './db/migrations'
import {NotificationDispatcher} from './notifications/dispatcher'
import {startApiServer} from './api-server'

// ======================== ANSI 颜色 ========================

const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
}

function log(msg: string): void {
    process.stdout.write(msg + '\n')
}

function question(rl: readline.Interface, prompt: string): Promise<string> {
    return new Promise(resolve => {
        rl.question(prompt, answer => {
            resolve(answer.trim())
        })
    })
}

// ======================== 欢迎横幅 ========================

function printBanner(): void {
    const port = settingsDb.get('api_port') || '33333'
    const host = settingsDb.get('api_host') || '0.0.0.0'
    log('')
    log(`${C.cyan}${C.bold}===============================================${C.reset}`)
    log(`${C.cyan}${C.bold}  King 提醒助手 - 终端模式${C.reset}`)
    log(`${C.cyan}${C.bold}===============================================${C.reset}`)
    log('')
    log(`  ${C.yellow}可用命令:${C.reset}`)
    log(`    ${C.green}/help${C.reset}          显示帮助`)
    log(`    ${C.green}/config${C.reset}        配置 AI 模型`)
    log(`    ${C.green}/chat${C.reset}          AI 对话模式`)
    log(`    ${C.green}/models${C.reset}        管理模型配置`)
    log(`    ${C.green}/reminders${C.reset}     管理提醒`)
    log(`    ${C.green}/status${C.reset}        系统状态`)
    log(`    ${C.green}/setup${C.reset}         初始设置`)
    log(`    ${C.green}/quit${C.reset}          退出`)
    log('')
    log(`  ${C.dim}API 服务: http://${host}:${port}${C.reset}`)
    log(`  ${C.dim}提示: 直接输入文字即可与 AI 对话${C.reset}`)
    log('')
    log(`${C.cyan}${C.bold}===============================================${C.reset}`)
    log('')
}

// ======================== 命令处理 ========================

function normalizeHelpTopic(raw?: string): string {
    return (raw || '').trim().replace(/^\/+/, '').toLowerCase()
}

function handleHelp(args: string[] = []): void {
    const topic = normalizeHelpTopic(args[0])

    if (!topic) {
        log('')
        log(`${C.bold}可用命令:${C.reset}`)
        log(`  ${C.green}/help${C.reset}          显示帮助`)
        log(`  ${C.green}/config${C.reset}        配置 AI 模型`)
        log(`  ${C.green}/chat${C.reset}          AI 对话模式`)
        log(`  ${C.green}/reminders${C.reset}     管理提醒`)
        log(`  ${C.green}/models${C.reset}        管理模型配置`)
        log(`  ${C.green}/status${C.reset}        系统状态`)
        log(`  ${C.green}/setup${C.reset}         初始设置`)
        log(`  ${C.green}/quit${C.reset}          退出`)
        log('')
        log(`${C.dim}提示: 使用 /help /config 这种格式可查看某个命令详情${C.reset}`)
        log('')
        return
    }

    log('')
    switch (topic) {
        case 'help':
            log(`${C.bold}/help${C.reset} - 显示帮助`)
            log(`  用法: ${C.green}/help${C.reset}`)
            log(`  用法: ${C.green}/help /<命令>${C.reset}`)
            break
        case 'config':
            log(`${C.bold}/config${C.reset} - 配置 AI 模型`)
            log(`  用法: ${C.green}/config${C.reset}`)
            log(`  用法: ${C.green}/config show${C.reset}`)
            log(`  用法: ${C.green}/config test${C.reset}`)
            break
        case 'chat':
            log(`${C.bold}/chat${C.reset} - AI 对话模式`)
            log(`  用法: ${C.green}/chat${C.reset}`)
            log(`  用法: ${C.green}/chat <消息>${C.reset}`)
            break
        case 'reminders':
            log(`${C.bold}/reminders${C.reset} - 管理提醒`)
            log(`  用法: ${C.green}/reminders${C.reset}`)
            log(`  用法: ${C.green}/reminders toggle <id>${C.reset}`)
            log(`  用法: ${C.green}/reminders delete <id>${C.reset}`)
            break
        case 'models':
            log(`${C.bold}/models${C.reset} - 管理模型配置`)
            log(`  用法: ${C.green}/models${C.reset}`)
            log(`  用法: ${C.green}/models default <id>${C.reset}`)
            log(`  用法: ${C.green}/models test <id>${C.reset}`)
            log(`  用法: ${C.green}/models delete <id>${C.reset}`)
            break
        case 'status':
            log(`${C.bold}/status${C.reset} - 系统状态`)
            log(`  用法: ${C.green}/status${C.reset}`)
            break
        case 'setup':
            log(`${C.bold}/setup${C.reset} - 初始设置`)
            log(`  用法: ${C.green}/setup${C.reset}`)
            break
        case 'quit':
        case 'exit':
            log(`${C.bold}/quit${C.reset} - 退出`)
            log(`  用法: ${C.green}/quit${C.reset}`)
            break
        default:
            log(`${C.yellow}未找到命令 /${topic} 的帮助${C.reset}`)
            log(`可用命令: /help /config /chat /reminders /models /status /setup /quit`)
            break
    }
    log('')
}
async function handleConfig(rl: readline.Interface, args: string[]): Promise<void> {
    const subCmd = args[0]

    if (subCmd === 'show') {
        const defaultModel = modelConfigsDb.getDefault()
        if (!defaultModel) {
            log(`${C.yellow}尚未配置任何模型，请使用 /config 命令配置${C.reset}`)
            return
        }
        const provider = PROVIDERS.find(p => p.id === defaultModel.provider)
        log('')
        log(`${C.bold}当前默认模型:${C.reset}`)
        log(`  名称:     ${C.cyan}${defaultModel.name}${C.reset}`)
        log(`  服务商:   ${provider?.name || defaultModel.provider}`)
        log(`  模型:     ${defaultModel.model}`)
        log(`  API 地址: ${defaultModel.base_url || provider?.baseUrl || '-'}`)
        log(`  API Key:  ${defaultModel.api_key ? '****' + defaultModel.api_key.slice(-4) : '未设置'}`)
        log(`  类型:     ${defaultModel.model_type}`)
        log('')
        return
    }

    if (subCmd === 'test') {
        const defaultModel = modelConfigsDb.getDefault()
        if (!defaultModel) {
            log(`${C.yellow}尚未配置模型，请先使用 /config 配置${C.reset}`)
            return
        }
        const provider = PROVIDERS.find(p => p.id === defaultModel.provider)
        log(`${C.yellow}正在测试连接...${C.reset}`)
        const result = await testModelConnection({
            provider: defaultModel.provider,
            base_url: defaultModel.base_url || provider?.baseUrl || '',
            api_key: defaultModel.api_key,
            model: defaultModel.model
        })
        if (result.ok) {
            log(`${C.green}连接成功!${C.reset} 回复: ${result.reply || '(空)'}`)
        } else {
            log(`${C.red}连接失败: ${result.message}${C.reset}`)
        }
        return
    }

    // 交互式配置向导
    log('')
    log(`${C.bold}配置 AI 模型${C.reset}`)
    log(`${C.dim}选择服务商并填写配置信息${C.reset}`)
    log('')

    // Step 1: 选择服务商
    log('请选择 AI 服务商:')
    PROVIDERS.forEach((p, i) => {
        log(`  ${C.cyan}${i + 1}${C.reset}. ${p.name}`)
    })
    const providerIdx = await question(rl, `请输入编号 [1-${PROVIDERS.length}]: `)
    const idx = parseInt(providerIdx) - 1
    if (idx < 0 || idx >= PROVIDERS.length || isNaN(idx)) {
        log(`${C.red}无效的编号${C.reset}`)
        return
    }
    const provider = PROVIDERS[idx]
    log(`已选择: ${C.cyan}${provider.name}${C.reset}`)
    log('')

    // Step 2: 配置名称
    const name = await question(rl, `配置名称 [${provider.name}]: `) || provider.name

    // Step 3: API Key
    let apiKey = ''
    if (provider.apiKeyRequired) {
        apiKey = await question(rl, 'API Key: ')
        if (!apiKey) {
            log(`${C.red}该服务商需要 API Key${C.reset}`)
            return
        }
    } else {
        log(`${C.dim}该服务商不需要 API Key${C.reset}`)
    }

    // Step 4: Base URL
    const defaultUrl = provider.baseUrl
    const baseUrl = await question(rl, `Base URL [${defaultUrl}]: `) || defaultUrl

    // Step 5: 模型名称
    let model = provider.defaultModel
    if (provider.models.length > 0) {
        log('可用模型:')
        provider.models.forEach((m, i) => {
            log(`  ${C.cyan}${i + 1}${C.reset}. ${m}`)
        })
        log(`  ${C.cyan}0${C.reset}. 自定义输入`)
        const modelChoice = await question(rl, `请选择模型 [1]: `)
        const modelIdx = parseInt(modelChoice) - 1
        if (modelIdx === -1 || isNaN(modelIdx)) {
            // Use default (first model)
        } else if (modelIdx >= 0 && modelIdx < provider.models.length) {
            model = provider.models[modelIdx]
        } else if (modelChoice === '0') {
            const customModel = await question(rl, '请输入模型名称: ')
            if (!customModel) {
                log(`${C.red}模型名称不能为空${C.reset}`)
                return
            }
            model = customModel
        }
    } else {
        const customModel = await question(rl, `模型名称 [${provider.defaultModel}]: `)
        if (customModel) model = customModel
    }

    // Step 6: 设为默认
    const setDefault = await question(rl, '设为默认模型? (y/n) [y]: ')
    const isDefault = setDefault !== 'n' && setDefault !== 'N'

    log('')
    log(`${C.yellow}正在保存配置...${C.reset}`)

    try {
        const config = modelConfigsDb.create({
            name,
            provider: provider.id,
            base_url: baseUrl,
            api_key: apiKey,
            model,
            models: provider.models,
            model_type: 'text',
            is_default: isDefault
        })
        log(`${C.green}配置已保存: ${config.name} (${config.model})${C.reset}`)
    } catch (e: any) {
        log(`${C.red}保存失败: ${e.message}${C.reset}`)
        return
    }

    // 询问是否测试连接
    const doTest = await question(rl, '是否测试连接? (y/n) [y]: ')
    if (doTest !== 'n' && doTest !== 'N') {
        log(`${C.yellow}正在连接...${C.reset}`)
        const result = await testModelConnection({
            provider: provider.id,
            base_url: baseUrl,
            api_key: apiKey,
            model
        })
        if (result.ok) {
            log(`${C.green}连接成功!${C.reset} 回复: ${result.reply || '(空)'}`)
        } else {
            log(`${C.red}连接失败: ${result.message}${C.reset}`)
        }
    }
    log('')
}

async function handleChat(rl: readline.Interface, scheduler: ReminderScheduler | null, args: string[]): Promise<void> {
    const defaultModel = modelConfigsDb.getDefault()
    if (!defaultModel) {
        log(`${C.yellow}尚未配置 AI 模型，请先使用 /config 命令配置${C.reset}`)
        return
    }

    // 单条消息模式
    if (args.length > 0) {
        const message = args.join(' ')
        await streamChat(scheduler, [{role: 'user', content: message}])
        return
    }

    // 交互式聊天模式
    log('')
    log(`${C.cyan}进入聊天模式 (输入 /exit 或空行退出)${C.reset}`)
    log('')

    const history: Array<{role: string; content: string}> = []

    while (true) {
        const input = await question(rl, `${C.green}chat> ${C.reset}`)
        if (!input || input === '/exit') {
            log(`${C.dim}退出聊天模式${C.reset}`)
            break
        }

        history.push({role: 'user', content: input})
        const result = await streamChat(scheduler, [...history])

        if (result.reply) {
            history.push({role: 'assistant', content: result.reply})
        }

        // Keep history manageable
        if (history.length > 20) {
            history.splice(0, 2)
        }
    }
}

async function streamChat(
    scheduler: ReminderScheduler | null,
    messages: Array<{role: string; content: string}>
): Promise<{reply: string}> {
    let lastStatus = ''

    try {
        const result = await chatWithLLM(messages, scheduler, undefined, undefined, (event: StreamEvent) => {
            switch (event.type) {
                case 'status':
                    process.stdout.write(`\r\x1b[2K\x1b[33m${event.text}\x1b[0m`)
                    lastStatus = event.text
                    break
                case 'chunk':
                    if (lastStatus) {
                        process.stdout.write(`\r\x1b[2K`)
                        lastStatus = ''
                    }
                    process.stdout.write(event.text)
                    break
                case 'thinking':
                    process.stdout.write(`\x1b[2m${event.text}\x1b[0m`)
                    break
                case 'tool_start':
                    process.stdout.write(`\n\x1b[36m[工具] ${getToolDisplayName(event.name)}...\x1b[0m\n`)
                    break
                case 'tool_result':
                    process.stdout.write(`\x1b[32m[完成]\x1b[0m\n`)
                    break
                case 'done':
                    process.stdout.write('\n')
                    break
                case 'error':
                    process.stdout.write(`\n\x1b[31m错误: ${event.message}\x1b[0m\n`)
                    break
            }
        })
        return {reply: result.reply}
    } catch (e: any) {
        process.stdout.write(`\n${C.red}对话失败: ${e.message}${C.reset}\n`)
        return {reply: ''}
    }
}

function getToolDisplayName(name: string): string {
    const names: Record<string, string> = {
        create_reminder: '创建提醒',
        list_reminders: '查询提醒列表',
        delete_reminder: '删除提醒',
        toggle_reminder: '切换提醒状态',
        list_skills: '查询技能列表',
        execute_skill: '执行技能'
    }
    return names[name] || name
}

function handleModels(args: string[]): void {
    const subCmd = args[0]

    if (subCmd === 'default' && args[1]) {
        const id = parseInt(args[1])
        if (isNaN(id)) {
            log(`${C.red}无效的 ID${C.reset}`)
            return
        }
        const model = modelConfigsDb.get(id)
        if (!model) {
            log(`${C.red}模型配置 #${id} 不存在${C.reset}`)
            return
        }
        modelConfigsDb.setDefault(id)
        log(`${C.green}已将 "${model.name}" 设为默认模型${C.reset}`)
        return
    }

    if (subCmd === 'delete' && args[1]) {
        const id = parseInt(args[1])
        if (isNaN(id)) {
            log(`${C.red}无效的 ID${C.reset}`)
            return
        }
        const deleted = modelConfigsDb.delete(id)
        if (deleted) {
            log(`${C.green}已删除模型配置 #${id}${C.reset}`)
        } else {
            log(`${C.red}模型配置 #${id} 不存在${C.reset}`)
        }
        return
    }

    if (subCmd === 'test' && args[1]) {
        const id = parseInt(args[1])
        if (isNaN(id)) {
            log(`${C.red}无效的 ID${C.reset}`)
            return
        }
        const model = modelConfigsDb.get(id)
        if (!model) {
            log(`${C.red}模型配置 #${id} 不存在${C.reset}`)
            return
        }
        const provider = PROVIDERS.find(p => p.id === model.provider)
        log(`${C.yellow}正在测试连接...${C.reset}`)
        testModelConnection({
            provider: model.provider,
            base_url: model.base_url || provider?.baseUrl || '',
            api_key: model.api_key,
            model: model.model
        }).then(result => {
            if (result.ok) {
                log(`${C.green}连接成功!${C.reset} 回复: ${result.reply || '(空)'}`)
            } else {
                log(`${C.red}连接失败: ${result.message}${C.reset}`)
            }
        })
        return
    }

    // 列出所有模型
    const models = modelConfigsDb.list()
    if (models.length === 0) {
        log(`${C.yellow}尚未配置任何模型，请使用 /config 命令配置${C.reset}`)
        return
    }
    log('')
    log(`${C.bold}模型配置列表:${C.reset}`)
    for (const m of models) {
        const defaultTag = m.is_default ? ` ${C.green}[默认]${C.reset}` : ''
        const provider = PROVIDERS.find(p => p.id === m.provider)
        log(`  ${C.cyan}#${m.id}${C.reset} ${m.name} - ${provider?.name || m.provider} / ${m.model}${defaultTag}`)
    }
    log('')
}

function handleReminders(args: string[]): void {
    const subCmd = args[0]

    if (subCmd === 'toggle' && args[1]) {
        const id = parseInt(args[1])
        if (isNaN(id)) {
            log(`${C.red}无效的 ID${C.reset}`)
            return
        }
        const result = remindersDb.toggleActive(id)
        if (result) {
            const state = result.is_active ? `${C.green}启用${C.reset}` : `${C.red}禁用${C.reset}`
            log(`提醒 #${id} "${result.title}" 已${state}`)
        } else {
            log(`${C.red}提醒 #${id} 不存在${C.reset}`)
        }
        return
    }

    if (subCmd === 'delete' && args[1]) {
        const id = parseInt(args[1])
        if (isNaN(id)) {
            log(`${C.red}无效的 ID${C.reset}`)
            return
        }
        const deleted = remindersDb.delete(id)
        if (deleted) {
            log(`${C.green}已删除提醒 #${id}${C.reset}`)
        } else {
            log(`${C.red}提醒 #${id} 不存在${C.reset}`)
        }
        return
    }

    // 列出提醒
    const reminders = remindersDb.list()
    if (reminders.length === 0) {
        log(`${C.dim}暂无提醒${C.reset}`)
        return
    }
    log('')
    log(`${C.bold}提醒列表:${C.reset}`)
    for (const r of reminders) {
        const state = r.is_active ? `${C.green}●${C.reset}` : `${C.red}○${C.reset}`
        const type = r.remind_type === 'interval'
            ? `每${r.interval_value}${unitLabel(r.interval_unit)}`
            : '定时'
        log(`  ${state} ${C.cyan}#${r.id}${C.reset} ${r.icon} ${r.title} (${type})`)
        if (r.next_trigger_at) {
            const next = new Date(r.next_trigger_at).toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})
            log(`      ${C.dim}下次触发: ${next}${C.reset}`)
        }
    }
    log('')
}

function unitLabel(unit: string): string {
    const labels: Record<string, string> = {
        minutes: '分钟',
        hours: '小时',
        days: '天',
        months: '月',
        years: '年'
    }
    return labels[unit] || unit
}

function handleStatus(): void {
    const port = settingsDb.get('api_port') || '33333'
    const host = settingsDb.get('api_host') || '0.0.0.0'
    const setupDone = settingsDb.get('setup_done')
    const nickname = settingsDb.get('user_nickname')
    const defaultModel = modelConfigsDb.getDefault()
    const reminderStats = remindersDb.getTodayStats()

    log('')
    log(`${C.bold}系统状态:${C.reset}`)
    log(`  初始化:   ${setupDone === 'true' ? `${C.green}已完成` : `${C.yellow}未完成`}${C.reset}`)
    log(`  昵称:     ${nickname || C.dim + '未设置' + C.reset}`)
    log(`  API 服务: ${C.green}http://${host}:${port}${C.reset}`)
    log(`  数据库:   ${C.green}已连接${C.reset}`)
    log(`  默认模型: ${defaultModel ? `${C.cyan}${defaultModel.name} (${defaultModel.model})` : `${C.yellow}未配置`}${C.reset}`)
    log(`  提醒统计: ${reminderStats.total} 总数 / ${reminderStats.active} 启用 / ${reminderStats.triggeredToday} 今日已触发`)
    log('')
}

async function handleSetup(rl: readline.Interface): Promise<void> {
    log('')
    log(`${C.bold}初始设置${C.reset}`)
    log('')

    // 昵称
    const currentNickname = settingsDb.get('user_nickname')
    const nickname = await question(rl, `昵称 [${currentNickname || 'King'}]: `)
    if (nickname) {
        settingsDb.set('user_nickname', nickname)
    }

    // API 端口
    const currentPort = settingsDb.get('api_port') || '33333'
    const port = await question(rl, `API 端口 [${currentPort}]: `)
    if (port) {
        settingsDb.set('api_port', port)
    }

    // API Token
    const currentToken = settingsDb.get('api_token') || ''
    const token = await question(rl, `API Token [${currentToken ? '****' : '无'}]: `)
    if (token) {
        settingsDb.set('api_token', token)
    }

    settingsDb.set('setup_done', 'true')
    log('')
    log(`${C.green}设置已保存!${C.reset}`)
    log('')
}

// ======================== 加密数据库（仅用于 /setup） ========================

// 加密相关函数仅由 /setup 命令使用，启动时由 index.ts 自动加载密钥

// ======================== 主入口 ========================

export async function startRepl(scheduler: ReminderScheduler | null): Promise<void> {
    if (!process.stdin.isTTY) {
        log(`${C.dim}[REPL] 非交互式终端，REPL 已跳过${C.reset}`)
        log(`${C.dim}[REPL] 使用 docker run -it ... 进入交互模式${C.reset}`)
        return
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: `${C.cyan}king-remind> ${C.reset}`
    })

    printBanner()
    rl.prompt()

    rl.on('line', async (line: string) => {
        const input = line.trim()
        if (!input) {
            rl.prompt()
            return
        }

        // 以 / 开头的是命令
        if (input.startsWith('/')) {
            const parts = input.slice(1).split(/\s+/)
            const cmd = parts[0].toLowerCase()
            const args = parts.slice(1)

            switch (cmd) {
                case 'help':
                case 'h':
                case '?':
                    handleHelp(args)
                    break
                case 'config':
                    await handleConfig(rl, args)
                    break
                case 'chat':
                    await handleChat(rl, scheduler, args)
                    break
                case 'models':
                    handleModels(args)
                    break
                case 'reminders':
                case 'list':
                    handleReminders(args)
                    break
                case 'status':
                    handleStatus()
                    break
                case 'setup':
                    await handleSetup(rl)
                    break
                case 'quit':
                case 'exit':
                case 'q':
                    log(`${C.dim}正在退出...${C.reset}`)
                    rl.close()
                    app.quit()
                    return
                default:
                    log(`${C.yellow}未知命令: /${cmd}，输入 /help 查看帮助${C.reset}`)
            }
        } else {
            // 直接输入文字 → 发送给 AI
            const defaultModel = modelConfigsDb.getDefault()
            if (!defaultModel) {
                log(`${C.yellow}尚未配置 AI 模型，请先使用 /config 命令配置${C.reset}`)
            } else {
                await streamChat(scheduler, [{role: 'user', content: input}])
            }
        }

        rl.prompt()
    })

    rl.on('close', () => {
        log(`${C.dim}再见!${C.reset}`)
        app.quit()
    })
}

/**
 * Headless 模式的完整初始化流程
 * 在 electron/main/index.ts 的 app.whenReady() 中调用
 * 数据库加密/密钥加载由 index.ts 在调用此函数前完成
 */
export async function continueHeadlessInit(): Promise<void> {
    // 运行迁移
    console.log('[Headless] 正在运行数据库迁移...')
    runMigrations()
    console.log('[Headless] 数据库迁移完成')

    // 跳过引导设置
    const setupDone = settingsDb.get('setup_done')
    if (setupDone !== 'true') {
        settingsDb.set('setup_done', 'true')
        console.log('[Headless] 已自动完成初始设置')
    }

    // 创建调度器（不需要通知窗口）
    const dispatcher = new NotificationDispatcher(null)
    const scheduler = new ReminderScheduler(dispatcher)
    const intervalStr = settingsDb.get('scheduler_interval') || '60'
    scheduler.start(parseInt(intervalStr) * 1000)
    console.log('[Headless] 提醒调度器已启动')

    // 强制启用并启动 API 服务
    settingsDb.set('api_enabled', 'true')
    startApiServer(scheduler)

    // 启动 REPL
    await startRepl(scheduler)
}
