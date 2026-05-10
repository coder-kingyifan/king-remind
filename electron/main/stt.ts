import path from 'path'
import fs from 'fs'
import axios from 'axios'
import FormData from 'form-data'
import WebSocket from 'ws'
import {randomUUID} from 'crypto'
import {gunzipSync, gzipSync} from 'zlib'
import {modelConfigsDb} from './db/model-configs'

interface SttUtterance {
    speaker: string
    text: string
    start_time: number
    end_time: number
}

interface SttResult {
    utterances: SttUtterance[]
    full_text: string
}

interface SttConfig {
    provider: string
    baseUrl: string
    apiKey: string
    model: string
}

export interface RealtimeSttEvent {
    type: 'ready' | 'partial' | 'final' | 'closed' | 'error'
    text?: string
    speaker?: string
    utterances?: RealtimeSttUtterance[]
    message?: string
    full_text?: string
    raw?: any
    /** 增量文本：仅本次 final 新增的句子（不含之前已发送的） */
    delta_text?: string
    /** 增量话语：仅本次 final 新增的话语 */
    delta_utterances?: RealtimeSttUtterance[]
}

export interface RealtimeSttUtterance {
    speaker: string
    text: string
    /** 话语开始时间（秒，相对于录音开始） */
    start_time?: number
    /** 话语结束时间（秒，相对于录音开始） */
    end_time?: number
}

export interface RealtimeSttSession {
    id: string
    sendAudio(buffer: Buffer): void
    stop(): Promise<string>
}

/**
 * 查找 STT 模型配置
 */
function getSttConfig(): SttConfig | null {
    const configs = modelConfigsDb.list()
    const sttConfigs = configs.filter(c => (c.model_type === 'stt' || c.model_type === 'file_stt') && !/^wss?:\/\//i.test(c.base_url))
    if (sttConfigs.length === 0) {
        const realtimeDoubao = configs.find(c =>
            (c.model_type === 'stt' || c.model_type === 'realtime_stt') &&
            /openspeech\.bytedance\.com\/api\/v3\/sauc\/bigmodel/i.test(c.base_url)
        )
        if (!realtimeDoubao) return null
        return {
            provider: realtimeDoubao.provider,
            baseUrl: 'https://openspeech.bytedance.com/api/v3',
            apiKey: realtimeDoubao.api_key,
            model: 'volc.bigasr.auc_turbo'
        }
    }
    const defaultCfg = sttConfigs.find(c => c.is_default === 1)
    const cfg = defaultCfg || sttConfigs[0]
    return {
        provider: cfg.provider,
        baseUrl: cfg.base_url,
        apiKey: cfg.api_key,
        model: cfg.model
    }
}

function getRealtimeSttConfig(): SttConfig | null {
    const configs = modelConfigsDb.list()
    const realtimeConfigs = configs.filter(c => (c.model_type === 'stt' || c.model_type === 'realtime_stt') && /^wss?:\/\//i.test(c.base_url))
    if (realtimeConfigs.length === 0) return null
    const defaultCfg = realtimeConfigs.find(c => c.is_default === 1)
    const cfg = defaultCfg || realtimeConfigs[0]
    return {
        provider: cfg.provider,
        baseUrl: cfg.base_url,
        apiKey: cfg.api_key,
        model: cfg.model
    }
}

export function hasRealtimeSttConfig(): boolean {
    return !!getRealtimeSttConfig()
}

export function hasFileSttConfig(): boolean {
    return !!getSttConfig()
}

function normalizeRealtimeUrl(config: SttConfig): string {
    if (/^wss?:\/\//i.test(config.baseUrl)) return config.baseUrl
    if (/^https:\/\//i.test(config.baseUrl)) return config.baseUrl.replace(/^https:/i, 'wss:')
    if (/^http:\/\//i.test(config.baseUrl)) return config.baseUrl.replace(/^http:/i, 'ws:')
    throw new Error('实时转写需要在语音转文字模型配置中填写 ws:// 或 wss:// 地址')
}

function isDoubaoBigModelRealtime(config: SttConfig): boolean {
    return /openspeech\.bytedance\.com\/api\/v3\/sauc\/bigmodel/i.test(config.baseUrl)
}

function parseKeyValueSecret(secret: string): Record<string, string> {
    const result: Record<string, string> = {}
    for (const part of secret.split(/[;\n]/)) {
        const index = part.indexOf('=')
        if (index <= 0) continue
        result[part.slice(0, index).trim()] = part.slice(index + 1).trim()
    }
    return result
}

function resolveDoubaoAuth(config: SttConfig, sessionId: string, resourceOverride?: string): Record<string, string> {
    const apiKey = (config.apiKey || '').trim()
    let parsed: Record<string, string> = {}

    if (apiKey.startsWith('{')) {
        try {
            parsed = JSON.parse(apiKey)
        } catch {}
    } else if (apiKey.includes('=')) {
        parsed = parseKeyValueSecret(apiKey)
    }

    const resourceId =
        resourceOverride ||
        parsed.resourceId ||
        parsed.resource_id ||
        (config.model?.startsWith('volc.') ? config.model : '') ||
        'volc.bigasr.sauc.duration'

    const headers: Record<string, string> = {
        'X-Api-Resource-Id': resourceId,
        'X-Api-Connect-Id': sessionId,
        'X-Api-Request-Id': sessionId,
        'X-Api-Sequence': '-1'
    }

    const appKey = parsed.appKey || parsed.app_key || parsed.appid || parsed.appId
    const accessKey = parsed.accessKey || parsed.access_key || parsed.token || parsed.accessToken
    const newApiKey = parsed.apiKey || parsed.api_key || (!appKey && !accessKey ? apiKey : '')

    if (newApiKey) {
        headers['X-Api-Key'] = newApiKey
    } else {
        if (appKey) headers['X-Api-App-Key'] = appKey
        if (accessKey) headers['X-Api-Access-Key'] = accessKey
    }

    return headers
}

function buildDoubaoFullClientRequest(config: SttConfig, sessionId: string): Buffer {
    const payload = {
        user: {
            uid: 'king-mate'
        },
        audio: {
            format: 'pcm',
            codec: 'raw',
            rate: 16000,
            bits: 16,
            channel: 1,
            language: 'zh-CN'
        },
        request: {
            reqid: sessionId,
            model_name: 'bigmodel',
            enable_itn: true,
            enable_punc: true,
            enable_speaker_info: true,
            show_utterances: true,
            result_type: 'single'
        }
    }

    const compressed = gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'))
    const length = Buffer.alloc(4)
    length.writeUInt32BE(compressed.length, 0)
    return Buffer.concat([
        Buffer.from([0x11, 0x10, 0x11, 0x00]),
        length,
        compressed
    ])
}

function buildDoubaoAudioFrame(audio: Buffer): Buffer {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(audio.length, 0)
    return Buffer.concat([
        Buffer.from([0x11, 0x20, 0x00, 0x00]),
        length,
        audio
    ])
}

function buildDoubaoEndFrame(): Buffer {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(0, 0)
    return Buffer.concat([
        Buffer.from([0x11, 0x22, 0x00, 0x00]),
        length
    ])
}

function parseDoubaoRealtimeFrame(message: any): any {
    const buffer = Buffer.isBuffer(message)
        ? message
        : Array.isArray(message)
            ? Buffer.concat(message)
            : Buffer.from(message)
    if (buffer.length < 4) return null

    const headerSize = (buffer[0] & 0x0f) * 4
    const messageType = (buffer[1] >> 4) & 0x0f
    const flags = buffer[1] & 0x0f
    const serialization = (buffer[2] >> 4) & 0x0f
    const compression = buffer[2] & 0x0f
    let offset = headerSize

    if (flags === 0x01 || flags === 0x03) {
        offset += 4
    }

    if (messageType === 0x0f) {
        const code = buffer.length >= offset + 4 ? buffer.readUInt32BE(offset) : 0
        offset += 4
        const size = buffer.length >= offset + 4 ? buffer.readUInt32BE(offset) : 0
        offset += 4
        const errorPayload = size ? buffer.subarray(offset, offset + size).toString('utf8') : ''
        return {error: {code, message: errorPayload || '火山实时转写返回错误'}}
    }

    if (buffer.length < offset + 4) return null
    const payloadSize = buffer.readUInt32BE(offset)
    offset += 4
    let payload = buffer.subarray(offset, offset + payloadSize)
    if (compression === 0x01 && payload.length) {
        payload = gunzipSync(payload)
    }

    if (serialization === 0x01) {
        try {
            return JSON.parse(payload.toString('utf8'))
        } catch {
            return payload.toString('utf8')
        }
    }
    return payload.toString('utf8')
}

const SPEAKER_KEYS = [
    'speaker_id',
    'speakerId',
    'speaker',
    'spk',
    'spk_id',
    'spkId',
    'speakerNo',
    'speaker_no',
    'user_id',
    'userId',
    'uid',
    'channel_id',
    'channelId'
]

function pickSpeakerValue(data: any, depth = 0): any {
    if (!data || typeof data !== 'object' || depth > 3) return undefined
    for (const key of SPEAKER_KEYS) {
        const value = data[key]
        if (value !== undefined && value !== null && value !== '') return value
    }

    const nestedKeys = ['speaker_info', 'speakerInfo', 'additions', 'addition', 'extra', 'metadata', 'attribute', 'attributes']
    for (const key of nestedKeys) {
        const value = pickSpeakerValue(data[key], depth + 1)
        if (value !== undefined && value !== null && value !== '') return value
    }

    return undefined
}

function normalizeSpeakerName(value: any): string {
    if (value === undefined || value === null || value === '') return ''
    const text = String(value).trim()
    if (!text) return ''

    const cnMatch = text.match(/^(?:用户|说话人)\s*0*([1-9]\d*)$/)
    if (cnMatch) return `用户${cnMatch[1]}`

    const enMatch = text.match(/^(?:speaker|user|spk)[_\s-]*0*([1-9]\d*)$/i)
    if (enMatch) return `用户${enMatch[1]}`

    return text
}

function createSpeakerLabeler() {
    const labels = new Map<string, string>()
    let nextIndex = 1

    return (data: any, fallbackIndex = 1, parent?: any): string => {
        const rawValue = pickSpeakerValue(data) ?? pickSpeakerValue(parent)
        if (rawValue === undefined || rawValue === null || rawValue === '') {
            return ''
        }

        const normalizedName = normalizeSpeakerName(rawValue)
        if (/^用户\d+$/u.test(normalizedName)) return normalizedName
        if (/^说话人\d+$/u.test(normalizedName)) return normalizedName.replace(/^说话人/u, '用户')

        const key = String(rawValue).trim().toLowerCase()
        if (!labels.has(key)) {
            labels.set(key, `用户${nextIndex++}`)
        }
        return labels.get(key)!
    }
}

function getRealtimeUtteranceItems(data: any): any[] {
    const candidates = [
        data?.result?.utterances,
        data?.utterances,
        data?.data?.utterances,
        data?.payload?.utterances,
        data?.payload?.result?.utterances,
        data?.result?.segments,
        data?.segments,
        data?.results
    ]
    for (const item of candidates) {
        if (Array.isArray(item) && item.length > 0) return item
    }
    const single = data?.result?.utterance || data?.utterance
    return single ? [single] : []
}

function normalizeRealtimeUtterances(data: any, resolveSpeaker = createSpeakerLabeler()): RealtimeSttUtterance[] {
    return getRealtimeUtteranceItems(data)
        .map((item, index) => {
            const text = String(item?.text || item?.content || item?.transcript || '').trim()
            if (!text) return null
            // 提取时间戳（毫秒转秒）
            const startTime = item?.start_time != null ? Number(item.start_time) / 1000
                : item?.startTime != null ? Number(item.startTime) / 1000
                : item?.begin != null ? Number(item.begin) / 1000
                : undefined
            const endTime = item?.end_time != null ? Number(item.end_time) / 1000
                : item?.endTime != null ? Number(item.endTime) / 1000
                : item?.end != null ? Number(item.end) / 1000
                : undefined
            return {
                speaker: resolveSpeaker(item, index + 1, data),
                text,
                start_time: startTime,
                end_time: endTime
            }
        })
        .filter((item): item is RealtimeSttUtterance => !!item)
}

function formatRealtimeUtterances(utterances: RealtimeSttUtterance[]): string {
    return utterances.map(item => item.speaker ? `${item.speaker}：${item.text}` : item.text).join('\n')
}

function normalizeTranscriptLine(text: string): string {
    return text.replace(/[：]/g, ':').replace(/\s+/g, '').trim().toLowerCase()
}

function trimEndingPunctuation(text: string): string {
    return text.replace(/[。！？.!?,，、；;：:\s]+$/u, '')
}

function getIncrementalText(previous: string, current: string): string {
    const prev = (previous || '').trim()
    const next = (current || '').trim()
    if (!prev || !next || prev === next) return ''
    if (next.startsWith(prev)) return next.slice(prev.length).trim()

    const prevCore = trimEndingPunctuation(prev)
    if (prevCore && next.startsWith(prevCore)) {
        return next.slice(prevCore.length).trim()
    }

    return ''
}

function mergeRealtimeText(existing: string, incoming: string): string {
    const left = (existing || '').replace(/\r\n/g, '\n').trim()
    const right = (incoming || '').replace(/\r\n/g, '\n').trim()
    if (!left) return right
    if (!right) return left
    if (left === right || left.includes(right)) return left
    if (right.includes(left)) return right

    const leftLines = left.split('\n').map(line => line.trim()).filter(Boolean)
    const rightLines = right.split('\n').map(line => line.trim()).filter(Boolean)
    const leftKeys = new Set(leftLines.map(normalizeTranscriptLine))
    const rightKeys = new Set(rightLines.map(normalizeTranscriptLine))

    if (leftLines.length > 0 && leftLines.every(line => rightKeys.has(normalizeTranscriptLine(line)))) {
        return right
    }

    const merged = [...leftLines]
    for (const line of rightLines) {
        const key = normalizeTranscriptLine(line)
        if (!leftKeys.has(key)) {
            merged.push(line)
            leftKeys.add(key)
        }
    }
    return merged.join('\n')
}

function extractRealtimeText(data: any, resolveSpeaker = createSpeakerLabeler()): { text: string; final: boolean; speaker?: string; utterances?: RealtimeSttUtterance[] } {
    if (typeof data === 'string') return {text: data, final: true}

    const utterances = normalizeRealtimeUtterances(data, resolveSpeaker)
    const utteranceText = utterances.length ? formatRealtimeUtterances(utterances) : ''

    const directText =
        data?.text ??
        data?.transcript ??
        data?.delta ??
        data?.content ??
        data?.result?.text ??
        data?.result?.transcript ??
        data?.result?.utterance?.text ??
        data?.data?.text ??
        data?.data?.transcript ??
        data?.payload?.text ??
        data?.payload?.result?.text ??
        data?.choices?.[0]?.delta?.content ??
        data?.choices?.[0]?.message?.content

    let text = utteranceText || (typeof directText === 'string' ? directText : '')

    if (!text && Array.isArray(data?.segments)) {
        text = data.segments.map((seg: any) => seg?.text || seg?.content || '').join('')
    }

    if (!text && Array.isArray(data?.results)) {
        text = data.results.map((item: any) => item?.text || item?.transcript || '').join('')
    }

    const speaker = pickSpeakerValue(data) !== undefined ? resolveSpeaker(data) : ''
    if (speaker && text && !utteranceText && !text.startsWith(`${speaker}：`)) {
        text = `${speaker}：${text}`
    }

    const eventName = String(data?.type || data?.event || data?.status || '').toLowerCase()
    const final =
        data?.is_final === true ||
        data?.final === true ||
        data?.completed === true ||
        data?.done === true ||
        (getRealtimeUtteranceItems(data).length > 0 && getRealtimeUtteranceItems(data).every((item: any) => item?.definite !== false)) ||
        eventName.includes('final') ||
        eventName.includes('completed') ||
        eventName.includes('sentence_end')

    return {
        text,
        final,
        speaker: utterances.length === 1 ? utterances[0].speaker : speaker || undefined,
        utterances: utterances.length ? utterances : undefined
    }
}

/**
 * 创建实时语音转文字会话。
 *
 * 约定协议:
 * - 连接语音转文字配置中的 ws/wss baseUrl
 * - 鉴权头: Authorization: Bearer <apiKey>
 * - 打开后发送 start JSON，随后发送 pcm_s16le 二进制音频帧
 * - 停止时发送 end JSON
 *
 * 自定义 STT 服务只要兼容以上协议即可直接使用；服务返回的常见 text/transcript/final 字段会被自动解析。
 */
export function createRealtimeSttSession(onEvent: (event: RealtimeSttEvent) => void): RealtimeSttSession {
    const config = getRealtimeSttConfig()
    if (!config) {
        throw new Error('未配置语音实时转写模型，请先在「模型配置 → 语音实时转写」中添加 WSS 地址')
    }

    const url = normalizeRealtimeUrl(config)
    const sessionId = `stt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const pendingAudio: Buffer[] = []
    const sentUtterances: RealtimeSttUtterance[] = [] // 已发送的话语，用于计算增量
    const resolveSpeaker = createSpeakerLabeler()
    let accumulatedText = ''
    const sessionStartTime = Date.now() // 会话开始时间，用于计算相对时间戳
    const doubaoBigModel = isDoubaoBigModelRealtime(config)
    let opened = false
    let closed = false
    let endTimer: ReturnType<typeof setTimeout> | null = null
    let stopResolver: ((text: string) => void) | null = null

    const ws = new WebSocket(url, {
        headers: doubaoBigModel
            ? resolveDoubaoAuth(config, randomUUID())
            : {
                Authorization: `Bearer ${config.apiKey}`,
                'X-Model': config.model || '',
                'X-Provider': config.provider || ''
            }
    })

    ws.on('open', () => {
        opened = true
        if (doubaoBigModel) {
            ws.send(buildDoubaoFullClientRequest(config, sessionId))
        } else {
            ws.send(JSON.stringify({
                type: 'start',
                model: config.model,
                provider: config.provider,
                audio_format: 'pcm_s16le',
                sample_rate: 16000,
                channels: 1,
                language: 'zh-CN',
                interim_results: true
            }))
        }
        while (pendingAudio.length && ws.readyState === WebSocket.OPEN) {
            const buffer = pendingAudio.shift()!
            ws.send(doubaoBigModel ? buildDoubaoAudioFrame(buffer) : buffer)
        }
        onEvent({type: 'ready'})
    })

    ws.on('message', (message) => {
        let raw: any
        if (doubaoBigModel) {
            try {
                raw = parseDoubaoRealtimeFrame(message)
            } catch (e: any) {
                onEvent({type: 'error', message: e.message || '火山实时转写响应解析失败'})
                return
            }
        } else {
            raw = message.toString()
            try {
                raw = JSON.parse(raw)
            } catch {}
        }

        if (raw?.error) {
            const message = raw.error.message || raw.error.msg || JSON.stringify(raw.error)
            onEvent({type: 'error', message})
            return
        }

        const parsed = extractRealtimeText(raw, resolveSpeaker)
        if (!parsed.text) return

        if (parsed.final) {
            console.log(`[STT] final事件: text="${parsed.text?.slice(0, 50)}", utterances=${parsed.utterances?.length}, sent=${sentUtterances.length}`)

            // 计算增量话语
            let deltaUtterances: RealtimeSttUtterance[] = []
            if (parsed.utterances && parsed.utterances.length > 0) {
                for (let index = 0; index < parsed.utterances.length; index++) {
                    const utt = parsed.utterances[index]
                    const previous = sentUtterances[index]

                    if (previous && previous.speaker === utt.speaker) {
                        sentUtterances[index] = utt
                        continue
                    }

                    const exists = sentUtterances.some(s =>
                        s.text === utt.text && s.speaker === utt.speaker
                    )
                    if (!exists) {
                        deltaUtterances.push(utt)
                        sentUtterances[index] = utt
                    }
                }
            }

            // 为没有时间戳的增量话语补充相对时间
            for (const utt of deltaUtterances) {
                if (utt.start_time === undefined) {
                    const elapsed = (Date.now() - sessionStartTime) / 1000
                    utt.end_time = Math.max(0, elapsed)
                }
            }

            // 增量文本：仅新增话语的格式化文本
            let deltaText = ''
            if (deltaUtterances.length > 0) {
                deltaText = formatRealtimeUtterances(deltaUtterances)
            } else if (!parsed.utterances || parsed.utterances.length === 0) {
                // 没有话语信息时，parsed.text 就是当前这一句（非累积）
                deltaText = parsed.text.trim()
            }
            // 如果有 utterances 但没有新增的（deltaUtterances 为空），deltaText 保持为空，不重复保存

            accumulatedText = mergeRealtimeText(accumulatedText, deltaText)
            console.log(`[STT] 增量结果: delta_utterances=${deltaUtterances.length}, delta_text="${deltaText?.slice(0, 50)}", sent_total=${sentUtterances.length}`)

            // 完整文本以追加式累计缓存为准，避免服务端停顿后只返回最后一句时覆盖前文。
            const fullText = mergeRealtimeText(accumulatedText, formatRealtimeUtterances(sentUtterances))

            onEvent({
                type: 'final',
                text: parsed.text,
                speaker: parsed.speaker,
                utterances: parsed.utterances,
                full_text: fullText,
                delta_text: deltaText,
                delta_utterances: deltaUtterances.length ? deltaUtterances : undefined,
                raw
            })
        } else {
            // partial 事件：从已确认话语 + 当前 partial 拼接
            const fullText = mergeRealtimeText(accumulatedText, parsed.text)
            onEvent({
                type: 'partial',
                text: parsed.text,
                speaker: parsed.speaker,
                utterances: parsed.utterances,
                full_text: fullText,
                raw
            })
        }
    })

    ws.on('close', () => {
        if (endTimer) clearTimeout(endTimer)
        closed = true
        const fullText = mergeRealtimeText(accumulatedText, formatRealtimeUtterances(sentUtterances))
        onEvent({type: 'closed', full_text: fullText})
        if (stopResolver) {
            stopResolver(fullText)
            stopResolver = null
        }
    })

    ws.on('error', (error) => {
        onEvent({type: 'error', message: error.message})
        if (stopResolver) {
            stopResolver(mergeRealtimeText(accumulatedText, formatRealtimeUtterances(sentUtterances)))
            stopResolver = null
        }
    })

    return {
        id: sessionId,
        sendAudio(buffer: Buffer) {
            if (closed || !buffer.length) return
            if (opened && ws.readyState === WebSocket.OPEN) {
                ws.send(doubaoBigModel ? buildDoubaoAudioFrame(buffer) : buffer)
            } else {
                pendingAudio.push(buffer)
            }
        },
        stop() {
            return new Promise<string>((resolve) => {
                const getFullText = () => mergeRealtimeText(accumulatedText, formatRealtimeUtterances(sentUtterances))
                if (closed || ws.readyState === WebSocket.CLOSED) {
                    resolve(getFullText())
                    return
                }
                stopResolver = resolve
                const finishTimer = setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                        ws.close()
                    }
                    if (stopResolver) {
                        stopResolver(getFullText())
                        stopResolver = null
                    }
                }, doubaoBigModel ? 1800 : 800)

                const previousResolver = stopResolver
                stopResolver = (text: string) => {
                    clearTimeout(finishTimer)
                    previousResolver?.(text)
                }

                if (ws.readyState === WebSocket.OPEN) {
                    if (doubaoBigModel) {
                        ws.send(buildDoubaoEndFrame())
                        endTimer = setTimeout(() => ws.close(), 1200)
                    } else {
                        ws.send(JSON.stringify({type: 'end'}))
                        setTimeout(() => {
                            if (ws.readyState === WebSocket.OPEN) ws.close()
                        }, 300)
                    }
                } else if (ws.readyState === WebSocket.CONNECTING) {
                    ws.close()
                }
            })
        }
    }
}

/**
 * 转写音频文件 - 主入口
 */
export async function transcribeAudio(audioPath: string, enableDiarization = true): Promise<SttResult> {
    const config = getSttConfig()
    if (!config) {
        throw new Error('未配置普通语音转文字模型，请先在「模型配置 → 语音模型」中添加非 WSS 的批量转写配置')
    }

    if (!fs.existsSync(audioPath)) {
        throw new Error('音频文件不存在: ' + audioPath)
    }

    const provider = config.provider

    // 根据服务商选择对应 API
    if (provider === 'doubao_stt' || provider === 'doubao') {
        return callDoubaoAsr(audioPath, config, enableDiarization)
    }
    if (provider === 'xunfei_stt') {
        return callXunfeiAsr(audioPath, config, enableDiarization)
    }
    if (provider === 'ali_stt') {
        return callAliAsr(audioPath, config, enableDiarization)
    }
    if (provider === 'baidu_stt') {
        return callBaiduAsr(audioPath, config, enableDiarization)
    }
    // OpenAI Whisper 兼容接口 (openai_stt, siliconflow_stt, groq_stt, custom_stt)
    return callOpenAIWhisper(audioPath, config, enableDiarization)
}

/**
 * 豆包/火山引擎 ASR
 * 使用火山引擎语音识别 API，支持说话人分离
 */
async function callDoubaoAsr(audioPath: string, config: SttConfig, enableDiarization: boolean): Promise<SttResult> {
    const audioBuffer = fs.readFileSync(audioPath)
    const ext = path.extname(audioPath).toLowerCase()
    const contentType = ext === '.mp3' ? 'audio/mp3' : ext === '.wav' ? 'audio/wav' : ext === '.m4a' ? 'audio/mp4' : 'audio/wav'

    const form = new FormData()
    form.append('file', audioBuffer, {
        filename: path.basename(audioPath),
        contentType
    })

    const params: Record<string, string> = {
        model: config.model || 'asr'
    }
    if (enableDiarization) {
        params.speaker_diarization = 'true'
    }

    const url = `${config.baseUrl}/auc/recognize`
    const response = await axios.post(url, form, {
        headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer; ${config.apiKey}`
        },
        params,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 120000
    })

    return parseDoubaoResponse(response.data)
}

function parseDoubaoResponse(data: any): SttResult {
    const utterances: SttUtterance[] = []
    const items = data?.data?.utterances || data?.utterances || []
    const resolveSpeaker = createSpeakerLabeler()

    for (let index = 0; index < items.length; index++) {
        const item = items[index]
        utterances.push({
            speaker: resolveSpeaker(item, index + 1, data) || `用户${index + 1}`,
            text: item.text || '',
            start_time: item.start_time || 0,
            end_time: item.end_time || 0
        })
    }

    const fullText = utterances.map(u => `${u.speaker}：${u.text}`).join('\n') || data?.data?.text || data?.text || ''

    if (utterances.length === 0 && fullText) {
        utterances.push({speaker: '用户1', text: fullText, start_time: 0, end_time: 0})
    }

    return {utterances, full_text: fullText}
}

/**
 * 讯飞语音转写 API
 * 使用讯飞开放平台 WebSocket / HTTP 接口
 */
async function callXunfeiAsr(audioPath: string, config: SttConfig, enableDiarization: boolean): Promise<SttResult> {
    // 讯飞使用 OpenAI 兼容接口格式（讯飞已支持）
    // 如果用户配置了讯飞自定义地址，走 OpenAI Whisper 兼容格式
    return callOpenAIWhisper(audioPath, config, enableDiarization)
}

/**
 * 阿里云语音识别 (Paraformer / SenseVoice)
 * 阿里云 DashScope 已支持 OpenAI 兼容接口
 */
async function callAliAsr(audioPath: string, config: SttConfig, enableDiarization: boolean): Promise<SttResult> {
    // 阿里云 DashScope 支持 OpenAI Whisper 兼容格式
    // baseUrl 应为 https://dashscope.aliyuncs.com/compatible-mode/v1
    return callOpenAIWhisper(audioPath, config, enableDiarization)
}

/**
 * 百度语音识别
 * 百度千帆已支持 OpenAI 兼容接口
 */
async function callBaiduAsr(audioPath: string, config: SttConfig, enableDiarization: boolean): Promise<SttResult> {
    // 百度千帆支持 OpenAI 兼容格式
    return callOpenAIWhisper(audioPath, config, enableDiarization)
}

/**
 * OpenAI Whisper 兼容接口
 * 支持: OpenAI, SiliconFlow, Groq, 以及其他兼容接口
 */
async function callOpenAIWhisper(audioPath: string, config: SttConfig, enableDiarization: boolean): Promise<SttResult> {
    const audioBuffer = fs.readFileSync(audioPath)
    const ext = path.extname(audioPath).toLowerCase()
    const contentType = ext === '.mp3' ? 'audio/mp3' : ext === '.wav' ? 'audio/wav' : ext === '.m4a' ? 'audio/mp4' : ext === '.webm' ? 'audio/webm' : 'audio/wav'

    const form = new FormData()
    form.append('file', audioBuffer, {
        filename: path.basename(audioPath),
        contentType
    })
    form.append('model', config.model || 'whisper-1')
    form.append('response_format', 'verbose_json')

    if (enableDiarization) {
        // Some providers support diarization via extra parameters
        form.append('timestamp_granularities[]', 'segment')
    }

    const url = `${config.baseUrl}/audio/transcriptions`
    const response = await axios.post(url, form, {
        headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${config.apiKey}`
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 120000
    })

    return parseWhisperResponse(response.data)
}

function parseWhisperResponse(data: any): SttResult {
    const utterances: SttUtterance[] = []

    // verbose_json format with segments
    const segments = data?.segments || []
    if (segments.length > 0) {
        let speakerCounter = 1
        for (const seg of segments) {
            utterances.push({
                speaker: `用户${speakerCounter}`,
                text: seg.text?.trim() || '',
                start_time: seg.start || 0,
                end_time: seg.end || 0
            })
            // Simple speaker change heuristic: if gap > 2s, increment speaker
            if (seg.end && segments[segments.indexOf(seg) + 1]?.start &&
                segments[segments.indexOf(seg) + 1].start - seg.end > 2) {
                speakerCounter++
            }
        }
    }

    const fullText = utterances.length
        ? utterances.map(u => `${u.speaker}：${u.text}`).join('\n')
        : data?.text || ''

    if (utterances.length === 0 && fullText) {
        utterances.push({speaker: '用户1', text: fullText, start_time: 0, end_time: 0})
    }

    return {utterances, full_text: fullText}
}
