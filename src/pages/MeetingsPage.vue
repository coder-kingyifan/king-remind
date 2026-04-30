<template>
  <div class="meetings-page" tabindex="0" ref="pageRef">
    <!-- 头部 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">会议</h1>
        <p class="page-subtitle" v-if="meetingsStore.stats.pending + meetingsStore.stats.ongoing">
          {{ meetingsStore.stats.pending + meetingsStore.stats.ongoing }} 场待开/进行中
        </p>
      </div>
      <div class="header-actions">
        <el-button size="small" round @click="startQuickRecord" :disabled="isAnyRecording" class="rec-btn">
          <el-icon style="margin-right:4px"><Microphone/></el-icon>{{ isSimpleMode ? '录音' : '实时录音' }}
        </el-button>
        <el-button type="primary" size="small" round @click="openCreate">
          <el-icon style="margin-right:4px"><Plus/></el-icon>新建会议
        </el-button>
      </div>
    </div>

    <!-- 录音浮窗 -->
    <div v-if="isAnyRecording" class="recording-float">
      <div class="recording-float-main">
        <span class="rec-dot"></span>
        <span class="rec-time">{{ formatDuration(recordingDuration) }}</span>
        <span class="rt-state" :class="realtimeSttStatus" v-if="!isSimpleMode">{{ realtimeStatusLabel }}</span>
        <el-button type="danger" size="small" round @click="stopCurrentRecording">停止</el-button>
      </div>
      <div v-if="liveTranscript && !isSimpleMode" ref="recordingLiveRef" class="recording-live">{{ liveTranscript }}</div>
    </div>

    <!-- 筛选 -->
    <div class="filters">
      <div class="tabs">
        <span v-for="f in statusFilters" :key="f.value" class="tab" :class="{active: statusFilter === f.value}" @click="statusFilter = f.value; handleFilterChange()">{{ f.label }}</span>
      </div>
    </div>

    <!-- 列表 -->
    <div v-if="meetingsStore.loading" class="state-wrap">
        <el-icon class="loading-icon" :size="26"><Loading /></el-icon>
        <span>加载中...</span>
      </div>

    <template v-else-if="meetingsStore.meetings.length">
      <div v-for="meeting in meetingsStore.meetings" :key="meeting.id" class="meeting-card" @click="openDetail(meeting)">
        <div class="card-top">
          <span class="card-status" :class="meeting.status">{{ statusLabel(meeting.status) }}</span>
          <span class="card-time">{{ fmtTime(meeting.start_time) }}</span>
        </div>
        <div class="card-title">{{ meeting.title }}</div>
        <div class="card-meta">
          <span v-if="meeting.location" class="meta-item"><el-icon :size="12"><Location/></el-icon>{{ meeting.location }}</span>
          <span v-if="parseParticipants(meeting.participants).length" class="meta-item"><el-icon :size="12"><User/></el-icon>{{ parseParticipants(meeting.participants).length }}人</span>
          <span v-if="meeting.has_recording" class="meta-item recording"><el-icon :size="12"><Microphone/></el-icon>有录音</span>
          <span v-if="(meeting as any).stt_status === 'done' && !isSimpleMode" class="meta-item stt"><el-icon :size="12"><Document/></el-icon>已转写</span>
        </div>
        <el-icon :size="14" class="card-del" @click.stop="handleDelete(meeting)"><Delete/></el-icon>
      </div>
    </template>

    <div v-else class="state-wrap empty">
        <div class="empty-illustration" aria-hidden="true">
          <div class="empty-mic"></div>
          <div class="empty-bubble"></div>
        </div>
        <strong>记录会议，留存关键信息</strong>
        <p>可以新建会议或直接录音，支持实时转写和 AI 摘要。</p>
      </div>

    <!-- 新建/编辑弹窗 -->
    <el-dialog v-model="detailVisible" width="680px" :close-on-click-modal="false" destroy-on-close top="4vh">
      <div class="detail-header">
        <input v-model="editForm.title" class="detail-title" placeholder="会议标题"/>
        <div class="detail-status-row">
          <span class="card-status" :class="editForm.status" @click="cycleStatus" style="cursor:pointer">{{ statusLabel(editForm.status) }}</span>
          <el-date-picker v-model="editForm.start_time" type="datetime" value-format="YYYY-MM-DD HH:mm" placeholder="会议时间" size="small" style="width:180px"/>
        </div>
      </div>

      <!-- 更多选项（折叠） -->
      <div class="more-options">
        <div class="more-toggle" @click="showMoreOptions = !showMoreOptions">
          <el-icon :size="12"><component :is="showMoreOptions ? ArrowUp : ArrowDown"/></el-icon>
          <span>{{ showMoreOptions ? '收起更多选项' : '更多选项' }}</span>
        </div>
        <div v-if="showMoreOptions" class="more-fields">
          <div class="field-row">
            <label>类型</label>
            <div class="type-chips">
              <span v-for="t in typeFilters" :key="t.value" class="chip" :class="{active: editForm.meeting_type === t.value}" @click="editForm.meeting_type = t.value as any">{{ t.label }}</span>
            </div>
          </div>
          <div class="field-row">
            <label>结束时间</label>
            <el-date-picker v-model="editForm.end_time" type="datetime" value-format="YYYY-MM-DD HH:mm" placeholder="可选" size="small" style="width:100%"/>
          </div>
          <div class="field-row">
            <label>地点</label>
            <input v-model="editForm.location" class="field-input" placeholder="可选"/>
          </div>
          <div class="field-row">
            <label>参会人</label>
            <div class="participant-input">
              <span v-for="(p, i) in editForm.participants" :key="i" class="p-tag">{{ p }}<span @click="editForm.participants.splice(i, 1)">&times;</span></span>
              <input v-model="newParticipant" class="p-input" placeholder="回车添加" @keydown.enter.prevent="addParticipant"/>
            </div>
          </div>
          <div class="field-row">
            <label>描述</label>
            <textarea v-model="editForm.description" class="field-textarea" placeholder="可选" rows="2"/>
          </div>
        </div>
      </div>

      <!-- 会议记录 - 分段编辑器 -->
      <div class="detail-section">
        <div class="section-head">
          <label>会议记录</label>
          <div class="section-actions">
            <el-button size="small" text @click="addTextSegment"><el-icon><EditPen/></el-icon>文本</el-button>
            <el-button size="small" text @click="addAudioSegment"><el-icon><Upload/></el-icon>音频</el-button>
            <el-button size="small" text @click="startSegmentRecord" v-if="!isSegmentRecording"><el-icon><Microphone/></el-icon>{{ isSimpleMode ? '录音' : '实时录音' }}</el-button>
            <el-button size="small" text type="danger" @click="stopSegmentRecord" v-else><span class="rec-dot-sm"></span>停止</el-button>
          </div>
        </div>

        <!-- 分段列表 -->
        <div class="segments-list" v-if="segments.length">
          <div v-for="(seg, i) in segments" :key="seg.id || i" class="segment-item" :class="seg.segment_type">
            <div class="seg-header">
              <span v-if="seg.start_time > 0 || seg.end_time > 0" class="seg-time">{{ formatSegmentTime(seg.start_time) }} - {{ formatSegmentTime(seg.end_time) }}</span>
              <span class="seg-type-badge" :class="seg.segment_type">{{ seg.segment_type === 'audio' ? '语音' : '文本' }}</span>
              <input v-model="seg.speaker" class="seg-speaker" placeholder="说话人" @change="updateSegment(seg)"/>
              <span v-if="segments.filter(s => s.speaker && s.speaker === seg.speaker).length > 1" class="seg-rename-all" @click="renameAllSpeaker(seg.speaker)" title="重命名所有同名说话人">⇄</span>
              <div class="seg-actions">
                <span v-if="i > 0" class="seg-move" @click="moveSegment(i, -1)" title="上移">&uarr;</span>
                <span v-if="i < segments.length - 1" class="seg-move" @click="moveSegment(i, 1)" title="下移">&darr;</span>
                <span class="seg-del" @click="deleteSegment(seg, i)">&times;</span>
              </div>
            </div>
            <!-- 文本段 -->
            <textarea v-if="seg.segment_type === 'text'" v-model="seg.content" class="seg-textarea" placeholder="输入内容..." rows="3" @change="updateSegment(seg)"/>
            <!-- 音频段 -->
            <div v-else class="seg-audio">
              <audio v-if="segAudioUrls[seg.content]" :src="segAudioUrls[seg.content]" controls style="width:100%;height:32px"/>
              <span v-else class="seg-audio-path">{{ seg.content.split('/').pop() }}</span>
            </div>
          </div>
        </div>

        <!-- 兼容旧版会议记录 -->
        <div v-if="!segments.length" class="legacy-minutes">
          <textarea v-model="editForm.minutes" class="detail-textarea" placeholder="输入或粘贴会议记录..." rows="4"/>
        </div>
      </div>

      <!-- 录音 -->
      <div class="detail-section">
        <label>会议录音</label>
        <div class="recording-area">
          <template v-if="isRecording">
            <span class="rec-dot"></span>
            <span class="rec-time">{{ formatDuration(recordingDuration) }}</span>
            <el-button type="danger" size="small" round @click="stopCurrentRecording">停止录音</el-button>
            <span class="rt-state" :class="realtimeSttStatus" v-if="!isSimpleMode">{{ realtimeStatusLabel }}</span>
          </template>
          <template v-else>
            <el-button size="small" round @click="startRecording">
              <el-icon style="margin-right:4px"><Microphone/></el-icon>{{ isSimpleMode && editForm.has_recording ? '继续录音' : (isSimpleMode ? '开始录音' : '开始实时录音') }}
            </el-button>
          </template>
          <div v-if="editForm.recording_path" class="recording-play">
            <audio v-if="recordingUrl" :src="recordingUrl" controls style="height:28px"/>
            <span v-else>已有录音</span>
          </div>
        </div>
      </div>

      <!-- 语音转文字 -->
      <div class="detail-section" v-if="!isSimpleMode && editForm.id && (editForm.has_recording || segments.some(s => s.segment_type === 'audio'))">
        <div class="section-head">
          <label>语音转文字</label>
          <span v-if="(editForm as any).stt_status === 'done'" class="stt-status done">已转写</span>
          <span v-else-if="(editForm as any).stt_status === 'pending'" class="stt-status pending">转写中...</span>
        </div>
        <div class="stt-area">
          <el-button size="small" round @click="doStt" :loading="sttLoading" :disabled="(editForm as any).stt_status === 'pending'">
            <el-icon style="margin-right:4px"><MagicStick/></el-icon>批量转写录音（说话人分离）
          </el-button>
          <div v-if="(editForm as any).stt_text" class="stt-text">
            <p>{{ (editForm as any).stt_text }}</p>
          </div>
        </div>
      </div>

      <div class="detail-section" v-if="!isSimpleMode && (liveTranscript || realtimeError)">
        <div class="section-head">
          <label>实时转写</label>
          <span class="stt-status" :class="realtimeSttStatus">{{ realtimeStatusLabel }}</span>
        </div>
        <div v-if="liveTranscript" ref="liveTranscriptRef" class="stt-text live">
          <p>{{ liveTranscript }}</p>
        </div>
        <p v-if="realtimeError" class="stt-error">{{ realtimeError }}</p>
      </div>

      <!-- 附件 -->
      <div class="detail-section">
        <label>附件</label>
        <div class="attachment-area">
          <div class="upload-btn" @click="triggerUpload" @dragover.prevent @drop.prevent="handleDrop">
            <el-icon :size="16"><Upload/></el-icon>
            <span>点击或拖拽上传</span>
            <input ref="fileInputRef" type="file" multiple style="display:none" @change="handleFileSelect" accept=".txt,.md,.pdf,.doc,.docx,.mp3,.wav,.m4a,.ogg,.webm,.flac,.png,.jpg,.jpeg,.gif,.webp"/>
          </div>
          <div v-if="editForm.attachments.length" class="attachment-list">
            <div v-for="(att, i) in editForm.attachments" :key="i" class="att-item">
              <el-icon :size="14"><Document/></el-icon>
              <span class="att-name">{{ att.name }}</span>
              <span class="att-del" @click="editForm.attachments.splice(i, 1)">&times;</span>
            </div>
          </div>
        </div>
      </div>

      <!-- AI 摘要 -->
      <div class="detail-section" v-if="editForm.id && !isSimpleMode">
        <label>AI 摘要</label>
        <div class="ai-area">
          <el-button size="small" round @click="generateSummary" :loading="summarizing" :disabled="!editForm.minutes && !segments.length && !(editForm as any).stt_text">
            <el-icon style="margin-right:4px"><MagicStick/></el-icon>生成摘要
          </el-button>
          <div v-if="aiSummary" class="summary-content">
            <div v-if="aiSummary.summary" class="summary-block">
              <span class="summary-label">总结</span>
              <p>{{ aiSummary.summary }}</p>
            </div>
            <div v-if="aiSummary.topics?.length" class="summary-block">
              <span class="summary-label">议题</span>
              <ul><li v-for="(t, i) in aiSummary.topics" :key="i">{{ t }}</li></ul>
            </div>
            <div v-if="aiSummary.decisions?.length" class="summary-block">
              <span class="summary-label">决议</span>
              <ul><li v-for="(d, i) in aiSummary.decisions" :key="i">{{ d }}</li></ul>
            </div>
            <div v-if="aiSummary.action_items?.length" class="summary-block">
              <span class="summary-label">待办</span>
              <ul>
                <li v-for="(a, i) in aiSummary.action_items" :key="i">
                  {{ a.task }}<span v-if="a.assignee"> - {{ a.assignee }}</span><span v-if="a.deadline"> ({{ a.deadline }})</span>
                </li>
              </ul>
            </div>
            <div v-if="aiSummary.key_points?.length" class="summary-block">
              <span class="summary-label">要点</span>
              <ul><li v-for="(k, i) in aiSummary.key_points" :key="i">{{ k }}</li></ul>
            </div>
          </div>
        </div>
      </div>

      <!-- AI 问答 -->
      <div class="detail-section" v-if="editForm.id && !isSimpleMode">
        <label>AI 问答</label>
        <div class="ai-chat-area">
          <div v-if="aiChatHistory.length" class="ai-chat-list">
            <div v-for="(msg, i) in aiChatHistory" :key="i" class="ai-msg" :class="msg.role">
              <span class="ai-msg-role">{{ msg.role === 'user' ? '你' : 'AI' }}</span>
              <span class="ai-msg-text">{{ msg.content }}</span>
            </div>
          </div>
          <div class="ai-chat-input">
            <input v-model="aiQuestion" class="ai-input" placeholder="对会议内容提问..." @keydown.enter.prevent="sendAiChat" :disabled="aiChatLoading"/>
            <el-button type="primary" size="small" round @click="sendAiChat" :loading="aiChatLoading" :disabled="!aiQuestion.trim()">发送</el-button>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button size="small" @click="detailVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {computed, nextTick, onActivated, onBeforeUnmount, onMounted, reactive, ref, watch} from 'vue'
import {useMeetingsStore} from '@/stores/meetings'
import {ArrowDown, ArrowUp, Location, Microphone, Plus, Upload, Document, MagicStick, User, EditPen, Delete} from '@element-plus/icons-vue'
import {ElMessage, ElMessageBox} from 'element-plus'
import type {AiSummary, Meeting, MeetingAttachment, MeetingSegment} from '@/types/meeting'
import {useSettingsStore} from '@/stores/settings'

function getLocalDateTimeStr(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d}T${h}:${min}:${s}`
}

const meetingsStore = useMeetingsStore()
const settingsStore = useSettingsStore()
const isSimpleMode = computed(() => settingsStore.settings.app_mode === 'simple')
const pageRef = ref<HTMLElement>()
const fileInputRef = ref<HTMLInputElement>()
const recordingLiveRef = ref<HTMLElement>()
const liveTranscriptRef = ref<HTMLElement>()

// 筛选
const statusFilter = ref('all')
const statusFilters = [
  {label: '全部', value: 'all'},
  {label: '未开始', value: 'pending'},
  {label: '进行中', value: 'ongoing'},
  {label: '已结束', value: 'completed'}
]
const typeFilters = [
  {label: '例会', value: 'regular'},
  {label: '项目会', value: 'project'},
  {label: '临时会', value: 'adhoc'}
]

// 编辑表单
const detailVisible = ref(false)
const showMoreOptions = ref(false)
const editingMeeting = ref<Meeting | null>(null)
const newParticipant = ref('')

const editForm = reactive({
  id: 0 as number,
  title: '',
  description: '',
  meeting_type: 'regular' as string,
  status: 'pending' as string,
  start_time: '',
  end_time: '' as string,
  location: '',
  participants: [] as string[],
  minutes: '',
  attachments: [] as MeetingAttachment[],
  recording_path: '' as string,
  has_recording: 0,
  todo_ids: [] as number[],
  stt_text: '' as string,
  stt_status: 'none' as string
})

// 分段
const segments = ref<MeetingSegment[]>([])
const segAudioUrls = ref<Record<string, string>>({})

// 录音
const isRecording = ref(false)
const recordingDuration = ref(0)
const recordingTimer = ref<ReturnType<typeof setInterval> | null>(null)
const mediaRecorder = ref<MediaRecorder | null>(null)
const recordingChunks = ref<Blob[]>([])
const existingRecordingChunks = ref<Blob[]>([]) // 普通模式继续录音时，保存已有录音数据用于合并
const recordingUrl = ref('')
const pendingRecordingPath = ref('')
const recordingTarget = ref<'quick' | 'meeting' | 'segment'>('quick')
const audioContext = ref<AudioContext | null>(null)
const audioSource = ref<MediaStreamAudioSourceNode | null>(null)
const audioProcessor = ref<ScriptProcessorNode | null>(null)
const audioGain = ref<GainNode | null>(null)

// 分段内录音
const isSegmentRecording = ref(false)
const segmentRecorder = ref<MediaRecorder | null>(null)
const segmentChunks = ref<Blob[]>([])

// STT
const sttLoading = ref(false)
const realtimeSttSessionId = ref('')
const realtimeSttStatus = ref<'idle' | 'connecting' | 'ready' | 'closed' | 'error' | 'recording_only'>('idle')
const realtimePartialText = ref('')
const realtimeBaseText = ref('')
const realtimeFinalText = ref('')
type RealtimeTranscriptLine = {
  line: string
  key: string
  speaker: string
  text: string
  start_time?: number
  end_time?: number
  received_at: number
}

const realtimeTranscriptLines = ref<RealtimeTranscriptLine[]>([])
const realtimeLastAppendedLines = ref<RealtimeTranscriptLine[]>([])
const realtimeError = ref('')
const recordingStartTime = ref(0) // 录音开始时间戳（ms），用于计算分段相对时间
const isStoppingRecording = ref(false) // 正在停止录音标记，防止closed事件触发重连
const isAnyRecording = computed(() => isRecording.value || isSegmentRecording.value)

function cleanTranscriptText(text?: string | null): string {
  return String(text || '').replace(/\r\n/g, '\n').trim()
}

function transcriptLineKey(text: string): string {
  return cleanTranscriptText(text).replace(/[：]/g, ':').replace(/\s+/g, '').toLowerCase()
}

function trimEndingPunctuation(text: string): string {
  return cleanTranscriptText(text).replace(/[。！？.!?,，、；;：:\s]+$/u, '')
}

function getIncrementalText(previous: string, current: string): string {
  const prev = cleanTranscriptText(previous)
  const next = cleanTranscriptText(current)
  if (!prev || !next || prev === next) return ''
  if (next.startsWith(prev)) return cleanTranscriptText(next.slice(prev.length))

  const prevCore = trimEndingPunctuation(prev)
  if (prevCore && next.startsWith(prevCore)) {
    return cleanTranscriptText(next.slice(prevCore.length))
  }

  return ''
}

function mergeTranscriptText(existing: string, incoming: string): string {
  const left = cleanTranscriptText(existing)
  const right = cleanTranscriptText(incoming)
  if (!left) return right
  if (!right) return left
  if (left === right || left.includes(right)) return left
  if (right.includes(left)) return right

  const leftLines = left.split('\n').map(line => line.trim()).filter(Boolean)
  const rightLines = right.split('\n').map(line => line.trim()).filter(Boolean)
  const leftKeys = new Set(leftLines.map(transcriptLineKey))
  const rightKeys = new Set(rightLines.map(transcriptLineKey))

  if (leftLines.length > 0 && leftLines.every(line => rightKeys.has(transcriptLineKey(line)))) {
    return right
  }

  const merged = [...leftLines]
  for (const line of rightLines) {
    const key = transcriptLineKey(line)
    if (!leftKeys.has(key)) {
      merged.push(line)
      leftKeys.add(key)
    }
  }
  return merged.join('\n')
}

function textSegmentsTranscript(): string {
  return segments.value
    .filter(s => s.segment_type === 'text' && s.content?.trim())
    .map(s => s.speaker ? `${s.speaker}：${s.content.trim()}` : s.content.trim())
    .join('\n')
}

function currentSavedTranscript(): string {
  const formText = cleanTranscriptText(editForm.stt_text || editForm.minutes)
  return mergeTranscriptText(formText, textSegmentsTranscript())
}

function parseTranscriptLine(line: string): { line: string; speaker: string; text: string; key: string } | null {
  const cleaned = cleanTranscriptText(line)
  if (!cleaned) return null
  const match = cleaned.match(/^(.{1,24}?)[：:]\s*(.+)$/)
  const speaker = match ? cleanTranscriptText(match[1]) : ''
  const text = match ? cleanTranscriptText(match[2]) : cleaned
  if (!text) return null
  const formatted = speaker ? `${speaker}：${text}` : text
  return {line: formatted, speaker, text, key: transcriptLineKey(formatted)}
}

function parseTranscriptText(text?: string): Array<{ line: string; speaker: string; text: string; key: string }> {
  return cleanTranscriptText(text)
    .split('\n')
    .map(parseTranscriptLine)
    .filter((item): item is { line: string; speaker: string; text: string; key: string } => !!item)
}

function appendRealtimeTranscriptLine(
  item: {line?: string; speaker?: string; text?: string; start_time?: number; end_time?: number},
  options: {skipExisting?: boolean} = {}
): RealtimeTranscriptLine | null {
  let parsed = item.line
    ? parseTranscriptLine(item.line)
    : parseTranscriptLine(item.speaker ? `${item.speaker}：${item.text || ''}` : item.text || '')
  if (!parsed) return null

  const now = Date.now()
  const last = realtimeTranscriptLines.value[realtimeTranscriptLines.value.length - 1]
  if (last?.key === parsed.key && now - last.received_at < 1500) return null
  if (options.skipExisting && realtimeTranscriptLines.value.some(line => line.key === parsed.key)) return null

  if (last && last.speaker === parsed.speaker) {
    const suffix = getIncrementalText(last.text, parsed.text)
    if (suffix) {
      parsed = {
        speaker: parsed.speaker,
        text: suffix,
        line: parsed.speaker ? `${parsed.speaker}：${suffix}` : suffix,
        key: transcriptLineKey(parsed.speaker ? `${parsed.speaker}：${suffix}` : suffix)
      }
    }
  }

  const appended: RealtimeTranscriptLine = {
    ...parsed,
    start_time: item.start_time,
    end_time: item.end_time,
    received_at: now
  }
  realtimeTranscriptLines.value.push(appended)
  realtimeFinalText.value = realtimeTranscriptLines.value.map(item => item.line).join('\n')
  console.log(`[前端STT] 追加final行: "${parsed.line}", final_count=${realtimeTranscriptLines.value.length}`)
  return appended
}

function appendRealtimeTranscriptText(text?: string, options: {skipExisting?: boolean} = {}): number {
  let count = 0
  for (const item of parseTranscriptText(text)) {
    if (appendRealtimeTranscriptLine(item, options)) count++
  }
  return count
}

function hasTranscriptOverlap(previous: string, incoming: string): boolean {
  const prev = parseTranscriptText(previous)
  const next = parseTranscriptText(incoming)
  if (!prev.length || !next.length) return false
  const prevLast = prev[prev.length - 1]
  return next.some(item =>
    item.key === prevLast.key ||
    !!getIncrementalText(prevLast.text, item.text) ||
    !!getIncrementalText(item.text, prevLast.text)
  )
}

function promoteRealtimePartial(reason: string): RealtimeTranscriptLine[] {
  const partial = cleanTranscriptText(realtimePartialText.value)
  if (!partial) return []
  const before = realtimeTranscriptLines.value.length
  appendRealtimeTranscriptText(pendingRealtimePartialText(partial))
  const appended = realtimeTranscriptLines.value.slice(before)
  if (appended.length) {
    realtimeLastAppendedLines.value = appended
    console.log(`[前端STT] 固化partial(${reason}): "${partial.slice(0, 80)}"`)
  }
  realtimePartialText.value = ''
  return appended
}

function realtimeTranscriptText(): string {
  return realtimeFinalText.value
}

function formatRealtimeEventUtterances(utterances: any[]): string {
  return utterances
    .map(utt => {
      const text = cleanTranscriptText(utt?.text)
      if (!text) return ''
      const speaker = cleanTranscriptText(utt?.speaker)
      return speaker ? `${speaker}：${text}` : text
    })
    .filter(Boolean)
    .join('\n')
}

function rememberRealtimeFinalEvent(event: any): number {
  realtimeLastAppendedLines.value = []
  const deltaUtterances = Array.isArray(event?.delta_utterances) ? event.delta_utterances : []
  const deltaText = cleanTranscriptText(event?.delta_text)
  if (deltaUtterances.length) {
    let count = 0
    for (const utt of deltaUtterances) {
      const appended = appendRealtimeTranscriptLine({
        speaker: cleanTranscriptText(utt?.speaker),
        text: cleanTranscriptText(utt?.text),
        start_time: utt?.start_time,
        end_time: utt?.end_time
      })
      if (appended) {
        realtimeLastAppendedLines.value.push(appended)
        count++
      }
    }
    return count
  }

  if (deltaText) {
    const before = realtimeTranscriptLines.value.length
    const count = appendRealtimeTranscriptText(deltaText)
    realtimeLastAppendedLines.value = realtimeTranscriptLines.value.slice(before)
    return count
  }

  const currentText = cleanTranscriptText(event?.text)
  if (currentText) {
    const lines = parseTranscriptText(currentText)
    const before = realtimeTranscriptLines.value.length
    const count = appendRealtimeTranscriptText(currentText, {skipExisting: lines.length > 1})
    realtimeLastAppendedLines.value = realtimeTranscriptLines.value.slice(before)
    return count
  }

  const before = realtimeTranscriptLines.value.length
  const count = appendRealtimeTranscriptText(event?.full_text, {skipExisting: true})
  realtimeLastAppendedLines.value = realtimeTranscriptLines.value.slice(before)
  return count
}

function composeRealtimeTranscript(includePartial = true): string {
  let text = mergeTranscriptText(realtimeBaseText.value, realtimeFinalText.value)
  if (includePartial) {
    text = mergeTranscriptText(text, realtimePartialText.value)
  }
  return text || currentSavedTranscript()
}

function pendingRealtimePartialText(text: string): string {
  const partial = cleanTranscriptText(text)
  const known = mergeTranscriptText(realtimeBaseText.value, realtimeTranscriptText())
  if (!partial || !known) return partial
  if (partial.startsWith(known)) {
    return cleanTranscriptText(partial.slice(known.length).replace(/^\n+/, ''))
  }

  const knownKeys = new Set(known.split('\n').map(transcriptLineKey))
  return partial
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !knownKeys.has(transcriptLineKey(line)))
    .join('\n')
}

function syncRealtimeTranscriptToForm(status: 'pending' | 'done' = 'pending'): void {
  const text = composeRealtimeTranscript(false)
  if (!text) return
  editForm.stt_text = text
  editForm.minutes = text
  editForm.stt_status = status
}

const liveTranscript = computed(() => {
  return composeRealtimeTranscript(true)
})
const realtimeStatusLabel = computed(() => {
  return ({
    idle: '未连接',
    connecting: '连接中',
    ready: '实时转写中',
    closed: '已结束',
    error: '转写异常',
    recording_only: '仅录音'
  } as Record<string, string>)[realtimeSttStatus.value] || '未连接'
})

// AI
const aiSummary = ref<AiSummary | null>(null)
const summarizing = ref(false)
const aiQuestion = ref('')
const aiChatHistory = ref<Array<{role: string; content: string}>>([])
const aiChatLoading = ref(false)

// 工具函数
function statusLabel(s: string): string {
  return ({pending: '未开始', ongoing: '进行中', completed: '已结束'} as any)[s] || s
}

function fmtTime(t: string): string {
  if (!t) return ''
  const d = new Date(t)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = (target.getTime() - today.getTime()) / 86400000
  const time = d.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})
  if (diff === 0) return `今天 ${time}`
  if (diff === 1) return `明天 ${time}`
  if (diff === -1) return `昨天 ${time}`
  return d.toLocaleDateString('zh-CN', {month: 'short', day: 'numeric'}) + ' ' + time
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function parseParticipants(p: string): string[] {
  try { return JSON.parse(p || '[]') } catch { return [] }
}

function parseAttachments(a: string): MeetingAttachment[] {
  try { return JSON.parse(a || '[]') } catch { return [] }
}

function cycleStatus() {
  const order = ['pending', 'ongoing', 'completed']
  const i = order.indexOf(editForm.status)
  editForm.status = order[(i + 1) % order.length]
}

function addParticipant() {
  const name = newParticipant.value.trim()
  if (name && !editForm.participants.includes(name)) {
    editForm.participants.push(name)
  }
  newParticipant.value = ''
}

// 筛选
function handleFilterChange() {
  const f: any = {}
  if (statusFilter.value !== 'all') f.status = statusFilter.value
  meetingsStore.fetchMeetings(f)
}

// ========== 详情页录音入口 ==========
async function startRecording() {
  if (isSimpleMode.value) {
    await startPlainRecording('detail')
  } else {
    await startRealtimeRecording('detail')
  }
}

// ========== 快速录音 ==========
async function startQuickRecord() {
  if (isSimpleMode.value) {
    await startPlainRecording('quick')
  } else {
    await startRealtimeRecording('quick')
  }
}

function stopQuickRecord() {
  stopCurrentRecording()
}

function recorderMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || 'audio/webm'
}

function floatTo16BitPcm(input: Float32Array): ArrayBuffer {
  const output = new ArrayBuffer(input.length * 2)
  const view = new DataView(output)
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i]))
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
  return output
}

function downsampleBuffer(input: Float32Array, inputSampleRate: number, targetSampleRate: number): Float32Array {
  if (inputSampleRate === targetSampleRate) return input
  const ratio = inputSampleRate / targetSampleRate
  const outputLength = Math.round(input.length / ratio)
  const output = new Float32Array(outputLength)
  let inputOffset = 0
  for (let i = 0; i < outputLength; i++) {
    const nextOffset = Math.round((i + 1) * ratio)
    let sum = 0
    let count = 0
    for (let j = inputOffset; j < nextOffset && j < input.length; j++) {
      sum += input[j]
      count++
    }
    output[i] = count ? sum / count : 0
    inputOffset = nextOffset
  }
  return output
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

function resetRealtimeTranscript() {
  realtimeSttSessionId.value = ''
  realtimeSttStatus.value = 'idle'
  realtimePartialText.value = ''
  realtimeBaseText.value = ''
  realtimeFinalText.value = ''
  realtimeTranscriptLines.value = []
  realtimeLastAppendedLines.value = []
  realtimeError.value = ''
}

async function startRealtimePipeline(stream: MediaStream): Promise<boolean> {
  realtimeSttStatus.value = 'connecting'
  realtimeError.value = ''
  realtimePartialText.value = ''

  const available = await window.electronAPI.meetings.realtimeSttAvailable()
  if (!available) {
    realtimeSttStatus.value = 'recording_only'
    return false
  }

  try {
    const session = await window.electronAPI.meetings.startRealtimeStt()
    realtimeSttSessionId.value = session.sessionId

    const context = new AudioContext()
    const source = context.createMediaStreamSource(stream)
    const processor = context.createScriptProcessor(4096, 1, 1)
    const gain = context.createGain()
    gain.gain.value = 0

    processor.onaudioprocess = (event) => {
      if (!realtimeSttSessionId.value) return
      const input = event.inputBuffer.getChannelData(0)
      const downsampled = downsampleBuffer(input, context.sampleRate, 16000)
      const pcm = floatTo16BitPcm(downsampled)
      window.electronAPI.meetings.sendRealtimeSttChunk(realtimeSttSessionId.value, arrayBufferToBase64(pcm))
    }

    source.connect(processor)
    processor.connect(gain)
    gain.connect(context.destination)

    audioContext.value = context
    audioSource.value = source
    audioProcessor.value = processor
    audioGain.value = gain
    return true
  } catch (e: any) {
    realtimeSttStatus.value = 'recording_only'
    realtimeError.value = e?.message ? `实时转写不可用，已继续录音：${e.message}` : ''
    return false
  }
}

async function stopRealtimePipeline() {
  const promotedPartial = promoteRealtimePartial('stop')
  if (promotedPartial.length) {
    const elapsed = recordingStartTime.value ? (Date.now() - recordingStartTime.value) / 1000 : 0
    await saveRealtimeLinesAsSegments(promotedPartial, elapsed)
  }
  realtimePartialText.value = ''

  audioProcessor.value?.disconnect()
  audioSource.value?.disconnect()
  audioGain.value?.disconnect()
  if (audioContext.value && audioContext.value.state !== 'closed') {
    await audioContext.value.close().catch(() => {})
  }
  audioContext.value = null
  audioSource.value = null
  audioProcessor.value = null
  audioGain.value = null

  if (realtimeSttSessionId.value) {
    try {
      const result = await window.electronAPI.meetings.stopRealtimeStt(realtimeSttSessionId.value)
      appendRealtimeTranscriptText(result?.full_text, {skipExisting: true})
    } catch {}
  }
  syncRealtimeTranscriptToForm('done')
  realtimeSttSessionId.value = ''
}

async function saveRealtimeLinesAsSegments(lines: RealtimeTranscriptLine[], elapsed: number) {
  if (!lines.length) return
  const existingTexts = new Set(
    segments.value.filter(s => s.segment_type === 'text').map(s => s.content?.trim()).filter(Boolean)
  )
  for (const line of lines) {
    const text = line.text?.trim()
    if (!text || existingTexts.has(text)) continue
    const speaker = line.speaker || ''
    const startTime = line.start_time ?? Math.max(0, elapsed - 5)
    const endTime = line.end_time ?? elapsed
    if (editForm.id) {
      try {
        const saved = await window.electronAPI.meetings.segments.add({
          meeting_id: editForm.id,
          segment_type: 'text',
          content: text,
          speaker,
          sort_order: segments.value.length,
          start_time: startTime,
          end_time: endTime
        })
        segments.value.push(saved)
      } catch (e) {
        console.error('保存分段失败:', e)
        segments.value.push({
          id: -(Date.now()),
          meeting_id: editForm.id,
          segment_type: 'text',
          content: text,
          speaker,
          sort_order: segments.value.length,
          start_time: startTime,
          end_time: endTime,
          created_at: getLocalDateTimeStr()
        })
      }
    } else {
      segments.value.push({
        id: -(Date.now()),
        meeting_id: 0,
        segment_type: 'text',
        content: text,
        speaker,
        sort_order: segments.value.length,
        start_time: startTime,
        end_time: endTime,
        created_at: getLocalDateTimeStr()
      })
    }
    existingTexts.add(text)
  }
}

async function handleRealtimeSttEvent(event: any) {
  if (!event) return
  if (event.sessionId !== realtimeSttSessionId.value) {
    console.log(`[前端STT] 忽略旧会话事件: event.sessionId=${event.sessionId}, current=${realtimeSttSessionId.value}, type=${event.type}`)
    return
  }
  if (event.type === 'ready') {
    realtimeSttStatus.value = 'ready'
    editForm.stt_status = 'pending'
    return
  }
  if (event.type === 'partial') {
    const partialText = cleanTranscriptText(event.text || '')
    const nextPartial = partialText || cleanTranscriptText(event.full_text || '')
    if (realtimePartialText.value && nextPartial && !hasTranscriptOverlap(realtimePartialText.value, nextPartial)) {
      const promoted = promoteRealtimePartial('partial-switch')
      const now = Date.now()
      const elapsed = recordingStartTime.value ? (now - recordingStartTime.value) / 1000 : 0
      await saveRealtimeLinesAsSegments(promoted, elapsed)
    }
    realtimePartialText.value = pendingRealtimePartialText(nextPartial)
    return
  }
  if (event.type === 'final') {
    let promotedBeforeFinal: RealtimeTranscriptLine[] = []
    if (realtimePartialText.value) {
      const incomingFinalText = cleanTranscriptText(event.delta_text || event.text || event.full_text || '')
      if (incomingFinalText && !hasTranscriptOverlap(realtimePartialText.value, incomingFinalText)) {
        promotedBeforeFinal = promoteRealtimePartial('final-switch')
      }
    }
    const appendedCount = rememberRealtimeFinalEvent(event)
    realtimePartialText.value = ''
    const now = Date.now()
    const elapsed = recordingStartTime.value ? (now - recordingStartTime.value) / 1000 : 0
    console.log(`[前端STT] final事件: appended=${appendedCount}, final_text="${realtimeFinalText.value.slice(0, 100)}", delta_utterances=${event.delta_utterances?.length}, delta_text="${event.delta_text?.slice(0, 50)}", segments当前=${segments.value.length}`)

    // 使用实际追加到实时日志的新行保存分段，避免服务端把同一句改写变长时重复保存整句
    await saveRealtimeLinesAsSegments([...promotedBeforeFinal, ...realtimeLastAppendedLines.value], elapsed)
    // 从分段和实时会话缓存重建完整文本
    const allText = mergeTranscriptText(textSegmentsTranscript(), composeRealtimeTranscript(false))
    console.log(`[前端STT] 保存后: segments总数=${segments.value.length}, 文本段=${segments.value.filter(s => s.segment_type === 'text').length}, allText="${allText.slice(0, 80)}"`)
    editForm.stt_text = allText
    editForm.minutes = allText
    editForm.stt_status = 'pending'
    return
  }
  if (event.type === 'closed') {
    appendRealtimeTranscriptText(event.full_text, {skipExisting: true})
    const promotedPartial = promoteRealtimePartial('closed')
    if (promotedPartial.length) {
      const elapsed = recordingStartTime.value ? (Date.now() - recordingStartTime.value) / 1000 : 0
      await saveRealtimeLinesAsSegments(promotedPartial, elapsed)
    }
    realtimePartialText.value = ''

    // 如果仍在录音且不是正在停止，自动重连继续转写（保留已有分段）
    if (isAnyRecording.value && !isStoppingRecording.value && audioContext.value && audioSource.value) {
      console.log('[前端STT] WS断开但仍在录音，自动重连...')
      realtimeSttStatus.value = 'connecting'
      try {
        // 先停止旧会话（清理后端资源）
        if (realtimeSttSessionId.value) {
          try { await window.electronAPI.meetings.stopRealtimeStt(realtimeSttSessionId.value) } catch {}
        }
        const session = await window.electronAPI.meetings.startRealtimeStt()
        realtimeSttSessionId.value = session.sessionId
        realtimeSttStatus.value = 'ready'
        console.log('[前端STT] 重连成功, 新sessionId=' + session.sessionId)
      } catch (e) {
        console.error('[前端STT] 重连失败:', e)
        realtimeSttStatus.value = 'recording_only'
        realtimeSttSessionId.value = ''
      }
    } else {
      // 录音已结束或正在停止，正常关闭
      realtimeSttStatus.value = 'closed'
      // 从分段和实时会话缓存重建完整文本
      const allText = mergeTranscriptText(textSegmentsTranscript(), composeRealtimeTranscript(false))
      if (allText) {
        editForm.stt_text = allText
        editForm.minutes = allText
        editForm.stt_status = 'done'
      }
    }
    return
  }
  if (event.type === 'error') {
    console.error('[前端STT] 错误:', event.message)
    // 如果仍在录音且不是正在停止，尝试重连
    if (isAnyRecording.value && !isStoppingRecording.value && audioContext.value) {
      console.log('[前端STT] 错误但仍在录音，3秒后重连...')
      realtimeSttStatus.value = 'connecting'
      realtimeError.value = event.message || '实时转写连接异常'
      setTimeout(async () => {
        if (!isAnyRecording.value || isStoppingRecording.value) return
        try {
          // 先停止旧会话
          if (realtimeSttSessionId.value) {
            try { await window.electronAPI.meetings.stopRealtimeStt(realtimeSttSessionId.value) } catch {}
          }
          const session = await window.electronAPI.meetings.startRealtimeStt()
          realtimeSttSessionId.value = session.sessionId
          realtimeSttStatus.value = 'ready'
          realtimeError.value = ''
          console.log('[前端STT] 错误后重连成功')
        } catch (e) {
          console.error('[前端STT] 错误后重连失败:', e)
          realtimeSttStatus.value = 'recording_only'
        }
      }, 3000)
    } else {
      realtimeSttStatus.value = 'error'
      realtimeError.value = event.message || '实时转写连接异常'
      editForm.stt_status = 'error'
    }
  }
}

async function startRealtimeRecording(target: 'quick' | 'meeting' | 'segment') {
  if (isAnyRecording.value) return
  let stream: MediaStream | null = null
  try {
    realtimeBaseText.value = target === 'quick' ? '' : currentSavedTranscript()
    realtimeFinalText.value = ''
    realtimeTranscriptLines.value = []
    realtimeLastAppendedLines.value = []
    realtimePartialText.value = ''
    stream = await navigator.mediaDevices.getUserMedia({audio: true})
    await startRealtimePipeline(stream)
    recordingTarget.value = target
    recordingStartTime.value = Date.now() // 记录音开始时间
    mediaRecorder.value = new MediaRecorder(stream, {mimeType: recorderMimeType()})
    recordingChunks.value = []

    mediaRecorder.value.ondataavailable = (e) => {
      if (e.data.size > 0) recordingChunks.value.push(e.data)
    }

    mediaRecorder.value.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(recordingChunks.value, {type: 'audio/webm'})
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })

      try {
        const path = await window.electronAPI.meetings.saveRecording(dataUrl, editForm.id || undefined)
        if (path) {
          recordingUrl.value = dataUrl
          const transcript = composeRealtimeTranscript(false)
          if (target === 'segment') {
            await appendAudioSegment(path, dataUrl)
            ElMessage.success(transcript ? '录音和转写已插入' : '录音已插入')
          } else if (target === 'quick') {
            pendingRecordingPath.value = path
            openCreateWithRecording(path, dataUrl)
            ElMessage.success('录音完成，请创建会议')
          } else {
            editForm.recording_path = path
            editForm.has_recording = 1
            if (editForm.id && transcript) {
              await window.electronAPI.meetings.update(editForm.id, {
                stt_text: transcript,
                stt_status: 'done',
                minutes: transcript
              })
              await handleFilterChange()
            }
            ElMessage.success(transcript ? '录音和实时转写已保存' : '录音已保存')
          }
        }
      } catch (e: any) {
        ElMessage.error('录音保存失败: ' + e.message)
      }
    }

    mediaRecorder.value.start(1000)
    isRecording.value = target !== 'segment'
    isSegmentRecording.value = target === 'segment'
    recordingDuration.value = 0
    recordingTimer.value = setInterval(() => { recordingDuration.value++ }, 1000)
  } catch (e: any) {
    stream?.getTracks().forEach(track => track.stop())
    await stopRealtimePipeline()
    ElMessage.error(e?.message || '无法访问麦克风，请检查权限')
  }
}

// ========== 普通模式录音（无 STT） ==========

// 将 AudioBuffer 编码为 WAV Blob
function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const length = audioBuffer.length
  const bytesPerSample = 2
  const dataLength = length * numChannels * bytesPerSample
  const headerLength = 44
  const totalLength = headerLength + dataLength
  const arrayBuffer = new ArrayBuffer(totalLength)
  const view = new DataView(arrayBuffer)

  // WAV header
  const writeString = (offset: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)) }
  writeString(0, 'RIFF')
  view.setUint32(4, totalLength - 8, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true)
  view.setUint16(32, numChannels * bytesPerSample, true)
  view.setUint16(34, bytesPerSample * 8, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)

  // 交错写入 PCM 数据
  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
      offset += 2
    }
  }
  return new Blob([arrayBuffer], {type: 'audio/wav'})
}

// 合并两个音频 Blob 为一个 WAV（解码→拼接→编码）
async function mergeAudioBlobs(existing: Blob, appended: Blob): Promise<Blob> {
  const ctx = new AudioContext()
  try {
    const [buf1, buf2] = await Promise.all([
      ctx.decodeAudioData(await existing.arrayBuffer()),
      ctx.decodeAudioData(await appended.arrayBuffer())
    ])
    const sampleRate = buf1.sampleRate
    const channels = Math.max(buf1.numberOfChannels, buf2.numberOfChannels)
    const totalLength = buf1.length + buf2.length
    const merged = ctx.createBuffer(channels, totalLength, sampleRate)
    for (let ch = 0; ch < channels; ch++) {
      const data = merged.getChannelData(ch)
      data.set(buf1.getChannelData(Math.min(ch, buf1.numberOfChannels - 1)), 0)
      data.set(buf2.getChannelData(Math.min(ch, buf2.numberOfChannels - 1)), buf1.length)
    }
    return audioBufferToWav(merged)
  } finally {
    await ctx.close().catch(() => {})
  }
}

async function startPlainRecording(target: 'quick' | 'detail' | 'segment') {
  if (isAnyRecording.value) return
  let stream: MediaStream | null = null
  try {
    stream = await navigator.mediaDevices.getUserMedia({audio: true})
    recordingTarget.value = target
    mediaRecorder.value = new MediaRecorder(stream, {mimeType: recorderMimeType()})
    recordingChunks.value = []

    // 普通模式继续录音：先加载已有录音数据用于合并
    existingRecordingChunks.value = []
    if (isSimpleMode.value && target === 'detail' && editForm.has_recording && editForm.recording_path) {
      try {
        const urls = await window.electronAPI.meetings.resolveFiles([editForm.recording_path])
        if (urls?.[0]) {
          const resp = await fetch(urls[0])
          const existingBlob = await resp.blob()
          existingRecordingChunks.value = [existingBlob]
        }
      } catch { /* ignore */ }
    }

    mediaRecorder.value.ondataavailable = (e) => {
      if (e.data.size > 0) recordingChunks.value.push(e.data)
    }

    mediaRecorder.value.onstop = async () => {
      stream!.getTracks().forEach(t => t.stop())
      const newBlob = new Blob(recordingChunks.value, {type: 'audio/webm'})

      // 普通模式继续录音：合并已有录音 + 新录音
      let finalBlob: Blob
      if (existingRecordingChunks.value.length > 0) {
        try {
          finalBlob = await mergeAudioBlobs(existingRecordingChunks.value[0], newBlob)
        } catch {
          // 合并失败则只保留新录音
          finalBlob = newBlob
        }
        existingRecordingChunks.value = []
      } else {
        finalBlob = newBlob
      }

      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(finalBlob)
      })

      try {
        const path = await window.electronAPI.meetings.saveRecording(dataUrl, editForm.id || undefined)
        if (path) {
          recordingUrl.value = dataUrl
          if (target === 'segment') {
            await appendAudioSegment(path, dataUrl)
            ElMessage.success('录音已插入')
          } else if (target === 'quick') {
            pendingRecordingPath.value = path
            openCreateWithRecording(path, dataUrl)
            ElMessage.success('录音完成，请创建会议')
          } else {
            editForm.recording_path = path
            editForm.has_recording = 1
            ElMessage.success('录音已保存')
          }
        }
      } catch (e: any) {
        ElMessage.error('录音保存失败: ' + e.message)
      }
    }

    mediaRecorder.value.start(1000)
    isRecording.value = target !== 'segment'
    isSegmentRecording.value = target === 'segment'
    recordingDuration.value = 0
    recordingTimer.value = setInterval(() => { recordingDuration.value++ }, 1000)
    realtimeSttStatus.value = 'recording_only'
  } catch (e: any) {
    stream?.getTracks().forEach(track => track.stop())
    ElMessage.error(e?.message || '无法访问麦克风，请检查权限')
  }
}

async function stopCurrentRecording() {
  isStoppingRecording.value = true
  if (!isSimpleMode.value) {
    await stopRealtimePipeline()
  }
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    mediaRecorder.value.stop()
  }
  isRecording.value = false
  isSegmentRecording.value = false
  if (recordingTimer.value) {
    clearInterval(recordingTimer.value)
    recordingTimer.value = null
  }
  realtimeSttStatus.value = 'idle'
  isStoppingRecording.value = false
}

function openCreateWithRecording(recordingPath: string, dataUrl: string) {
  editingMeeting.value = null
  const transcript = composeRealtimeTranscript(false)
  Object.assign(editForm, {
    id: 0, title: '', description: '', meeting_type: 'regular', status: 'ongoing',
    start_time: new Date().toLocaleString('sv-SE', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(',', ''),
    end_time: '', location: '', participants: [], minutes: transcript,
    attachments: [], recording_path: recordingPath, has_recording: 1, todo_ids: [],
    stt_text: transcript, stt_status: transcript ? 'done' : 'none'
  })
  recordingUrl.value = dataUrl
  aiSummary.value = null
  aiChatHistory.value = []
  // 保留已有分段（实时转写期间已累积的文本分段）
  segAudioUrls.value = {}
  showMoreOptions.value = false
  detailVisible.value = true
}

// ========== 分段录音 ==========
async function startSegmentRecord() {
  if (isSimpleMode.value) {
    await startPlainRecording('segment')
  } else {
    await startRealtimeRecording('segment')
  }
}

function stopSegmentRecord() {
  stopCurrentRecording()
}

// ========== 分段管理 ==========
async function appendAudioSegment(path: string, dataUrl: string) {
  const elapsed = recordingStartTime.value ? (Date.now() - recordingStartTime.value) / 1000 : 0
  if (editForm.id) {
    const seg = await window.electronAPI.meetings.segments.add({
      meeting_id: editForm.id,
      segment_type: 'audio',
      content: path,
      speaker: '',
      sort_order: segments.value.length,
      start_time: 0,
      end_time: elapsed
    })
    segments.value.push(seg)
  } else {
    segments.value.push({
      id: -(Date.now()),
      meeting_id: 0,
      segment_type: 'audio',
      content: path,
      speaker: '',
      sort_order: segments.value.length,
      start_time: 0,
      end_time: elapsed,
      created_at: getLocalDateTimeStr()
    })
  }
  segAudioUrls.value[path] = dataUrl
  // 文本分段已由 handleRealtimeSttEvent 逐句保存，无需再重复添加
  const transcript = composeRealtimeTranscript(false)
  if (transcript) {
    editForm.stt_text = transcript
    editForm.minutes = transcript
    editForm.stt_status = 'done'
  }
}

function addTextSegment() {
  segments.value.push({
    id: -(Date.now()),
    meeting_id: editForm.id || 0,
    segment_type: 'text',
    content: '',
    speaker: '',
    sort_order: segments.value.length,
    start_time: 0,
    end_time: 0,
    created_at: getLocalDateTimeStr()
  })
}

async function addAudioSegment() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'audio/*'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) {
      ElMessage.warning('文件超过 50MB 限制')
      return
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    const results = await window.electronAPI.meetings.uploadFiles([{name: file.name, data: dataUrl, type: file.type}])
    if (results?.[0]) {
      const path = results[0].path
      if (editForm.id) {
        const seg = await window.electronAPI.meetings.segments.add({
          meeting_id: editForm.id,
          segment_type: 'audio',
          content: path,
          speaker: '',
          sort_order: segments.value.length
        })
        segments.value.push(seg)
      } else {
        segments.value.push({
          id: -(Date.now()),
          meeting_id: 0,
          segment_type: 'audio',
          content: path,
          speaker: '',
          sort_order: segments.value.length,
          created_at: getLocalDateTimeStr()
        })
      }
      segAudioUrls.value[path] = dataUrl
    }
  }
  input.click()
}

function formatSegmentTime(seconds: number): string {
  if (!seconds || seconds <= 0) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`
}

async function updateSegment(seg: MeetingSegment) {
  if (seg.id > 0) {
    await window.electronAPI.meetings.segments.update(seg.id, {
      content: seg.content,
      speaker: seg.speaker
    })
  }
}

async function renameAllSpeaker(oldName: string) {
  const newName = prompt(`将所有"${oldName}"重命名为:`, oldName)
  if (!newName || newName === oldName) return
  for (const seg of segments.value) {
    if (seg.speaker === oldName) {
      seg.speaker = newName
      if (seg.id > 0) {
        await window.electronAPI.meetings.segments.update(seg.id, { speaker: newName })
      }
    }
  }
}

async function deleteSegment(seg: MeetingSegment, index: number) {
  segments.value.splice(index, 1)
  if (seg.id > 0) {
    await window.electronAPI.meetings.segments.delete(seg.id)
  }
}

function moveSegment(index: number, direction: number) {
  const target = index + direction
  if (target < 0 || target >= segments.value.length) return
  const temp = segments.value[index]
  segments.value[index] = segments.value[target]
  segments.value[target] = temp
  // Update sort_order on server
  if (editForm.id) {
    const orderedIds = segments.value.filter(s => s.id > 0).map(s => s.id)
    if (orderedIds.length) {
      window.electronAPI.meetings.segments.reorder(editForm.id, orderedIds)
    }
  }
}

// ========== STT ==========
async function doStt() {
  if (!editForm.id) return
  sttLoading.value = true
  try {
    const result = await window.electronAPI.meetings.stt(editForm.id, true)
    if (result) {
      editForm.stt_text = result.full_text
      editForm.minutes = result.full_text
      editForm.stt_status = 'done'
      await loadSegments(editForm.id)
      ElMessage.success('转写完成')
    }
  } catch (e: any) {
    editForm.stt_status = 'error'
    ElMessage.error('转写失败: ' + e.message)
  } finally {
    sttLoading.value = false
  }
}

// ========== 创建/编辑 ==========
function openCreate() {
  if (!isAnyRecording.value) resetRealtimeTranscript()
  editingMeeting.value = null
  Object.assign(editForm, {
    id: 0, title: '', description: '', meeting_type: 'regular', status: 'pending',
    start_time: new Date().toLocaleString('sv-SE', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(',', ''),
    end_time: '', location: '', participants: [], minutes: '',
    attachments: [], recording_path: '', has_recording: 0, todo_ids: [],
    stt_text: '', stt_status: 'none'
  })
  aiSummary.value = null
  aiChatHistory.value = []
  recordingUrl.value = ''
  segments.value = []
  segAudioUrls.value = {}
  showMoreOptions.value = false
  detailVisible.value = true
}

async function openDetail(meeting: Meeting) {
  if (!isAnyRecording.value) resetRealtimeTranscript()
  editingMeeting.value = meeting
  Object.assign(editForm, {
    id: meeting.id,
    title: meeting.title,
    description: meeting.description,
    meeting_type: meeting.meeting_type,
    status: meeting.status,
    start_time: meeting.start_time,
    end_time: meeting.end_time || '',
    location: meeting.location,
    participants: parseParticipants(meeting.participants),
    minutes: meeting.minutes,
    attachments: parseAttachments(meeting.attachments),
    recording_path: meeting.recording_path || '',
    has_recording: meeting.has_recording,
    todo_ids: [] as number[],
    stt_text: (meeting as any).stt_text || '',
    stt_status: (meeting as any).stt_status || 'none'
  })
  try { editForm.todo_ids = JSON.parse(meeting.todo_ids || '[]') } catch {}

  try {
    aiSummary.value = meeting.ai_summary ? (typeof meeting.ai_summary === 'string' ? JSON.parse(meeting.ai_summary) : meeting.ai_summary) : null
  } catch { aiSummary.value = null }

  aiChatHistory.value = []
  recordingUrl.value = ''
  showMoreOptions.value = !!(meeting.location || parseParticipants(meeting.participants).length || meeting.description || meeting.end_time)

  await loadSegments(meeting.id)

  if (meeting.recording_path) {
    try {
      const urls = await window.electronAPI.meetings.resolveFiles([meeting.recording_path])
      if (urls?.[0]) recordingUrl.value = urls[0]
    } catch {}
  }

  detailVisible.value = true
}

async function loadSegments(meetingId: number) {
  segments.value = await window.electronAPI.meetings.segments.list(meetingId)
  const audioSegs = segments.value.filter(s => s.segment_type === 'audio' && s.content)
  if (audioSegs.length) {
    const paths = audioSegs.map(s => s.content)
    try {
      const urls = await window.electronAPI.meetings.resolveFiles(paths)
      audioSegs.forEach((seg, i) => {
        if (urls?.[i]) segAudioUrls.value[seg.content] = urls[i]
      })
    } catch {}
  }
}

async function handleSave() {
  // 保存前从分段同步完整文本
  const transcriptText = mergeTranscriptText(currentSavedTranscript(), composeRealtimeTranscript(false))
  if (transcriptText) {
    editForm.stt_text = transcriptText
    editForm.minutes = transcriptText
  }
  if (!editForm.title.trim()) {
    ElMessage.warning('请输入会议标题')
    return
  }
  if (!editForm.start_time) {
    ElMessage.warning('请选择会议时间')
    return
  }

  const data = {
    title: editForm.title.trim(),
    description: editForm.description,
    meeting_type: editForm.meeting_type,
    status: editForm.status,
    start_time: editForm.start_time,
    end_time: editForm.end_time || null,
    location: editForm.location,
    participants: editForm.participants,
    minutes: editForm.minutes,
    attachments: editForm.attachments,
    recording_path: editForm.recording_path || null,
    has_recording: editForm.has_recording,
    todo_ids: editForm.todo_ids,
    stt_text: editForm.stt_text || null,
    stt_status: editForm.stt_status
  }

  let meetingId: number
  if (editingMeeting.value) {
    await meetingsStore.updateMeeting(editingMeeting.value.id, data)
    meetingId = editingMeeting.value.id
  } else {
    const result = await meetingsStore.createMeeting(data)
    meetingId = result.id
  }

  // 保存未持久化的分段
  const pendingSegs = segments.value.filter(s => s.id < 0)
  if (pendingSegs.length) {
    await window.electronAPI.meetings.segments.addBatch(
      pendingSegs.map((s, i) => ({
        meeting_id: meetingId,
        segment_type: s.segment_type,
        content: s.content,
        speaker: s.speaker,
        sort_order: segments.value.indexOf(s),
        start_time: s.start_time || 0,
        end_time: s.end_time || 0
      }))
    )
  }

  detailVisible.value = false
}

function handleDelete(meeting: Meeting) {
  ElMessageBox.confirm('确认要删除该会议吗？', '删除会议', {
    confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning'
  }).then(() => { meetingsStore.deleteMeeting(meeting.id) }).catch(() => {})
}

// 文件上传
function triggerUpload() {
  fileInputRef.value?.click()
}

async function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  await uploadFiles(Array.from(input.files))
  input.value = ''
}

async function handleDrop(e: DragEvent) {
  const files = e.dataTransfer?.files
  if (!files?.length) return
  await uploadFiles(Array.from(files))
}

async function uploadFiles(files: File[]) {
  const uploadData: Array<{ name: string; data: string; type: string }> = []
  for (const file of files) {
    if (file.size > 50 * 1024 * 1024) {
      ElMessage.warning(`${file.name} 超过 50MB 限制`)
      continue
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    uploadData.push({name: file.name, data: dataUrl, type: file.type || 'application/octet-stream'})
  }
  if (!uploadData.length) return

  try {
    const results = await window.electronAPI.meetings.uploadFiles(uploadData)
    editForm.attachments.push(...results)
    ElMessage.success(`已上传 ${results.length} 个文件`)
  } catch (e: any) {
    ElMessage.error('上传失败: ' + e.message)
  }
}

// AI 摘要
async function generateSummary() {
  if (!editForm.id) return
  summarizing.value = true
  try {
    const result = await window.electronAPI.meetings.aiSummarize(editForm.id)
    if (result) {
      aiSummary.value = result
      ElMessage.success('摘要已生成')
    } else {
      ElMessage.warning('未能生成有效摘要，请确保会议记录内容充足')
    }
  } catch (e: any) {
    ElMessage.error('生成摘要失败: ' + e.message)
  } finally {
    summarizing.value = false
  }
}

// AI 问答
async function sendAiChat() {
  if (!editForm.id || !aiQuestion.value.trim()) return
  const question = aiQuestion.value.trim()
  aiQuestion.value = ''
  aiChatHistory.value.push({role: 'user', content: question})
  aiChatLoading.value = true
  try {
    const history = aiChatHistory.value.slice(0, -1)
    const answer = await window.electronAPI.meetings.aiChat(editForm.id, question, history)
    aiChatHistory.value.push({role: 'assistant', content: answer})
  } catch (e: any) {
    aiChatHistory.value.push({role: 'assistant', content: '回答失败: ' + e.message})
  } finally {
    aiChatLoading.value = false
  }
}

// 生命周期
onMounted(async () => {
  window.electronAPI.meetings.onRealtimeSttEvent(handleRealtimeSttEvent)
  await handleFilterChange()
  await meetingsStore.fetchStats()
})
onActivated(async () => {
  await handleFilterChange()
  await meetingsStore.fetchStats()
})

onBeforeUnmount(() => {
  window.electronAPI.meetings.removeRealtimeSttListener()
  if (isAnyRecording.value) stopCurrentRecording()
})

// 清理录音
watch(detailVisible, (v) => {
  if (!v) {
    if (isAnyRecording.value) stopCurrentRecording()
  }
})

watch(liveTranscript, async () => {
  await nextTick()
  for (const el of [recordingLiveRef.value, liveTranscriptRef.value]) {
    if (el) el.scrollTop = el.scrollHeight
  }
})
</script>

<style scoped>
.meetings-page { width: min(100%, 980px); margin: 0 auto; outline: none; }

.page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
.page-title { font-size: 22px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.page-subtitle { font-size: 13px; color: var(--text-tertiary); }
.header-actions { display: flex; gap: 8px; flex-shrink: 0; }

/* 录音浮窗 */
.recording-float {
  position: fixed; bottom: 24px; right: 24px; z-index: 9999;
  display: flex; flex-direction: column; gap: 8px;
  width: min(420px, calc(100vw - 48px));
  padding: 12px 14px; border-radius: 12px;
  background: var(--bg-primary); border: 1px solid rgba(245,108,108,.3);
  box-shadow: 0 4px 16px rgba(0,0,0,.12);
}
.recording-float-main { display: flex; align-items: center; gap: 10px; }
.recording-live {
  max-height: 72px;
  overflow: auto;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
}
.rec-dot { width: 8px; height: 8px; border-radius: 50%; background: #F56C6C; animation: pulse 1s infinite; }
.rec-dot-sm { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #F56C6C; animation: pulse 1s infinite; margin-right: 4px; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
.rec-time { font-size: 14px; font-weight: 600; color: #F56C6C; font-variant-numeric: tabular-nums; }
.rt-state { font-size: 11px; padding: 2px 7px; border-radius: 4px; background: var(--bg-tertiary); color: var(--text-tertiary); }
.rt-state.ready { color: #67C23A; background: rgba(103,194,58,.1); }
.rt-state.connecting { color: #E6A23C; background: rgba(230,162,60,.1); }
.rt-state.error { color: #F56C6C; background: rgba(245,108,108,.1); }
.rt-state.recording_only { color: #909399; background: rgba(144,147,153,.12); }

/* 筛选 */
.filters { margin-bottom: 16px; }
.tabs { display: flex; gap: 4px; }
.tab { font-size: 12px; padding: 4px 10px; border-radius: 4px; cursor: pointer; color: var(--text-tertiary); transition: all .15s; }
.tab:hover { color: var(--text-secondary); }
.tab.active { background: var(--bg-tertiary); color: var(--text-primary); font-weight: 500; }

/* 会议卡片 */
.meeting-card { padding: 12px 14px; border: 1px solid var(--border-color-light); border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: all .15s; position: relative; }
.meeting-card:hover { border-color: var(--color-primary); box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.card-top { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.card-status { font-size: 11px; padding: 1px 8px; border-radius: 4px; font-weight: 500; }
.card-status.pending { background: rgba(64,158,255,.1); color: #409EFF; }
.card-status.ongoing { background: rgba(103,194,58,.1); color: #67C23A; }
.card-status.completed { background: rgba(144,147,153,.1); color: #909399; }
.card-time { font-size: 11px; color: var(--text-tertiary); margin-left: auto; }
.card-title { font-size: 14px; font-weight: 500; color: var(--text-primary); margin-bottom: 4px; }
.card-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.meta-item { font-size: 11px; color: var(--text-tertiary); display: flex; align-items: center; gap: 3px; }
.meta-item.recording { color: #F56C6C; }
.meta-item.stt { color: #67C23A; }
.card-del { position: absolute; top: 8px; right: 8px; font-size: 14px; color: var(--text-placeholder); cursor: pointer; opacity: 0; transition: opacity .15s; }
.meeting-card:hover .card-del { opacity: .5; }
.card-del:hover { opacity: 1 !important; color: var(--color-danger); }

/* 详情弹窗 */
.detail-header { margin-bottom: 16px; }
.detail-title { width: 100%; border: none; outline: none; font-size: 16px; font-weight: 600; color: var(--text-primary); background: transparent; padding: 0; border-bottom: 1px solid var(--border-color-light); padding-bottom: 8px; font-family: inherit; }
.detail-title::placeholder { color: var(--text-placeholder); }
.detail-status-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }

/* 更多选项 */
.more-options { margin-bottom: 16px; }
.more-toggle { display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 12px; color: var(--text-tertiary); padding: 4px 0; }
.more-toggle:hover { color: var(--color-primary); }
.more-fields { display: flex; flex-direction: column; gap: 10px; padding-top: 8px; }
.field-row { display: flex; flex-direction: column; gap: 4px; }
.field-row label { font-size: 12px; color: var(--text-tertiary); }
.field-input { width: 100%; border: 1px solid var(--border-color-light); border-radius: 4px; padding: 4px 8px; font-size: 13px; color: var(--text-primary); background: transparent; outline: none; font-family: inherit; }
.field-input:focus { border-color: var(--color-primary); }
.field-textarea { width: 100%; border: 1px solid var(--border-color-light); border-radius: 4px; padding: 8px; font-size: 13px; color: var(--text-primary); background: transparent; outline: none; resize: vertical; font-family: inherit; line-height: 1.5; }
.field-textarea:focus { border-color: var(--color-primary); }
.type-chips { display: flex; gap: 4px; }
.chip { font-size: 11px; padding: 2px 8px; border-radius: 10px; cursor: pointer; border: 1px solid var(--border-color-light); color: var(--text-tertiary); transition: all .1s; user-select: none; }
.chip:hover { border-color: var(--color-primary); color: var(--text-secondary); }
.chip.active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }

/* 参会人 */
.participant-input { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; border: 1px solid var(--border-color-light); border-radius: 4px; padding: 4px 6px; min-height: 30px; }
.participant-input:focus-within { border-color: var(--color-primary); }
.p-tag { font-size: 12px; padding: 1px 6px; border-radius: 4px; background: var(--bg-tertiary); color: var(--text-primary); display: flex; align-items: center; gap: 4px; }
.p-tag span { cursor: pointer; color: var(--text-tertiary); font-size: 12px; }
.p-tag span:hover { color: var(--color-danger); }
.p-input { border: none; outline: none; font-size: 13px; color: var(--text-primary); background: transparent; flex: 1; min-width: 80px; font-family: inherit; }
.p-input::placeholder { color: var(--text-placeholder); }

/* section */
.detail-section { margin-bottom: 16px; }
.detail-section > label { font-size: 12px; color: var(--text-tertiary); display: block; margin-bottom: 6px; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.section-head label { font-size: 12px; color: var(--text-tertiary); margin-bottom: 0; }
.section-actions { display: flex; gap: 4px; }

/* 分段编辑器 */
.segments-list { display: flex; flex-direction: column; gap: 8px; }
.segment-item { border: 1px solid var(--border-color-light); border-radius: 6px; padding: 8px 10px; }
.segment-item.audio { border-left: 3px solid #409EFF; }
.segment-item.text { border-left: 3px solid #67C23A; }
.seg-header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.seg-time { flex: 0 0 72px; min-width: 72px; white-space: nowrap; font-size: 12px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
.seg-type-badge { font-size: 10px; padding: 1px 6px; border-radius: 3px; font-weight: 500; }
.seg-type-badge.audio { background: rgba(64,158,255,.1); color: #409EFF; }
.seg-type-badge.text { background: rgba(103,194,58,.1); color: #67C23A; }
.seg-speaker { flex: 0 0 80px; width: 80px; border: 1px solid var(--border-color-light); border-radius: 3px; padding: 1px 4px; font-size: 11px; color: var(--text-primary); background: transparent; outline: none; font-family: inherit; }
.seg-speaker:focus { border-color: var(--color-primary); }
.seg-rename-all { cursor: pointer; font-size: 12px; color: var(--text-placeholder); margin-left: 2px; }
.seg-rename-all:hover { color: var(--color-primary); }
.seg-actions { margin-left: auto; display: flex; align-items: center; gap: 4px; }
.seg-move { cursor: pointer; color: var(--text-placeholder); font-size: 12px; }
.seg-move:hover { color: var(--color-primary); }
.seg-del { cursor: pointer; color: var(--text-placeholder); font-size: 14px; }
.seg-del:hover { color: var(--color-danger); }
.seg-textarea { width: 100%; border: 1px solid var(--border-color-light); border-radius: 4px; padding: 6px 8px; font-size: 13px; color: var(--text-primary); background: transparent; outline: none; resize: vertical; font-family: inherit; line-height: 1.5; }
.seg-textarea:focus { border-color: var(--color-primary); }
.seg-audio { }
.seg-audio-path { font-size: 12px; color: var(--text-tertiary); }
.legacy-minutes { }
.detail-textarea { width: 100%; border: 1px solid var(--border-color-light); border-radius: 4px; padding: 8px; font-size: 13px; color: var(--text-primary); background: transparent; outline: none; resize: vertical; font-family: inherit; line-height: 1.5; }
.detail-textarea:focus { border-color: var(--color-primary); }

/* 录音 */
.recording-area { display: flex; align-items: center; gap: 10px; }
.recording-play { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-tertiary); }

/* STT */
.stt-area { }
.stt-status { font-size: 11px; padding: 1px 6px; border-radius: 3px; }
.stt-status.done { background: rgba(103,194,58,.1); color: #67C23A; }
.stt-status.pending { background: rgba(230,162,60,.1); color: #E6A23C; }
.stt-text { margin-top: 8px; padding: 8px; background: var(--bg-tertiary); border-radius: 4px; font-size: 13px; color: var(--text-primary); line-height: 1.5; white-space: pre-wrap; }
.stt-text.live { max-height: 140px; overflow: auto; border: 1px solid rgba(64,158,255,.18); background: var(--color-primary-bg); }
.stt-error { margin-top: 6px; color: var(--color-danger); font-size: 12px; }

/* 附件 */
.attachment-area { }
.upload-btn { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border: 1px dashed var(--border-color-light); border-radius: 6px; cursor: pointer; color: var(--text-tertiary); font-size: 12px; transition: all .15s; }
.upload-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.attachment-list { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
.att-item { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 4px; background: var(--bg-tertiary); font-size: 12px; color: var(--text-primary); }
.att-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.att-del { cursor: pointer; color: var(--text-tertiary); }
.att-del:hover { color: var(--color-danger); }

/* AI 摘要 */
.ai-area { }
.summary-content { margin-top: 10px; }
.summary-block { margin-bottom: 10px; }
.summary-label { font-size: 12px; font-weight: 600; color: var(--color-primary); display: block; margin-bottom: 4px; }
.summary-block p { font-size: 13px; color: var(--text-primary); line-height: 1.5; margin: 0; }
.summary-block ul { margin: 0; padding-left: 16px; }
.summary-block li { font-size: 13px; color: var(--text-primary); line-height: 1.6; }

/* AI 问答 */
.ai-chat-area { }
.ai-chat-list { max-height: 200px; overflow-y: auto; margin-bottom: 8px; }
.ai-msg { padding: 6px 10px; border-radius: 6px; margin-bottom: 4px; font-size: 13px; line-height: 1.5; }
.ai-msg.user { background: var(--color-primary-bg); color: var(--text-primary); }
.ai-msg.assistant { background: var(--bg-tertiary); color: var(--text-primary); }
.ai-msg-role { font-size: 11px; font-weight: 600; color: var(--text-tertiary); display: block; margin-bottom: 2px; }
.ai-msg-text { white-space: pre-wrap; word-break: break-word; }
.ai-chat-input { display: flex; gap: 6px; }
.ai-input { flex: 1; border: 1px solid var(--border-color-light); border-radius: 4px; padding: 4px 8px; font-size: 13px; color: var(--text-primary); background: transparent; outline: none; font-family: inherit; }
.ai-input:focus { border-color: var(--color-primary); }
.ai-input::placeholder { color: var(--text-placeholder); }

/* 空/加载 */
.state-wrap {
  display: flex;
  min-height: 420px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px 84px;
  color: var(--text-tertiary);
  font-size: 13px;
  text-align: center;
}

.loading-icon {
  margin-bottom: 10px;
  animation: rotate 1s linear infinite;
}

.empty strong {
  margin-top: 16px;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
}

.empty p {
  margin-top: 8px;
  color: var(--text-tertiary);
  line-height: 1.5;
}

.empty-illustration {
  position: relative;
  width: 112px;
  height: 100px;
}

.empty-mic {
  position: absolute;
  left: 50%;
  top: 12px;
  width: 24px;
  height: 38px;
  border: 2.5px solid rgba(64, 158, 255, .45);
  border-radius: 12px 12px 18px 18px;
  background: rgba(64, 158, 255, .06);
  transform: translateX(-50%);
}

.empty-mic::before {
  position: absolute;
  bottom: -10px;
  left: 50%;
  width: 14px;
  height: 10px;
  border: 2.5px solid rgba(64, 158, 255, .45);
  border-top: 0;
  border-radius: 0 0 7px 7px;
  transform: translateX(-50%);
  content: '';
}

.empty-mic::after {
  position: absolute;
  bottom: -18px;
  left: 50%;
  width: 2.5px;
  height: 8px;
  background: rgba(64, 158, 255, .45);
  transform: translateX(-50%);
  content: '';
}

.empty-bubble {
  position: absolute;
  right: 8px;
  bottom: 14px;
  width: 44px;
  height: 32px;
  border: 2px solid rgba(103, 194, 58, .35);
  border-radius: 8px;
  background: rgba(103, 194, 58, .06);
}

.empty-bubble::before {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 26px;
  height: 3px;
  border-radius: 999px;
  background: rgba(103, 194, 58, .35);
  box-shadow: 0 8px 0 rgba(103, 194, 58, .35);
  content: '';
}

.empty-bubble::after {
  position: absolute;
  bottom: -6px;
  left: 10px;
  width: 8px;
  height: 8px;
  border-bottom: 2px solid rgba(103, 194, 58, .35);
  border-left: 2px solid rgba(103, 194, 58, .35);
  border-radius: 0 0 0 4px;
  transform: rotate(-45deg);
  content: '';
}

@keyframes rotate {
  to {
    transform: rotate(360deg);
  }
}
</style>
