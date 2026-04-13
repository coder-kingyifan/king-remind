import {getDatabase, saveDatabase} from './connection'

export interface SkillContent {
    id: number
    skill_key: string
    category: string
    content: string
    extra: string
    created_at: string
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

export const skillContentDb = {
    list(skillKey: string, category?: string): SkillContent[] {
        let sql = 'SELECT * FROM skill_content WHERE skill_key = ?'
        const params: any[] = [skillKey]
        if (category) {
            sql += ' AND category = ?'
            params.push(category)
        }
        sql += ' ORDER BY id'
        return queryAll(sql, params) as SkillContent[]
    },

    randomPick(skillKey: string, category?: string): SkillContent | undefined {
        let sql = 'SELECT * FROM skill_content WHERE skill_key = ?'
        const params: any[] = [skillKey]
        if (category) {
            sql += ' AND category = ?'
            params.push(category)
        }
        sql += ' ORDER BY RANDOM() LIMIT 1'
        const rows = queryAll(sql, params)
        return rows[0] as SkillContent | undefined
    },

    /** 随机取一条，支持多个 category（用 OR 匹配） */
    randomPickMultiCategory(skillKey: string, categories: string[]): SkillContent | undefined {
        if (categories.length === 0) return this.randomPick(skillKey)
        const placeholders = categories.map(() => '?').join(',')
        const sql = `SELECT * FROM skill_content WHERE skill_key = ? AND category IN (${placeholders}) ORDER BY RANDOM() LIMIT 1`
        const params = [skillKey, ...categories]
        const rows = queryAll(sql, params)
        return rows[0] as SkillContent | undefined
    },

    add(skillKey: string, category: string, content: string, extra?: Record<string, any>): SkillContent {
        const extraStr = extra ? JSON.stringify(extra) : '{}'
        run('INSERT INTO skill_content (skill_key, category, content, extra) VALUES (?, ?, ?, ?)',
            [skillKey, category, content, extraStr])
        const id = getLastInsertId()
        return queryAll('SELECT * FROM skill_content WHERE id = ?', [id])[0] as SkillContent
    },

    delete(id: number): boolean {
        const existing = queryAll('SELECT id FROM skill_content WHERE id = ?', [id])
        if (existing.length === 0) return false
        run('DELETE FROM skill_content WHERE id = ?', [id])
        return true
    },

    count(skillKey: string, category?: string): number {
        let sql = 'SELECT COUNT(*) as cnt FROM skill_content WHERE skill_key = ?'
        const params: any[] = [skillKey]
        if (category) {
            sql += ' AND category = ?'
            params.push(category)
        }
        const rows = queryAll(sql, params)
        return (rows[0] as any)?.cnt || 0
    }
}

// ======================== Seed Data ========================

/** 初始化技能内容数据（仅当表为空时写入） */
export function seedSkillContent(): void {
    const count = skillContentDb.count('daily_quote')
    if (count > 0) return  // 已有数据，不重复写入

    // ---------- 每日一言 ----------
    const quotes: [string, string][] = [  // [category, content]
        ['motivational', '世上无难事，只怕有心人。'],
        ['motivational', '不积跬步，无以至千里。 —— 荀子'],
        ['motivational', '宝剑锋从磨砺出，梅花香自苦寒来。'],
        ['motivational', '天行健，君子以自强不息。 —— 《周易》'],
        ['motivational', '有志者事竟成。 —— 《后汉书》'],
        ['motivational', '千里之行，始于足下。 —— 老子'],
        ['motivational', '路漫漫其修远兮，吾将上下而求索。 —— 屈原'],
        ['motivational', '业精于勤，荒于嬉；行成于思，毁于随。 —— 韩愈'],
        ['motivational', '长风破浪会有时，直挂云帆济沧海。 —— 李白'],
        ['motivational', '山重水复疑无路，柳暗花明又一村。 —— 陆游'],
        ['motivational', '天生我材必有用，千金散尽还复来。 —— 李白'],
        ['motivational', '博观而约取，厚积而薄发。 —— 苏轼'],
        ['motivational', '不畏浮云遮望眼，自缘身在最高层。 —— 王安石'],
        ['motivational', '生活不是等待暴风雨过去，而是学会在雨中翩翩起舞。'],
        ['motivational', '你若盛开，蝴蝶自来；你若精彩，天自安排。'],
        ['motivational', '成功不是终点，失败也不是终结，唯有继续前行的勇气才是最重要的。 —— 丘吉尔'],
        ['motivational', '每一个不曾起舞的日子，都是对生命的辜负。 —— 尼采'],
        ['motivational', '你的时间有限，不要浪费在过别人的生活上。 —— 乔布斯'],
        ['motivational', 'Stay hungry, stay foolish. —— 乔布斯'],
        ['motivational', '把每一天当作生命的最后一天来过，终有一天你会发现自己是对的。'],
        ['motivational', '志不强者智不达。 —— 墨子'],
        ['motivational', '锲而不舍，金石可镂。 —— 荀子'],
        ['motivational', '穷则独善其身，达则兼善天下。 —— 孟子'],
        ['motivational', '老骥伏枥，志在千里。 —— 曹操'],
        ['motivational', '会当凌绝顶，一览众山小。 —— 杜甫'],
        ['motivational', '少壮不努力，老大徒伤悲。 —— 《长歌行》'],
        ['motivational', '莫等闲，白了少年头，空悲切。 —— 岳飞'],
        ['motivational', '纸上得来终觉浅，绝知此事要躬行。 —— 陆游'],
        ['motivational', '书山有路勤为径，学海无涯苦作舟。 —— 韩愈'],
        ['motivational', '黑发不知勤学早，白首方悔读书迟。 —— 颜真卿'],
        ['philosophy', '人生如逆旅，我亦是行人。 —— 苏轼'],
        ['philosophy', '万物皆有裂痕，那是光照进来的地方。 —— 莱昂纳德·科恩'],
        ['philosophy', '未经审视的人生不值得过。 —— 苏格拉底'],
        ['philosophy', '知人者智，自知者明。 —— 老子'],
        ['philosophy', '己所不欲，勿施于人。 —— 孔子'],
        ['philosophy', '人法地，地法天，天法道，道法自然。 —— 老子'],
        ['philosophy', '吾生也有涯，而知也无涯。 —— 庄子'],
        ['philosophy', '学而不思则罔，思而不学则殆。 —— 孔子'],
        ['philosophy', '三人行，必有我师焉。 —— 孔子'],
        ['philosophy', '生命中最困难的时刻，恰恰是转变的最佳时机。'],
        ['philosophy', '你所浪费的今天，是昨天去世的人奢望的明天。'],
        ['philosophy', '世界上只有一种英雄主义，就是认清了生活的真相后依然热爱它。 —— 罗曼·罗兰'],
        ['philosophy', '人的一切痛苦，本质上都是对自己无能的愤怒。 —— 王小波'],
        ['philosophy', '你不能控制风的方向，但你可以调整帆的角度。'],
        ['philosophy', '真正的平静，不是避开车马喧嚣，而是在心中修篱种菊。'],
        ['philosophy', '大道至简。 —— 老子'],
        ['philosophy', '上善若水，水善利万物而不争。 —— 老子'],
        ['philosophy', '知之为知之，不知为不知，是知也。 —— 孔子'],
        ['philosophy', '温故而知新，可以为师矣。 —— 孔子'],
        ['philosophy', '逝者如斯夫，不舍昼夜。 —— 孔子'],
        ['philosophy', '天地不仁，以万物为刍狗。 —— 老子'],
        ['philosophy', '物竞天择，适者生存。 —— 达尔文'],
        ['philosophy', '我思故我在。 —— 笛卡尔'],
        ['philosophy', '存在即合理。 —— 黑格尔'],
        ['philosophy', '人生而自由，却无往不在枷锁之中。 —— 卢梭'],
        ['aesthetic', '春风十里不如你。 —— 冯唐'],
        ['aesthetic', '从前的日色变得慢，车马邮件都慢，一生只够爱一个人。 —— 木心'],
        ['aesthetic', '我明白你会来，所以我等。 —— 沈从文'],
        ['aesthetic', '你是一树一树的花开，是燕在梁间呢喃。 —— 林徽因'],
        ['aesthetic', '草在结它的种子，风在摇它的叶子，我们站着，不说话，就十分美好。 —— 顾城'],
        ['aesthetic', '面朝大海，春暖花开。 —— 海子'],
        ['aesthetic', '黑夜给了我黑色的眼睛，我却用它寻找光明。 —— 顾城'],
        ['aesthetic', '生如夏花之绚烂，死如秋叶之静美。 —— 泰戈尔'],
        ['aesthetic', '天空没有翅膀的痕迹，而我已飞过。 —— 泰戈尔'],
        ['aesthetic', '愿你出走半生，归来仍是少年。'],
        ['aesthetic', '人间烟火气，最抚凡人心。'],
        ['aesthetic', '落霞与孤鹜齐飞，秋水共长天一色。 —— 王勃'],
        ['aesthetic', '大漠孤烟直，长河落日圆。 —— 王维'],
        ['aesthetic', '疏影横斜水清浅，暗香浮动月黄昏。 —— 林逋'],
        ['aesthetic', '采菊东篱下，悠然见南山。 —— 陶渊明'],
        ['aesthetic', '行到水穷处，坐看云起时。 —— 王维'],
        ['aesthetic', '人生到处知何似，应似飞鸿踏雪泥。 —— 苏轼'],
        ['aesthetic', '此情可待成追忆，只是当时已惘然。 —— 李商隐'],
        ['aesthetic', '众里寻他千百度，蓦然回首，那人却在灯火阑珊处。 —— 辛弃疾'],
        ['aesthetic', '人生若只如初见，何事秋风悲画扇。 —— 纳兰性德']
    ]
    for (const [cat, text] of quotes) {
        skillContentDb.add('daily_quote', cat, text)
    }

    // ---------- 每日诗词 ----------
    const poems: { title: string; author: string; content: string }[] = [
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
        { title: '竹石', author: '郑燮', content: '咬定青山不放松，立根原在破岩中。\n千磨万击还坚劲，任尔东西南北风。' },
        { title: '春江花月夜', author: '张若虚', content: '春江潮水连海平，海上明月共潮生。\n滟滟随波千万里，何处春江无月明。' },
        { title: '将进酒', author: '李白', content: '君不见黄河之水天上来，奔流到海不复回。\n君不见高堂明镜悲白发，朝如青丝暮成雪。\n人生得意须尽欢，莫使金樽空对月。' },
        { title: '水调歌头', author: '苏轼', content: '明月几时有？把酒问青天。\n不知天上宫阙，今夕是何年。\n但愿人长久，千里共婵娟。' },
        { title: '念奴娇·赤壁怀古', author: '苏轼', content: '大江东去，浪淘尽，千古风流人物。\n故垒西边，人道是，三国周郎赤壁。' },
        { title: '声声慢', author: '李清照', content: '寻寻觅觅，冷冷清清，凄凄惨惨戚戚。\n乍暖还寒时候，最难将息。' },
        { title: '虞美人', author: '李煜', content: '春花秋月何时了？往事知多少。\n小楼昨夜又东风，故国不堪回首月明中。' },
        { title: '登高', author: '杜甫', content: '风急天高猿啸哀，渚清沙白鸟飞回。\n无边落木萧萧下，不尽长江滚滚来。' },
        { title: '黄鹤楼', author: '崔颢', content: '昔人已乘黄鹤去，此地空余黄鹤楼。\n黄鹤一去不复返，白云千载空悠悠。' },
        { title: '钱塘湖春行', author: '白居易', content: '孤山寺北贾亭西，水面初平云脚低。\n几处早莺争暖树，谁家新燕啄春泥。' },
        { title: '题西林壁', author: '苏轼', content: '横看成岭侧成峰，远近高低各不同。\n不识庐山真面目，只缘身在此山中。' },
        { title: '饮湖上初晴后雨', author: '苏轼', content: '水光潋滟晴方好，山色空蒙雨亦奇。\n欲把西湖比西子，淡妆浓抹总相宜。' },
        { title: '鹿柴', author: '王维', content: '空山不见人，但闻人语响。\n返景入深林，复照青苔上。' },
        { title: '凉州词', author: '王翰', content: '葡萄美酒夜光杯，欲饮琵琶马上催。\n醉卧沙场君莫笑，古来征战几人回。' },
        { title: '九月九日忆山东兄弟', author: '王维', content: '独在异乡为异客，每逢佳节倍思亲。\n遥知兄弟登高处，遍插茱萸少一人。' },
        { title: '赋得古原草送别', author: '白居易', content: '离离原上草，一岁一枯荣。\n野火烧不尽，春风吹又生。' }
    ]
    for (const p of poems) {
        skillContentDb.add('poetry', '', p.content, { title: p.title, author: p.author })
    }

    // ---------- 每日英语 ----------
    const english: { word: string; phonetic: string; meaning: string; example: string }[] = [
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
        { word: 'Quintessential', phonetic: '/ˌkwɪntɪˈsenʃəl/', meaning: '典型的，精髓的', example: 'It is the quintessential example of modern architecture.' },
        { word: 'Sanguine', phonetic: '/ˈsæŋɡwɪn/', meaning: '乐观的，充满希望的', example: 'She remained sanguine about the future despite the setbacks.' },
        { word: 'Lethargic', phonetic: '/lɪˈθɑːdʒɪk/', meaning: '昏昏欲睡的，无精打采的', example: 'The hot weather made everyone feel lethargic.' },
        { word: 'Pragmatic', phonetic: '/præɡˈmætɪk/', meaning: '务实的，实用主义的', example: 'We need a pragmatic approach to solve this problem.' },
        { word: 'Inevitable', phonetic: '/ɪˈnevɪtəbl/', meaning: '不可避免的，必然的', example: 'Change is inevitable in a rapidly evolving world.' },
        { word: 'Ambiguous', phonetic: '/æmˈbɪɡjuəs/', meaning: '模棱两可的，含糊的', example: 'The contract language was ambiguous and open to interpretation.' },
        { word: 'Meticulous', phonetic: '/mɪˈtɪkjələs/', meaning: '一丝不苟的，细致的', example: 'She is meticulous in her research methodology.' },
        { word: 'Profound', phonetic: '/prəˈfaʊnd/', meaning: '深刻的，意义深远的', example: 'The book had a profound impact on my worldview.' },
        { word: 'Versatile', phonetic: '/ˈvɜːsətaɪl/', meaning: '多才多艺的，多功能的', example: 'She is a versatile musician who plays five instruments.' },
        { word: 'Concise', phonetic: '/kənˈsaɪs/', meaning: '简明的，简洁的', example: 'Please keep your report concise and to the point.' },
        { word: 'Diligent', phonetic: '/ˈdɪlɪdʒənt/', meaning: '勤勉的，刻苦的', example: 'The diligent student always completed assignments ahead of time.' },
        { word: 'Empathy', phonetic: '/ˈempəθi/', meaning: '同理心，共情', example: 'True empathy requires understanding, not just sympathy.' },
        { word: 'Perseverance', phonetic: '/ˌpɜːsɪˈvɪərəns/', meaning: '毅力，坚持不懈', example: 'Success often comes from perseverance in the face of adversity.' },
        { word: 'Ingenuity', phonetic: '/ˌɪndʒɪˈnjuːəti/', meaning: '独创性，心灵手巧', example: 'The engineer showed great ingenuity in solving the design problem.' },
        { word: 'Resilient', phonetic: '/rɪˈzɪliənt/', meaning: '有弹性的，能迅速恢复的', example: 'Children are often more resilient than adults give them credit for.' },
        { word: 'Integrity', phonetic: '/ɪnˈteɡrəti/', meaning: '正直，诚实；完整性', example: 'A leader must demonstrate integrity in every decision.' }
    ]
    for (const e of english) {
        skillContentDb.add('english', '', `${e.word} ${e.phonetic}`, { word: e.word, phonetic: e.phonetic, meaning: e.meaning, example: e.example })
    }

    // ---------- 每日笑话 ----------
    const jokes: string[] = [
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
        '世界上最遥远的距离不是生与死，而是周一上午到周五下午。',
        '问：什么鱼最聪明？答：鲸鱼。因为它的"微"积分很好。',
        '问：为什么自行车不能自己站起来？答：因为它两 tire（太累了）。',
        '"老板，我要请一天假。""为什么？""我老婆要和我吵架。""那你在家吵就好了。""不，我想去旅游躲一躲。"',
        '问：什么动物最容易摔倒？答：狐狸，因为它很狡猾（脚滑）。',
        '问：为什么飞机飞那么高都不会撞到星星？答：因为星星会"闪"啊。',
        '我：我要减肥！朋友：那你怎么还吃？我：我这是在减慢增肥的速度。',
        '问：为什么数学老师总是很冷静？答：因为他们知道所有的问题都有解。',
        '"你有什么兴趣爱好？""我喜欢发呆。""发呆算什么爱好？""你试试就知道了，很难的。"',
        '问：为什么电脑永远不会感冒？答：因为它有 Windows（窗户）但不会着凉。',
        '我：今天跑了5公里！朋友：真的？我：嗯，被狗追的。'
    ]
    for (const j of jokes) {
        skillContentDb.add('joke', '', j)
    }

    // ---------- 健康小贴士 ----------
    const healthTips: [string, string][] = [  // [category, content]
        ['morning', '早上起床后先喝一杯温水，帮助唤醒肠胃，促进新陈代谢。'],
        ['morning', '早餐要吃好，推荐搭配：全谷物+蛋白质+水果，营养均衡一整天。'],
        ['morning', '晨起做5分钟伸展运动，可以有效缓解肌肉僵硬，提神醒脑。'],
        ['morning', '不要空腹喝咖啡，先吃点东西再喝，保护胃黏膜。'],
        ['morning', '早上开窗通风15分钟，让新鲜空气进来，改善室内空气质量。'],
        ['morning', '晨起后先别急着看手机，给眼睛和大脑一个缓冲时间。'],
        ['morning', '早餐加一份蔬菜，比如番茄或黄瓜，补充维生素和膳食纤维。'],
        ['morning', '早上适合晒15分钟太阳，帮助身体合成维生素D，提升精神状态。'],
        ['morning', '起床后用冷水洗脸，可以收缩毛孔、提神醒脑。'],
        ['morning', '早晨是血压高峰期，有高血压的朋友记得按时服药。'],
        ['afternoon', '午后小憩15-20分钟，可以有效恢复精力，但不要超过30分钟。'],
        ['afternoon', '下午3点是人体最容易犯困的时候，起来走动5分钟提提神。'],
        ['afternoon', '下午茶选择坚果和水果，比饼干蛋糕更健康。'],
        ['afternoon', '久坐1小时后起身活动5分钟，保护颈椎和腰椎。'],
        ['afternoon', '下午多喝水，保持身体水分充足，有助于集中注意力。'],
        ['afternoon', '下午4点左右吃点坚果（核桃、杏仁），补充优质脂肪和蛋白质。'],
        ['afternoon', '长时间用电脑后，做做眼保健操或远眺5分钟，缓解眼疲劳。'],
        ['afternoon', '下午可以喝一杯绿茶，提神的同时还能补充抗氧化物质。'],
        ['afternoon', '坐姿要保持端正，屏幕高度与视线齐平，减少颈椎压力。'],
        ['afternoon', '下午适当补充维生素C，吃个橙子或猕猴桃都是好选择。'],
        ['evening', '晚餐不宜过饱，七分饱最合适，有助睡眠质量。'],
        ['evening', '睡前2小时尽量不要进食，让胃有充分时间消化。'],
        ['evening', '晚上用热水泡脚15分钟，有助于放松身心、改善睡眠。'],
        ['evening', '睡前远离手机屏幕，蓝光会影响褪黑素分泌，导致失眠。'],
        ['evening', '晚餐后散步30分钟，是最温和健康的运动方式。'],
        ['evening', '晚餐多吃蔬菜少吃肉，减轻肠胃负担，有助于睡眠。'],
        ['evening', '睡前做5分钟深呼吸或冥想，帮助身心放松，更快入睡。'],
        ['evening', '晚上9点后减少饮水量，避免夜间频繁起夜影响睡眠。'],
        ['evening', '卧室温度保持在18-22°C，是最适宜的睡眠温度。'],
        ['evening', '睡前可以喝一小杯温牛奶，含有的色氨酸有助于安眠。']
    ]
    for (const [cat, text] of healthTips) {
        skillContentDb.add('health_tip', cat, text)
    }

    // ---------- 运动建议 ----------
    const exerciseTips: [string, string][] = [  // [category, content]
        ['indoor', '今天适合室内运动：尝试一组HIIT训练，20分钟高效燃脂！'],
        ['indoor', '在家做瑜伽吧！推荐「下犬式」「战士式」「树式」，每个保持30秒。'],
        ['indoor', '室内运动推荐：平板支撑3组，每组30秒，有效锻炼核心力量。'],
        ['indoor', '跟着音乐跳一段有氧操吧，30分钟快乐运动，心情也会变好！'],
        ['indoor', '试试跳绳吧！每天1000个跳绳，相当于慢跑30分钟的消耗。'],
        ['outdoor', '天气不错，出去跑步吧！30分钟慢跑，既能锻炼又能享受阳光。'],
        ['outdoor', '今天适合户外骑行，戴上头盔出去转转，享受运动的快乐！'],
        ['outdoor', '去公园散步吧，30分钟快走是最低门槛的有氧运动。'],
        ['outdoor', '天气晴好，适合户外徒步！找一条身边的步道，探索身边的风景。'],
        ['outdoor', '今天可以约朋友打球，羽毛球、篮球、网球都是好选择！'],
        ['gentle', '今天做做拉伸运动吧，15分钟全身拉伸，缓解肌肉疲劳。'],
        ['gentle', '推荐一组简单的办公室运动：转颈、耸肩、扭腰，每项10次。'],
        ['gentle', '试试冥想+深呼吸：静坐5分钟，深吸气4秒，屏息4秒，呼气6秒。'],
        ['gentle', '今天做一套八段锦吧！传统养生功法，简单易学，老少皆宜。'],
        ['gentle', '今天休息为主，做一些轻度散步和拉伸，让身体充分恢复。']
    ]
    for (const [cat, text] of exerciseTips) {
        skillContentDb.add('exercise', cat, text)
    }

    console.log('[技能内容] 初始化完成')
}
