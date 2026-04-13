import axios from 'axios'
import {skillsDb} from '../db/skills'
import {modelConfigsDb} from '../db/model-configs'
import {chatWithLLM, callSearchAPI} from '../llm'
import {getLunarDate, getSolarTerms, getLunarFestivals, isHoliday, getDayDetail} from 'chinese-days'
import {skillContentDb} from '../db/skill-content'

// ======================== AI Mode Helper ========================

type AiMode = 'auto' | 'always' | 'local'

/** 解析用户配置中的 use_ai 模式 */
function getAiMode(userConfig: Record<string, any>): AiMode {
    const mode = userConfig.use_ai
    if (mode === 'always' || mode === 'local') return mode
    return 'auto'  // 默认 auto
}

/** 根据模式决定是否尝试 AI：auto/always 返回 true，local 返回 false */
function shouldTryAi(mode: AiMode): boolean {
    return mode !== 'local'
}

/** 根据模式决定是否允许回退本地：auto/local 返回 true，always 返回 false */
function canFallbackToLocal(mode: AiMode): boolean {
    return mode !== 'always'
}

// ======================== Static Data (only for non-content skills) ========================

const HOROSCOPE_DATA: Record<string, { name: string; element: string; traits: string }> = {
    aries: { name: '白羊座', element: '火', traits: '热情、勇敢、直率' },
    taurus: { name: '金牛座', element: '土', traits: '稳重、务实、耐心' },
    gemini: { name: '双子座', element: '风', traits: '聪明、善变、好奇' },
    cancer: { name: '巨蟹座', element: '水', traits: '温柔、敏感、重感情' },
    leo: { name: '狮子座', element: '火', traits: '自信、大方、领导力' },
    virgo: { name: '处女座', element: '土', traits: '细心、完美、务实' },
    libra: { name: '天秤座', element: '风', traits: '优雅、公正、和谐' },
    scorpio: { name: '天蝎座', element: '水', traits: '神秘、坚韧、洞察力' },
    sagittarius: { name: '射手座', element: '火', traits: '乐观、自由、冒险' },
    capricorn: { name: '摩羯座', element: '土', traits: '勤奋、踏实、有抱负' },
    aquarius: { name: '水瓶座', element: '风', traits: '独立、创新、博爱' },
    pisces: { name: '双鱼座', element: '水', traits: '浪漫、善良、想象力' }
}

// ======================== Utility Functions ========================

function randomPick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
}

// ======================== AI-Powered Dynamic Content ========================

const STRUCTURED_FORMAT_INSTRUCTION = `\n\n请严格按照以下 JSON 格式返回，不要返回其他内容：\n{"title": "简短标题（不超过20字）", "content": "正文内容"}\n如果无法严格 JSON，请确保输出包含明确的标题和正文。`

/** 获取文本模型配置 ID，避免调用联网搜索模型导致 404 */
function getTextModelConfigId(): number | undefined {
    const allConfigs = modelConfigsDb.list()
    const textConfig = allConfigs.find(c => c.model_type === 'text' && c.is_default === 1)
        || allConfigs.find(c => c.model_type === 'text')
        || allConfigs.find(c => c.is_default === 1 && c.model_type !== 'web_search')
        || allConfigs.find(c => c.model_type !== 'web_search')
    return textConfig ? textConfig.id : undefined
}

async function generateWithAI(prompt: string): Promise<string | null> {
    try {
        const result = await chatWithLLM(
            [{role: 'user', content: prompt}],
            null, getTextModelConfigId(), undefined, undefined
        )
        return result.reply || null
    } catch {
        return null
    }
}

// ======================== Builtin Skill Handlers ========================

async function executeWeather(userConfig: Record<string, any>): Promise<string> {
    const city = userConfig.city || '北京'

    // City geocoding map for common Chinese cities
    const cityCoords: Record<string, { lat: number; lon: number; name: string }> = {
        '北京': { lat: 39.9042, lon: 116.4074, name: '北京' },
        '上海': { lat: 31.2304, lon: 121.4737, name: '上海' },
        '广州': { lat: 23.1291, lon: 113.2644, name: '广州' },
        '深圳': { lat: 22.5431, lon: 114.0579, name: '深圳' },
        '成都': { lat: 30.5728, lon: 104.0668, name: '成都' },
        '杭州': { lat: 30.2741, lon: 120.1551, name: '杭州' },
        '武汉': { lat: 30.5928, lon: 114.3055, name: '武汉' },
        '南京': { lat: 32.0603, lon: 118.7969, name: '南京' },
        '重庆': { lat: 29.4316, lon: 106.9123, name: '重庆' },
        '西安': { lat: 34.3416, lon: 108.9398, name: '西安' },
        '天津': { lat: 39.3434, lon: 117.3616, name: '天津' },
        '苏州': { lat: 31.2990, lon: 120.5853, name: '苏州' },
        '长沙': { lat: 28.2282, lon: 112.9388, name: '长沙' },
        '郑州': { lat: 34.7466, lon: 113.6254, name: '郑州' },
        '青岛': { lat: 36.0671, lon: 120.3826, name: '青岛' },
        '大连': { lat: 38.9140, lon: 121.6147, name: '大连' },
        '厦门': { lat: 24.4798, lon: 118.0894, name: '厦门' },
        '昆明': { lat: 25.0389, lon: 102.7183, name: '昆明' },
        '哈尔滨': { lat: 45.8038, lon: 126.5350, name: '哈尔滨' },
        '沈阳': { lat: 41.8057, lon: 123.4315, name: '沈阳' },
        '济南': { lat: 36.6512, lon: 116.9972, name: '济南' },
        '合肥': { lat: 31.8206, lon: 117.2272, name: '合肥' },
        '福州': { lat: 26.0745, lon: 119.2965, name: '福州' },
        '南昌': { lat: 28.6820, lon: 115.8579, name: '南昌' },
        '石家庄': { lat: 38.0428, lon: 114.5149, name: '石家庄' },
        '太原': { lat: 37.8706, lon: 112.5489, name: '太原' },
        '兰州': { lat: 36.0611, lon: 103.8343, name: '兰州' },
        '贵阳': { lat: 26.6470, lon: 106.6302, name: '贵阳' },
        '南宁': { lat: 22.8170, lon: 108.3665, name: '南宁' },
        '海口': { lat: 20.0440, lon: 110.1999, name: '海口' },
        '银川': { lat: 38.4872, lon: 106.2309, name: '银川' },
        '西宁': { lat: 36.6171, lon: 101.7782, name: '西宁' },
        '呼和浩特': { lat: 40.8422, lon: 111.7500, name: '呼和浩特' },
        '乌鲁木齐': { lat: 43.7930, lon: 87.6271, name: '乌鲁木齐' },
        '拉萨': { lat: 29.6500, lon: 91.1000, name: '拉萨' },
        '长春': { lat: 43.8171, lon: 125.3235, name: '长春' },
        '无锡': { lat: 31.4912, lon: 120.3119, name: '无锡' },
        '宁波': { lat: 29.8683, lon: 121.5440, name: '宁波' },
        '佛山': { lat: 23.0218, lon: 113.1219, name: '佛山' },
        '东莞': { lat: 23.0208, lon: 113.7518, name: '东莞' },
        '珠海': { lat: 22.2710, lon: 113.5767, name: '珠海' },
        '温州': { lat: 28.0006, lon: 120.6722, name: '温州' },
        '常州': { lat: 31.8106, lon: 119.9741, name: '常州' },
        '徐州': { lat: 34.2616, lon: 117.1847, name: '徐州' },
        '烟台': { lat: 37.4638, lon: 121.4479, name: '烟台' },
        '中山': { lat: 22.5171, lon: 113.3926, name: '中山' },
        '惠州': { lat: 23.1116, lon: 114.4161, name: '惠州' },
        '保定': { lat: 38.8739, lon: 115.4646, name: '保定' }
    }

    const coords = cityCoords[city]
    if (coords) {
        return fetchWeatherFromApi(coords.lat, coords.lon, coords.name)
    }

    // Try geocoding via Open-Meteo for cities not in the list
    try {
        const geoRes = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
            params: { name: city, count: 5, language: 'zh' },
            timeout: 10000
        })
        const results = geoRes.data?.results
        if (results && results.length > 0) {
            const cnResult = results.find((r: any) => r.country_code === 'CN') || results[0]
            return fetchWeatherFromApi(cnResult.latitude, cnResult.longitude, cnResult.name || city)
        }
    } catch { /* fallback */ }

    return `${city}天气信息暂不可用，请尝试使用具体的城市名称（如"北京"、"上海"）。`
}

async function fetchWeatherFromApi(lat: number, lon: number, cityName: string): Promise<string> {
    try {
        const res = await axios.get('https://api.open-meteo.com/v1/forecast', {
            params: {
                latitude: lat, longitude: lon,
                current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
                daily: 'temperature_2m_max,temperature_2m_min,weather_code',
                timezone: 'Asia/Shanghai',
                forecast_days: 3
            },
            timeout: 10000
        })

        const current = res.data.current
        const daily = res.data.daily
        const temp = Math.round(current.temperature_2m)
        const humidity = current.relative_humidity_2m
        const windSpeed = Math.round(current.wind_speed_10m)
        const weatherDesc = weatherCodeToDesc(current.weather_code)

        let result = `${cityName} · ${weatherDesc}\n`
        result += `当前温度 ${temp}°C，湿度 ${humidity}%，风速 ${windSpeed}km/h\n`

        if (daily) {
            const maxT = Math.round(daily.temperature_2m_max[0])
            const minT = Math.round(daily.temperature_2m_min[0])
            result += `今日 ${minT}°C ~ ${maxT}°C`
        }

        return result
    } catch {
        return `${cityName}天气数据获取失败，请稍后再试。`
    }
}

function weatherCodeToDesc(code: number): string {
    const map: Record<number, string> = {
        0: '☀️ 晴天', 1: '🌤️ 大部晴朗', 2: '⛅ 多云', 3: '☁️ 阴天',
        45: '🌫️ 有雾', 48: '🌫️ 雾凇', 51: '🌧️ 小毛毛雨', 53: '🌧️ 毛毛雨',
        55: '🌧️ 大毛毛雨', 61: '🌧️ 小雨', 63: '🌧️ 中雨', 65: '🌧️ 大雨',
        71: '🌨️ 小雪', 73: '🌨️ 中雪', 75: '🌨️ 大雪', 80: '🌧️ 阵雨',
        81: '🌧️ 中阵雨', 82: '⛈️ 大阵雨', 95: '⛈️ 雷阵雨', 96: '⛈️ 冰雹雷阵雨'
    }
    return map[code] || '🌤️ 未知'
}

async function executeDailyQuote(userConfig: Record<string, any>): Promise<string> {
    const type = userConfig.type || 'mixed'
    const mode = getAiMode(userConfig)
    const typeLabel: Record<string, string> = {mixed: '任意类型', motivational: '励志', philosophy: '哲理', aesthetic: '唯美'}

    // AI 模式
    if (shouldTryAi(mode)) {
        const aiResult = await generateWithAI(
            `请生成一条${typeLabel[type] || ''}每日一言（一句话即可，要有深度和美感，中英不限）。只输出句子本身和作者，不要额外解释。`
        )
        if (aiResult) return `💬 ${aiResult.trim()}`
        if (!canFallbackToLocal(mode)) return 'AI 生成失败，请稍后再试或切换为"自动"模式。'
    }

    // 本地模式：从数据库读取
    if (type === 'mixed') {
        const row = skillContentDb.randomPickMultiCategory('daily_quote', ['motivational', 'philosophy', 'aesthetic'])
        return row ? `💬 ${row.content}` : '💬 暂无名言数据'
    }
    const row = skillContentDb.randomPick('daily_quote', type)
    return row ? `💬 ${row.content}` : '💬 暂无名言数据'
}

function executeCountdown(userConfig: Record<string, any>): string {
    const targetDate = userConfig.target_date
    const eventName = userConfig.event_name || '目标日'

    if (!targetDate) return '请先配置倒计日的目标日期。'

    const target = new Date(targetDate)
    if (isNaN(target.getTime())) return '目标日期格式不正确，请使用 YYYY-MM-DD 格式（如 2025-12-31）。'

    const now = new Date()
    const diffMs = target.getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays > 0) {
        return `⏳ 距离「${eventName}」还有 ${diffDays} 天（${targetDate}）`
    } else if (diffDays === 0) {
        return `🎉 今天就是「${eventName}」！`
    } else {
        return `📅「${eventName}」已过去 ${Math.abs(diffDays)} 天`
    }
}

function executeWaterReminder(userConfig: Record<string, any>): string {
    const now = new Date()
    const hour = now.getHours()
    const cupMl = userConfig.cup_ml || 250
    let timeGreeting = ''
    let suggestion = ''
    let recommendedCups = 0

    if (hour < 9) {
        timeGreeting = '🌅 早上好'
        suggestion = '起床后先喝一杯温水，唤醒身体代谢系统'
        recommendedCups = 1
    } else if (hour < 11) {
        timeGreeting = '☀️ 上午好'
        suggestion = '工作间隙别忘了补充水分，保持精力充沛'
        recommendedCups = 2
    } else if (hour < 14) {
        timeGreeting = '🌤️ 中午好'
        suggestion = '饭后半小时喝杯水，帮助消化吸收'
        recommendedCups = 4
    } else if (hour < 17) {
        timeGreeting = '🌇 下午好'
        suggestion = '下午是缺水高发期，记得喝水提神'
        recommendedCups = 5
    } else if (hour < 20) {
        timeGreeting = '🌆 傍晚好'
        suggestion = '傍晚适量饮水，不要太多以免影响睡眠'
        recommendedCups = 6
    } else {
        timeGreeting = '🌙 晚上好'
        suggestion = '睡前少喝点水，保持良好的睡眠质量'
        recommendedCups = 7
    }

    const totalMl = recommendedCups * cupMl
    return `💧 ${timeGreeting}！该喝水啦\n${suggestion}\n建议每次饮水 ${cupMl}ml，到目前建议已饮 ${totalMl}ml（${recommendedCups} 杯），全天目标 1500-2000ml`
}

async function executePoetry(userConfig: Record<string, any>): Promise<string> {
    const mode = getAiMode(userConfig)

    if (shouldTryAi(mode)) {
        const aiResult = await generateWithAI(
            '请推荐一首优美的中国古诗词（唐诗宋词优先）。格式：\n📜 诗词名\n—— 作者\n\n内容。只输出诗词，不要额外解释。'
        )
        if (aiResult) return aiResult.trim()
        if (!canFallbackToLocal(mode)) return 'AI 生成失败，请稍后再试或切换为"自动"模式。'
    }

    // 本地模式：从数据库读取
    const row = skillContentDb.randomPick('poetry')
    if (!row) return '📜 暂无诗词数据'
    try {
        const extra = JSON.parse(row.extra)
        return `📜 ${extra.title || ''}\n—— ${extra.author || ''}\n\n${row.content}`
    } catch {
        return `📜 ${row.content}`
    }
}

async function executeHealthTip(userConfig: Record<string, any>): Promise<string> {
    const hour = new Date().getHours()
    const period = hour < 12 ? '早晨' : hour < 18 ? '下午' : '晚间'
    const periodKey = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
    const mode = getAiMode(userConfig)

    if (shouldTryAi(mode)) {
        const aiResult = await generateWithAI(
            `现在是${period}，请给出一条实用的健康养生小贴士（一两句话即可，简洁有针对性）。格式：🍎 ${period}健康小贴士\n\n内容`
        )
        if (aiResult) return aiResult.trim()
        if (!canFallbackToLocal(mode)) return 'AI 生成失败，请稍后再试或切换为"自动"模式。'
    }

    // 本地模式：从数据库读取
    const row = skillContentDb.randomPick('health_tip', periodKey)
    return row ? `🍎 ${period}健康小贴士\n\n${row.content}` : `🍎 ${period}健康小贴士\n\n暂无数据`
}

async function executeExercise(userConfig: Record<string, any>): Promise<string> {
    const hour = new Date().getHours()
    const month = new Date().getMonth() + 1
    const mode = getAiMode(userConfig)

    if (shouldTryAi(mode)) {
        const aiResult = await generateWithAI(
            `现在是${month}月，${hour < 12 ? '上午' : hour < 18 ? '下午' : '晚上'}，请给出一条今天的运动建议（根据当前季节和时间段推荐，一两句话即可）。格式：🏃 今日运动建议\n\n建议内容`
        )
        if (aiResult) return aiResult.trim()
        if (!canFallbackToLocal(mode)) return 'AI 生成失败，请稍后再试或切换为"自动"模式。'
    }

    // 本地模式：根据季节和时间段智能选择运动建议分类
    let season: string
    let category: string
    if (month >= 3 && month <= 5) {
        season = '春季'
        category = 'outdoor'
    } else if (month >= 6 && month <= 8) {
        season = '夏季'
        category = hour >= 10 && hour <= 16 ? 'indoor' : 'outdoor'
    } else if (month >= 9 && month <= 11) {
        season = '秋季'
        category = 'outdoor'
    } else {
        season = '冬季'
        category = hour >= 10 && hour <= 14 ? 'outdoor' : 'indoor'
    }

    const row = skillContentDb.randomPick('exercise', category)
    return row ? `🏃 ${season}运动建议\n\n${row.content}` : `🏃 ${season}运动建议\n\n暂无数据`
}

async function executeEnglish(userConfig: Record<string, any>): Promise<string> {
    const mode = getAiMode(userConfig)

    if (shouldTryAi(mode)) {
        const aiResult = await generateWithAI(
            '请教我一个实用的高级英语表达。格式：\n📚 每日英语\n\n单词 音标\n释义：中文意思\n例句：英文例句。只输出这些内容，不要额外解释。'
        )
        if (aiResult) return aiResult.trim()
        if (!canFallbackToLocal(mode)) return 'AI 生成失败，请稍后再试或切换为"自动"模式。'
    }

    // 本地模式：从数据库读取
    const row = skillContentDb.randomPick('english')
    if (!row) return '📚 暂无英语数据'
    try {
        const extra = JSON.parse(row.extra)
        return `📚 每日英语\n\n${extra.word || ''} ${extra.phonetic || ''}\n释义：${extra.meaning || ''}\n例句：${extra.example || ''}`
    } catch {
        return `📚 每日英语\n\n${row.content}`
    }
}

async function executeJoke(userConfig: Record<string, any>): Promise<string> {
    const mode = getAiMode(userConfig)

    if (shouldTryAi(mode)) {
        const aiResult = await generateWithAI(
            '请讲一个轻松幽默的笑话（中文，简短有趣，不要低俗）。格式：😄 每日一笑\n\n笑话内容'
        )
        if (aiResult) return aiResult.trim()
        if (!canFallbackToLocal(mode)) return 'AI 生成失败，请稍后再试或切换为"自动"模式。'
    }

    // 本地模式：从数据库读取
    const row = skillContentDb.randomPick('joke')
    return row ? `😄 每日一笑\n\n${row.content}` : '😄 暂无笑话数据'
}

async function executeHoroscope(userConfig: Record<string, any>): Promise<string> {
    const sign = userConfig.sign || 'aries'
    const data = HOROSCOPE_DATA[sign]
    if (!data) return '未知的星座，请检查配置。'
    const mode = getAiMode(userConfig)

    if (shouldTryAi(mode)) {
        const aiResult = await generateWithAI(
            `请为${data.name}生成今日运势分析，包含：综合运势（百分制+星级）、爱情运势、事业运势、幸运数字、一段建议。格式简洁。`
        )
        if (aiResult) return `⭐ ${data.name}今日运势（${data.element}象 · ${data.traits}）\n\n${aiResult.trim()}`
        if (!canFallbackToLocal(mode)) return 'AI 生成失败，请稍后再试或切换为"自动"模式。'
    }

    // 本地模式：返回星座基本信息和通用建议
    const generalAdvices: Record<string, string> = {
        aries: '今天适合主动出击，但注意控制脾气，三思而后行。',
        taurus: '今天适合处理财务相关的事务，稳扎稳打会有好结果。',
        gemini: '今天社交运不错，适合沟通交流，但注意不要三心二意。',
        cancer: '今天适合关注家庭和亲密关系，给自己一些安静的时间。',
        leo: '今天自信满满，适合展示才华，但注意倾听他人意见。',
        virgo: '今天适合整理和规划，细节决定成败，注意劳逸结合。',
        libra: '今天适合处理人际关系，保持平衡和谐，果断做决定。',
        scorpio: '今天直觉敏锐，适合深入思考，注意适当表达情感。',
        sagittarius: '今天充满冒险精神，适合尝试新事物，注意脚踏实地。',
        capricorn: '今天适合制定长远计划，坚持目标，注意放松身心。',
        aquarius: '今天创意灵感涌现，适合头脑风暴，注意关注身边人感受。',
        pisces: '今天感性丰富，适合艺术创作，注意保持理性判断。'
    }

    return `⭐ ${data.name}今日运势（${data.element}象 · ${data.traits}）\n\n` +
        `💡 ${generalAdvices[sign] || '保持积极心态，好运自然来。'}\n\n` +
        `（注：详细运势分析需要 AI 支持，当前 AI 不可用）`
}

function executeLunarInfo(): string {
    const now = new Date()
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${weekDays[now.getDay()]}`

    try {
        const lunar = getLunarDate(now)
        const lunarStr = `${lunar.lunarYearCN} ${lunar.lunarMonCN}${lunar.lunarDayCN}`
        const zodiacStr = `生肖：${lunar.zodiac}`
        const gzStr = `干支：${lunar.yearCyl}年 ${lunar.monCyl}月 ${lunar.dayCyl}日`

        let result = `🌙 今日农历信息\n\n` +
            `公历：${dateStr}\n` +
            `农历：${lunarStr}\n` +
            `${zodiacStr}\n` +
            `${gzStr}`

        try {
            const todayStr = now.toISOString().slice(0, 10)
            const nextWeek = new Date(now)
            nextWeek.setDate(nextWeek.getDate() + 7)
            const nextWeekStr = nextWeek.toISOString().slice(0, 10)
            const terms = getSolarTerms(todayStr, nextWeekStr)
            if (terms && terms.length > 0) {
                const termInfo = terms.map(t => `${t.name}（${t.date}）`).join('、')
                result += `\n\n🌱 近期节气：${termInfo}`
            }
        } catch { /* 节气查询失败不影响主功能 */ }

        try {
            const todayStr = now.toISOString().slice(0, 10)
            const dayDetail = getDayDetail(todayStr)
            if (dayDetail && dayDetail.name) {
                result += `\n🎉 今日：${dayDetail.name}`
            }
        } catch { /* 节日查询失败不影响主功能 */ }

        try {
            const todayStr = now.toISOString().slice(0, 10)
            const holiday = isHoliday(todayStr)
            if (holiday) {
                result += `\n📌 今日为节假日`
            }
        } catch { /* 忽略 */ }

        return result
    } catch (e: any) {
        console.error('[技能执行器] 农历查询失败:', e.message)
        return `🌙 今日信息\n\n公历：${dateStr}\n\n（农历数据获取失败，请稍后再试）`
    }
}

function executeWorkReport(): string {
    const now = new Date()
    const hour = now.getHours()
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${weekDays[now.getDay()]}`
    const period = hour < 12 ? '上午' : hour < 18 ? '下午' : '今日'

    let focus = ''
    if (hour < 12) {
        focus = `📌 上午总结重点：\n` +
            `  · 昨天遗留的问题是否已解决？\n` +
            `  · 今天上午完成了哪些关键任务？\n` +
            `  · 下午需要优先处理什么？`
    } else if (hour < 18) {
        focus = `📌 下午总结重点：\n` +
            `  · 今天已完成的核心工作有哪些？\n` +
            `  · 遇到了什么阻碍？需要谁的协助？\n` +
            `  · 明天需要跟进的事项是什么？`
    } else {
        focus = `📌 今日总结重点：\n` +
            `  · 今天最重要的3项成果是什么？\n` +
            `  · 有哪些未完成的事项需要明天继续？\n` +
            `  · 今天有什么经验教训值得记录？`
    }

    return `📝 ${period}工作小结提醒\n` +
        `${dateStr}\n\n` +
        `请花5分钟回顾一下：\n\n` +
        `✅ 已完成的任务\n` +
        `⏳ 进行中的任务进展\n` +
        `📋 下一步待办事项\n` +
        `🤔 需要协调或支持的事项\n\n` +
        `${focus}\n\n` +
        `及时总结，高效前行！`
}

// ======================== Skill Executor ========================

const BUILTIN_HANDLERS: Record<string, (config: Record<string, any>) => Promise<string>> = {
    weather: executeWeather,
    daily_quote: executeDailyQuote,
    countdown: (c) => Promise.resolve(executeCountdown(c)),
    water_reminder: (c) => Promise.resolve(executeWaterReminder(c)),
    poetry: executePoetry,
    health_tip: executeHealthTip,
    exercise: executeExercise,
    english: executeEnglish,
    joke: executeJoke,
    horoscope: executeHoroscope,
    lunar_info: () => Promise.resolve(executeLunarInfo()),
    work_report: () => Promise.resolve(executeWorkReport())
}

async function executeApiCall(actionConfig: Record<string, any>, userConfig: Record<string, any>): Promise<string> {
    const url = actionConfig.url
    if (!url) return 'API 地址未配置'

    try {
        const method = (actionConfig.method || 'GET').toLowerCase()
        const headers = typeof actionConfig.headers === 'string' ? JSON.parse(actionConfig.headers) : (actionConfig.headers || {})

        let finalUrl = url
        for (const [key, value] of Object.entries(userConfig)) {
            finalUrl = finalUrl.replace(`{{${key}}}`, String(value))
        }

        const res = await axios({ method, url: finalUrl, headers, timeout: 15000 })
        const data = res.data

        let apiResult: string
        if (actionConfig.response_template) {
            let template = actionConfig.response_template
            if (typeof data === 'object') {
                const flatten = (obj: any, prefix = ''): Record<string, string> => {
                    const result: Record<string, string> = {}
                    for (const [k, v] of Object.entries(obj)) {
                        const key = prefix ? `${prefix}.${k}` : k
                        if (typeof v === 'object' && v !== null) {
                            Object.assign(result, flatten(v, key))
                        } else {
                            result[key] = String(v)
                        }
                    }
                    return result
                }
                const flat = flatten(data)
                for (const [k, v] of Object.entries(flat)) {
                    template = template.replace(`{{${k}}}`, v)
                }
            }
            apiResult = template
        } else {
            const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
            apiResult = text.length > 500 ? text.substring(0, 500) + '...' : text
        }

        if (actionConfig.enable_ai_summary) {
            const summaryPrompt = actionConfig.summary_prompt || '请根据以下 API 返回的数据，提取关键信息并用简洁的中文总结'
            const fullPrompt = `${summaryPrompt}${STRUCTURED_FORMAT_INSTRUCTION}\n\n---\nAPI 返回数据：\n${apiResult}`
            try {
                const result = await chatWithLLM(
                    [{role: 'user', content: fullPrompt}],
                    null, getTextModelConfigId(), undefined, undefined
                )
                if (result.reply) return result.reply
            } catch (e: any) {
                console.error('[技能执行器] API AI 总结失败:', e.message)
            }
        }

        return apiResult
    } catch (e: any) {
        return `API 调用失败: ${e.message}`
    }
}

async function executeAiPrompt(actionConfig: Record<string, any>, userConfig: Record<string, any>): Promise<string> {
    const promptTemplate = actionConfig.prompt_template || actionConfig.prompt || ''
    if (!promptTemplate) return 'AI 提示词未配置'

    let prompt = promptTemplate
    for (const [key, value] of Object.entries(userConfig)) {
        prompt = prompt.replace(`{{${key}}}`, String(value))
    }
    const now = new Date()
    prompt = prompt.replace('{{date}}', now.toISOString().slice(0, 10))
    prompt = prompt.replace('{{time}}', now.toLocaleTimeString('zh-CN'))

    try {
        const result = await chatWithLLM(
            [{ role: 'user', content: prompt }],
            null,
            getTextModelConfigId(),
            undefined,
            undefined
        )
        return result.reply || 'AI 未返回结果'
    } catch (e: any) {
        return `AI 生成失败: ${e.message}`
    }
}

async function executeSearchAndSummarize(actionConfig: Record<string, any>): Promise<string> {
    const searchQuery = actionConfig.search_query || ''
    const searchModelId = actionConfig.search_model_id
    if (!searchQuery) return '搜索问题未配置'
    if (!searchModelId) return '未选择联网搜索模型'

    const now = new Date()
    let query = searchQuery
    query = query.replace('{{date}}', now.toISOString().slice(0, 10))
    query = query.replace('{{time}}', now.toLocaleTimeString('zh-CN'))

    const searchConfig = modelConfigsDb.get(searchModelId)
    if (!searchConfig) return '联网搜索模型配置不存在，请检查技能设置'

    console.log(`[技能执行器] 联网搜索: "${query}"，使用模型: ${searchConfig.name}`)
    let searchResult: string
    try {
        searchResult = await callSearchAPI(searchModelId, query)
        if (!searchResult) return '联网搜索未返回结果'
    } catch (e: any) {
        return `联网搜索失败: ${e.message}`
    }

    const summaryPrompt = actionConfig.summary_prompt || '请根据以下搜索结果，用简洁的中文进行总结，提炼关键信息'
    const fullPrompt = `${summaryPrompt}${STRUCTURED_FORMAT_INSTRUCTION}\n\n---\n搜索结果：\n${searchResult}`

    console.log('[技能执行器] AI 总结中...')
    try {
        const result = await chatWithLLM(
            [{role: 'user', content: fullPrompt}],
            null,
            getTextModelConfigId(),
            undefined,
            undefined
        )
        return result.reply || searchResult
    } catch (e: any) {
        console.error('[技能执行器] AI 总结失败，返回原始搜索结果:', e.message)
        return searchResult
    }
}

// ======================== Main Execution Entry ========================

export async function executeSkill(skillId: number, options?: { skipEnabledCheck?: boolean }): Promise<string> {
    const skill = skillsDb.get(skillId)
    if (!skill) return ''
    if (!skill.is_enabled && !options?.skipEnabledCheck) return ''

    let userConfig: Record<string, any> = {}
    try {
        userConfig = JSON.parse(skill.user_config || '{}')
    } catch { /* ignore */ }

    try {
        if (skill.is_builtin) {
            const handler = BUILTIN_HANDLERS[skill.skill_key]
            if (handler) {
                return await handler(userConfig)
            }
            return `未知内置技能: ${skill.name}`
        }

        let actionConfig: Record<string, any> = {}
        try {
            actionConfig = JSON.parse(skill.action_config || '{}')
        } catch { /* ignore */ }

        if (skill.action_type === 'api_call') {
            return await executeApiCall(actionConfig, userConfig)
        } else if (skill.action_type === 'ai_prompt') {
            return await executeAiPrompt(actionConfig, userConfig)
        } else if (skill.action_type === 'search_and_summarize') {
            return await executeSearchAndSummarize(actionConfig)
        }

        return `未知技能类型: ${skill.action_type}`
    } catch (e: any) {
        console.error(`[技能执行器] 技能"${skill.name}"执行失败:`, e.message)
        return `技能"${skill.name}"执行失败: ${e.message}`
    }
}

export async function executeSkillByKey(skillKey: string): Promise<string> {
    const skill = skillsDb.getByKey(skillKey)
    if (!skill) return ''
    return executeSkill(skill.id)
}
