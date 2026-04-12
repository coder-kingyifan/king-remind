import axios from 'axios'
import {skillsDb} from '../db/skills'
import {modelConfigsDb} from '../db/model-configs'
import {chatWithLLM} from '../llm'

// ======================== Built-in Content Databases ========================

const QUOTES = {
    motivational: [
        '世上无难事，只怕有心人。',
        '不积跬步，无以至千里。 —— 荀子',
        '宝剑锋从磨砺出，梅花香自苦寒来。',
        '天行健，君子以自强不息。 —— 《周易》',
        '有志者事竟成。 —— 《后汉书》',
        '千里之行，始于足下。 —— 老子',
        '路漫漫其修远兮，吾将上下而求索。 —— 屈原',
        '业精于勤，荒于嬉；行成于思，毁于随。 —— 韩愈',
        '长风破浪会有时，直挂云帆济沧海。 —— 李白',
        '山重水复疑无路，柳暗花明又一村。 —— 陆游',
        '天生我材必有用，千金散尽还复来。 —— 李白',
        '博观而约取，厚积而薄发。 —— 苏轼',
        '不畏浮云遮望眼，自缘身在最高层。 —— 王安石',
        '生活不是等待暴风雨过去，而是学会在雨中翩翩起舞。',
        '你若盛开，蝴蝶自来；你若精彩，天自安排。',
        '成功不是终点，失败也不是终结，唯有继续前行的勇气才是最重要的。 —— 丘吉尔',
        '每一个不曾起舞的日子，都是对生命的辜负。 —— 尼采',
        '你的时间有限，不要浪费在过别人的生活上。 —— 乔布斯',
        ' Stay hungry, stay foolish. —— 乔布斯',
        '把每一天当作生命的最后一天来过，终有一天你会发现自己是对的。'
    ],
    philosophy: [
        '人生如逆旅，我亦是行人。 —— 苏轼',
        '万物皆有裂痕，那是光照进来的地方。 —— 莱昂纳德·科恩',
        '未经审视的人生不值得过。 —— 苏格拉底',
        '知人者智，自知者明。 —— 老子',
        '己所不欲，勿施于人。 —— 孔子',
        '人法地，地法天，天法道，道法自然。 —— 老子',
        '吾生也有涯，而知也无涯。 —— 庄子',
        '学而不思则罔，思而不学则殆。 —— 孔子',
        '三人行，必有我师焉。 —— 孔子',
        '生命中最困难的时刻，恰恰是转变的最佳时机。',
        '你所浪费的今天，是昨天去世的人奢望的明天。',
        '世界上只有一种英雄主义，就是认清了生活的真相后依然热爱它。 —— 罗曼·罗兰',
        '人的一切痛苦，本质上都是对自己无能的愤怒。 —— 王小波',
        '你不能控制风的方向，但你可以调整帆的角度。',
        '真正的平静，不是避开车马喧嚣，而是在心中修篱种菊。'
    ],
    aesthetic: [
        '春风十里不如你。 —— 冯唐',
        '从前的日色变得慢，车马邮件都慢，一生只够爱一个人。 —— 木心',
        '我明白你会来，所以我等。 —— 沈从文',
        '你是一树一树的花开，是燕在梁间呢喃。 —— 林徽因',
        '草在结它的种子，风在摇它的叶子，我们站着，不说话，就十分美好。 —— 顾城',
        '面朝大海，春暖花开。 —— 海子',
        '黑夜给了我黑色的眼睛，我却用它寻找光明。 —— 顾城',
        '生如夏花之绚烂，死如秋叶之静美。 —— 泰戈尔',
        '天空没有翅膀的痕迹，而我已飞过。 —— 泰戈尔',
        '愿你出走半生，归来仍是少年。'
    ]
}

const POEMS = [
    { title: '静夜思', author: '李白', content: '床前明月光，疑是地上霜。\n举头望明月，低头思故乡。' },
    { title: '春晓', author: '孟浩然', content: '春眠不觉晓，处处闻啼鸟。\n夜来风雨声，花落知多少。' },
    { title: '登鹳雀楼', author: '王之涣', content: '白日依山尽，黄河入海流。\n欲穷千里目，更上一层楼。' },
    { title: '相思', author: '王维', content: '红豆生南国，春来发几枝。\n愿君多采撷，此物最相思。' },
    { title: '望庐山瀑布', author: '李白', content: '日照香炉生紫烟，遥看瀑布挂前川。\n飞流直下三千尺，疑是银河落九天。' },
    { title: '绝句', author: '杜甫', content: '两个黄鹂鸣翠柳，一行白鹭上青天。\n窗含西岭千秋雪，门泊东吴万里船。' },
    { title: '枫桥夜泊', author: '张继', content: '月落乌啼霜满天，江枫渔火对愁眠。\n姑苏城外寒山寺，夜半钟声到客船。' },
    { title: '游子吟', author: '孟郊', content: '慈母手中线，游子身上衣。\n临行密密缝，意恐迟迟归。\n谁言寸草心，报得三春晖。' },
    { title: '江雪', author: '柳宗元', content: '千山鸟飞绝，万径人踪灭。\n孤舟蓑笠翁，独钓寒江雪。' },
    { title: '出塞', author: '王昌龄', content: '秦时明月汉时关，万里长征人未还。\n但使龙城飞将在，不教胡马度阴山。' },
    { title: '送元二使安西', author: '王维', content: '渭城朝雨浥轻尘，客舍青青柳色新。\n劝君更尽一杯酒，西出阳关无故人。' },
    { title: '悯农', author: '李绅', content: '锄禾日当午，汗滴禾下土。\n谁知盘中餐，粒粒皆辛苦。' },
    { title: '早发白帝城', author: '李白', content: '朝辞白帝彩云间，千里江陵一日还。\n两岸猿声啼不住，轻舟已过万重山。' },
    { title: '望岳', author: '杜甫', content: '岱宗夫如何？齐鲁青未了。\n造化钟神秀，阴阳割昏晓。\n荡胸生曾云，决眦入归鸟。\n会当凌绝顶，一览众山小。' },
    { title: '竹石', author: '郑燮', content: '咬定青山不放松，立根原在破岩中。\n千磨万击还坚劲，任尔东西南北风。' }
]

const ENGLISH = [
    { word: 'Serendipity', phonetic: '/ˌserənˈdɪpəti/', meaning: '意外发现美好事物的运气', example: 'Finding that book was pure serendipity.' },
    { word: 'Resilience', phonetic: '/rɪˈzɪliəns/', meaning: '韧性，恢复力', example: 'Her resilience helped her overcome many challenges.' },
    { word: 'Ephemeral', phonetic: '/ɪˈfemərəl/', meaning: '短暂的，转瞬即逝的', example: 'The beauty of cherry blossoms is ephemeral.' },
    { word: 'Wanderlust', phonetic: '/ˈwɒndəlʌst/', meaning: '旅行癖，对远方的渴望', example: 'His wanderlust took him to every continent.' },
    { word: 'Mellifluous', phonetic: '/meˈlɪfluəs/', meaning: '悦耳的，甜美流畅的', example: 'She has a mellifluous voice that calms everyone.' },
    { word: 'Petrichor', phonetic: '/ˈpetrɪkɔːr/', meaning: '雨后泥土的芬芳', example: 'I love the petrichor after a summer rain.' },
    { word: 'Eloquent', phonetic: '/ˈeləkwənt/', meaning: '雄辩的，有说服力的', example: 'He gave an eloquent speech at the ceremony.' },
    { word: 'Nostalgia', phonetic: '/nɒˈstældʒə/', meaning: '怀旧之情', example: 'The old song filled her with nostalgia.' },
    { word: 'Ubiquitous', phonetic: '/juːˈbɪkwɪtəs/', meaning: '无处不在的', example: 'Smartphones have become ubiquitous in modern life.' },
    { word: 'Tenacious', phonetic: '/tɪˈneɪʃəs/', meaning: '坚韧不拔的', example: 'She is tenacious in pursuing her dreams.' },
    { word: 'Luminous', phonetic: '/ˈluːmɪnəs/', meaning: '发光的，明亮的', example: 'The luminous stars lit up the night sky.' },
    { word: 'Paradox', phonetic: '/ˈpærədɒks/', meaning: '悖论，自相矛盾的事物', example: 'It is a paradox that standing is more tiring than walking.' },
    { word: 'Ethereal', phonetic: '/ɪˈθɪəriəl/', meaning: '空灵的，超凡的', example: 'The dancer moved with ethereal grace.' },
    { word: 'Cogent', phonetic: '/ˈkəʊdʒənt/', meaning: '令人信服的，有说服力的', example: 'She presented a cogent argument for the proposal.' },
    { word: 'Quintessential', phonetic: '/ˌkwɪntɪˈsenʃəl/', meaning: '典型的，精髓的', example: 'It is the quintessential example of modern architecture.' }
]

const JOKES = [
    '老师说："同学们，你们觉得什么最浪费时间？"小明说："等下课。"',
    '同事问我："你有什么特长？"我说："我特别擅长拖延。"',
    '问：为什么程序员总是分不清万圣节和圣诞节？答：因为 Oct 31 = Dec 25。',
    '问：数学书为什么总是不开心？答：因为它有太多"问题"了。',
    '问：咖啡杯对茶杯说了什么？答："你太淡了。"',
    '问：为什么海洋里没有电脑？答：因为那里太多网了（fish net）。',
    '"医生，我觉得我有超能力。""什么超能力？""我能感觉别人感觉不到的冷。""那是空调开太大了。"',
    '问：为什么手机不能告诉你一个秘密？答：因为它总是在信号（泄密）。',
    '同事说："我这人说话直，你别介意。"我说："没事，我这人记仇，你也别介意。"',
    '"你知道 procrastinate 是什么意思吗？""我知道，但明天再告诉你。"',
    '我对自己说："今天一定要早点睡！"然后凌晨两点还在刷手机。',
    '问：地球为什么是圆的？答：因为它要滚。不对，因为它要转。还不对，因为它要保持平衡。',
    '"如果一天有25小时你会做什么？""多出来那一小时继续拖延。"',
    '问：你知道为什么程序员喜欢深色模式吗？答：因为光明会吸引 bug。',
    '世界上最遥远的距离不是生与死，而是周一上午到周五下午。'
]

const HEALTH_TIPS = {
    morning: [
        '早上起床后先喝一杯温水，帮助唤醒肠胃，促进新陈代谢。',
        '早餐要吃好，推荐搭配：全谷物+蛋白质+水果，营养均衡一整天。',
        '晨起做5分钟伸展运动，可以有效缓解肌肉僵硬，提神醒脑。',
        '不要空腹喝咖啡，先吃点东西再喝，保护胃黏膜。',
        '早上开窗通风15分钟，让新鲜空气进来，改善室内空气质量。'
    ],
    afternoon: [
        '午后小憩15-20分钟，可以有效恢复精力，但不要超过30分钟。',
        '下午3点是人体最容易犯困的时候，起来走动5分钟提提神。',
        '下午茶选择坚果和水果，比饼干蛋糕更健康。',
        '久坐1小时后起身活动5分钟，保护颈椎和腰椎。',
        '下午多喝水，保持身体水分充足，有助于集中注意力。'
    ],
    evening: [
        '晚餐不宜过饱，七分饱最合适，有助睡眠质量。',
        '睡前2小时尽量不要进食，让胃有充分时间消化。',
        '晚上用热水泡脚15分钟，有助于放松身心、改善睡眠。',
        '睡前远离手机屏幕，蓝光会影响褪黑素分泌，导致失眠。',
        '晚餐后散步30分钟，是最温和健康的运动方式。'
    ]
}

const EXERCISE_TIPS = {
    indoor: [
        '今天适合室内运动：尝试一组HIIT训练，20分钟高效燃脂！',
        '在家做瑜伽吧！推荐「下犬式」「战士式」「树式」，每个保持30秒。',
        '室内运动推荐：平板支撑3组，每组30秒，有效锻炼核心力量。',
        '跟着音乐跳一段有氧操吧，30分钟快乐运动，心情也会变好！',
        '试试跳绳吧！每天1000个跳绳，相当于慢跑30分钟的消耗。'
    ],
    outdoor: [
        '天气不错，出去跑步吧！30分钟慢跑，既能锻炼又能享受阳光。',
        '今天适合户外骑行，戴上头盔出去转转，享受运动的快乐！',
        '去公园散步吧，30分钟快走是最低门槛的有氧运动。',
        '天气晴好，适合户外徒步！找一条身边的步道，探索身边的风景。',
        '今天可以约朋友打球，羽毛球、篮球、网球都是好选择！'
    ],
    gentle: [
        '今天做做拉伸运动吧，15分钟全身拉伸，缓解肌肉疲劳。',
        '推荐一组简单的办公室运动：转颈、耸肩、扭腰，每项10次。',
        '试试冥想+深呼吸：静坐5分钟，深吸气4秒，屏息4秒，呼气6秒。',
        '今天做一套八段锦吧！传统养生功法，简单易学，老少皆宜。',
        '今天休息为主，做一些轻度散步和拉伸，让身体充分恢复。'
    ]
}

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

async function generateWithAI(prompt: string): Promise<string | null> {
    try {
        const result = await chatWithLLM(
            [{role: 'user', content: prompt}],
            null, undefined, undefined, undefined
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
        '沈阳': { lat: 41.8057, lon: 123.4315, name: '沈阳' }
    }

    const coords = cityCoords[city]
    if (!coords) {
        // Try geocoding via Open-Meteo
        try {
            const geoRes = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
                params: { name: city, count: 1, language: 'zh' },
                timeout: 10000
            })
            const results = geoRes.data?.results
            if (results && results.length > 0) {
                const r = results[0]
                return fetchWeatherFromApi(r.latitude, r.longitude, r.name || city)
            }
        } catch { /* fallback */ }
        return `${city}天气信息暂不可用，请尝试使用具体的城市名称。`
    }

    return fetchWeatherFromApi(coords.lat, coords.lon, coords.name)
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
    const typeLabel: Record<string, string> = {mixed: '任意类型', motivational: '励志', philosophy: '哲理', aesthetic: '唯美'}
    const aiResult = await generateWithAI(
        `请生成一条${typeLabel[type] || ''}每日一言（一句话即可，要有深度和美感，中英不限）。只输出句子本身和作者，不要额外解释。`
    )
    if (aiResult) return `💬 ${aiResult.trim()}`

    const pool = type === 'mixed'
        ? [...QUOTES.motivational, ...QUOTES.philosophy, ...QUOTES.aesthetic]
        : (QUOTES[type as keyof typeof QUOTES] || QUOTES.motivational)
    return `💬 ${randomPick(pool)}`
}

function executeCountdown(userConfig: Record<string, any>): string {
    const targetDate = userConfig.target_date
    const eventName = userConfig.event_name || '目标日'

    if (!targetDate) return '请先配置倒计日的目标日期。'

    const target = new Date(targetDate)
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
    const hour = new Date().getHours()
    const cupMl = userConfig.cup_ml || 250
    let timeGreeting = ''
    let suggestion = ''

    if (hour < 9) {
        timeGreeting = '🌅 早上好'
        suggestion = '起床后先喝一杯温水，唤醒身体代谢系统'
    } else if (hour < 11) {
        timeGreeting = '☀️ 上午好'
        suggestion = '工作间隙别忘了补充水分，保持精力充沛'
    } else if (hour < 14) {
        timeGreeting = '🌤️ 中午好'
        suggestion = '饭后半小时喝杯水，帮助消化吸收'
    } else if (hour < 17) {
        timeGreeting = '🌇 下午好'
        suggestion = '下午是缺水高发期，记得喝水提神'
    } else if (hour < 20) {
        timeGreeting = '🌆 傍晚好'
        suggestion = '傍晚适量饮水，不要太多以免影响睡眠'
    } else {
        timeGreeting = '🌙 晚上好'
        suggestion = '睡前少喝点水，保持良好的睡眠质量'
    }

    return `💧 ${timeGreeting}！该喝水啦\n${suggestion}\n建议每次饮水 ${cupMl}ml，保持每天 1500-2000ml 的摄入量`
}

async function executePoetry(): Promise<string> {
    const aiResult = await generateWithAI(
        '请推荐一首优美的中国古诗词（唐诗宋词优先）。格式：\n📜 诗词名\n—— 作者\n\n内容。只输出诗词，不要额外解释。'
    )
    if (aiResult) return aiResult.trim()

    const poem = randomPick(POEMS)
    return `📜 ${poem.title}\n—— ${poem.author}\n\n${poem.content}`
}

async function executeHealthTip(): Promise<string> {
    const hour = new Date().getHours()
    const period = hour < 12 ? '早晨' : hour < 18 ? '下午' : '晚间'
    const aiResult = await generateWithAI(
        `现在是${period}，请给出一条实用的健康养生小贴士（一两句话即可，简洁有针对性）。格式：🍎 {period}健康小贴士\n\n内容`
    )
    if (aiResult) return aiResult.trim()

    const periodKey = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
    const tips = HEALTH_TIPS[periodKey]
    return `🍎 ${period}健康小贴士\n\n${randomPick(tips)}`
}

async function executeExercise(): Promise<string> {
    const aiResult = await generateWithAI(
        '请给出一条今天的运动建议（根据当前季节和时间段推荐，一两句话即可）。格式：🏃 今日运动建议\n\n建议内容'
    )
    if (aiResult) return aiResult.trim()
    return `🏃 今日运动建议\n\n${randomPick(EXERCISE_TIPS.indoor)}`
}

async function executeEnglish(): Promise<string> {
    const aiResult = await generateWithAI(
        '请教我一个实用的高级英语表达。格式：\n📚 每日英语\n\n单词 音标\n释义：中文意思\n例句：英文例句。只输出这些内容，不要额外解释。'
    )
    if (aiResult) return aiResult.trim()

    const item = randomPick(ENGLISH)
    return `📚 每日英语\n\n${item.word} ${item.phonetic}\n释义：${item.meaning}\n例句：${item.example}`
}

async function executeJoke(): Promise<string> {
    const aiResult = await generateWithAI(
        '请讲一个轻松幽默的笑话（中文，简短有趣，不要低俗）。格式：😄 每日一笑\n\n笑话内容'
    )
    if (aiResult) return aiResult.trim()
    return `😄 每日一笑\n\n${randomPick(JOKES)}`
}

async function executeHoroscope(userConfig: Record<string, any>): Promise<string> {
    const sign = userConfig.sign || 'aries'
    const data = HOROSCOPE_DATA[sign]
    if (!data) return '未知的星座，请检查配置。'

    const aiResult = await generateWithAI(
        `请为${data.name}生成今日运势分析，包含：综合运势（百分制+星级）、爱情运势、事业运势、幸运数字、一段建议。格式简洁。`
    )
    if (aiResult) return `⭐ ${data.name}今日运势（${data.element}象 · ${data.traits}）\n\n${aiResult.trim()}`

    // Generate pseudo-random fortune based on today's date
    const today = new Date()
    const seed = today.toISOString().slice(0, 10) + sign
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i)
        hash |= 0
    }
    const overall = (Math.abs(hash) % 40) + 60
    const love = (Math.abs(hash * 7) % 40) + 60
    const career = (Math.abs(hash * 13) % 40) + 60
    const lucky = Math.abs(hash * 17) % 10 + 1

    const stars = (s: number) => '★'.repeat(Math.round(s / 20)) + '☆'.repeat(5 - Math.round(s / 20))

    const advices = [
        '今天适合尝试新事物，好运将至。',
        '保持积极心态，好事会自然而然发生。',
        '注意与身边人的沟通，会有意想不到的收获。',
        '今天适合独处思考，理清未来的方向。',
        '勇敢迈出第一步，成功就在不远处。'
    ]

    return `⭐ ${data.name}今日运势（${data.element}象 · ${data.traits}）\n\n` +
        `综合运势：${stars(overall)} ${overall}分\n` +
        `爱情运势：${stars(love)} ${love}分\n` +
        `事业运势：${stars(career)} ${career}分\n` +
        `幸运数字：${lucky}\n\n` +
        `${advices[Math.abs(hash) % advices.length]}`
}

function executeLunarInfo(): string {
    const now = new Date()
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${weekDays[now.getDay()]}`

    // Simple lunar approximation (for display only)
    const lunarMonths = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']
    const lunarDays = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
        '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
        '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十']

    // Use day-of-year as a rough index for variety
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
    const lunarMonthIdx = dayOfYear % 12
    const lunarDayIdx = dayOfYear % 30

    return `🌙 今日农历信息\n\n` +
        `公历：${dateStr}\n` +
        `农历：乙巳年 ${lunarMonths[lunarMonthIdx]}${lunarDays[lunarDayIdx]}\n\n` +
        `（注：农历日期为近似值，准确日期请以万年历为准）`
}

function executeWorkReport(): string {
    const hour = new Date().getHours()
    const period = hour < 12 ? '上午' : hour < 18 ? '下午' : '今日'

    return `📝 ${period}工作小结提醒\n\n` +
        `请花5分钟回顾一下：\n` +
        `✅ 已完成的任务有哪些？\n` +
        `⏳ 进行中的任务进展如何？\n` +
        `📋 明确下一步的待办事项\n` +
        `🤔 需要协调或请支持的事项\n\n` +
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

        // Replace template variables in URL
        let finalUrl = url
        for (const [key, value] of Object.entries(userConfig)) {
            finalUrl = finalUrl.replace(`{{${key}}}`, String(value))
        }

        const res = await axios({ method, url: finalUrl, headers, timeout: 15000 })
        const data = res.data

        // Format response using template if provided
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
            // Default: return stringified JSON (truncated)
            const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
            apiResult = text.length > 500 ? text.substring(0, 500) + '...' : text
        }

        // Optional AI summary
        if (actionConfig.enable_ai_summary) {
            const summaryPrompt = actionConfig.summary_prompt || '请根据以下 API 返回的数据，提取关键信息并用简洁的中文总结'
            const fullPrompt = `${summaryPrompt}${STRUCTURED_FORMAT_INSTRUCTION}\n\n---\nAPI 返回数据：\n${apiResult}`
            try {
                const result = await chatWithLLM(
                    [{role: 'user', content: fullPrompt}],
                    null, undefined, undefined, undefined
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

    // Replace template variables
    let prompt = promptTemplate
    for (const [key, value] of Object.entries(userConfig)) {
        prompt = prompt.replace(`{{${key}}}`, String(value))
    }
    // Also replace {{date}} and {{time}}
    const now = new Date()
    prompt = prompt.replace('{{date}}', now.toISOString().slice(0, 10))
    prompt = prompt.replace('{{time}}', now.toLocaleTimeString('zh-CN'))

    try {
        const result = await chatWithLLM(
            [{ role: 'user', content: prompt }],
            null, // no scheduler
            undefined, // use default model
            undefined,
            undefined // no stream events
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

    // Replace template variables in search query
    const now = new Date()
    let query = searchQuery
    query = query.replace('{{date}}', now.toISOString().slice(0, 10))
    query = query.replace('{{time}}', now.toLocaleTimeString('zh-CN'))

    // Step 1: Web search using the selected search model
    const searchConfig = modelConfigsDb.get(searchModelId)
    if (!searchConfig) return '联网搜索模型配置不存在，请检查技能设置'

    console.log(`[技能执行器] 联网搜索: "${query}"，使用模型: ${searchConfig.name}`)
    let searchResult: string
    try {
        const result = await chatWithLLM(
            [{role: 'user', content: query}],
            null,
            searchModelId,
            undefined,
            undefined
        )
        searchResult = result.reply || ''
        if (!searchResult) return '联网搜索未返回结果'
    } catch (e: any) {
        return `联网搜索失败: ${e.message}`
    }

    // Step 2: AI summarization using default chat model
    const summaryPrompt = actionConfig.summary_prompt || '请根据以下搜索结果，用简洁的中文进行总结，提炼关键信息'
    const fullPrompt = `${summaryPrompt}${STRUCTURED_FORMAT_INSTRUCTION}\n\n---\n搜索结果：\n${searchResult}`

    console.log('[技能执行器] AI 总结中...')
    try {
        const result = await chatWithLLM(
            [{role: 'user', content: fullPrompt}],
            null,
            undefined,
            undefined,
            undefined
        )
        return result.reply || searchResult
    } catch (e: any) {
        // If summarization fails, return raw search results
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
