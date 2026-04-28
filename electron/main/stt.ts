import path from 'path'
import fs from 'fs'
import axios from 'axios'
import FormData from 'form-data'
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

/**
 * 查找 STT 模型配置
 */
function getSttConfig(): SttConfig | null {
    const configs = modelConfigsDb.list()
    const sttConfigs = configs.filter(c => c.model_type === 'stt')
    if (sttConfigs.length === 0) return null
    // 优先使用默认配置
    const defaultCfg = sttConfigs.find(c => c.is_default === 1)
    const cfg = defaultCfg || sttConfigs[0]
    return {
        provider: cfg.provider,
        baseUrl: cfg.base_url,
        apiKey: cfg.api_key,
        model: cfg.model
    }
}

/**
 * 转写音频文件 - 主入口
 */
export async function transcribeAudio(audioPath: string, enableDiarization = true): Promise<SttResult> {
    const config = getSttConfig()
    if (!config) {
        throw new Error('未配置语音转文字模型，请先在「模型配置 → 语音转文字」中添加')
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

    for (const item of items) {
        utterances.push({
            speaker: item.speaker_id ? `说话人${item.speaker_id}` : '说话人1',
            text: item.text || '',
            start_time: item.start_time || 0,
            end_time: item.end_time || 0
        })
    }

    const fullText = utterances.map(u => u.text).join('') || data?.data?.text || data?.text || ''

    if (utterances.length === 0 && fullText) {
        utterances.push({speaker: '说话人1', text: fullText, start_time: 0, end_time: 0})
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
                speaker: `说话人${speakerCounter}`,
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

    const fullText = data?.text || utterances.map(u => u.text).join('') || ''

    if (utterances.length === 0 && fullText) {
        utterances.push({speaker: '说话人1', text: fullText, start_time: 0, end_time: 0})
    }

    return {utterances, full_text: fullText}
}
