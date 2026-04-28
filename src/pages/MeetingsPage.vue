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
        <el-button size="small" round @click="startQuickRecord" :disabled="isRecording" class="rec-btn">
          <el-icon style="margin-right:4px"><Microphone/></el-icon>录音
        </el-button>
        <el-button type="primary" size="small" round @click="openCreate">
          <el-icon style="margin-right:4px"><Plus/></el-icon>新建会议
        </el-button>
      </div>
    </div>

    <!-- 录音浮窗 -->
    <div v-if="isRecording" class="recording-float">
      <span class="rec-dot"></span>
      <span class="rec-time">{{ formatDuration(recordingDuration) }}</span>
      <el-button type="danger" size="small" round @click="stopQuickRecord">停止</el-button>
    </div>

    <!-- 筛选 -->
    <div class="filters">
      <div class="tabs">
        <span v-for="f in statusFilters" :key="f.value" class="tab" :class="{active: statusFilter === f.value}" @click="statusFilter = f.value; handleFilterChange()">{{ f.label }}</span>
      </div>
    </div>

    <!-- 列表 -->
    <div v-if="meetingsStore.loading" class="loading">加载中...</div>

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
          <span v-if="(meeting as any).stt_status === 'done'" class="meta-item stt"><el-icon :size="12"><Document/></el-icon>已转写</span>
        </div>
        <span class="card-del" @click.stop="handleDelete(meeting)">&times;</span>
      </div>
    </template>

    <div v-else class="empty"><p>还没有会议，点击「新建会议」或「录音」开始</p></div>

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
            <el-button size="small" text @click="startSegmentRecord" v-if="!isSegmentRecording"><el-icon><Microphone/></el-icon>录音</el-button>
            <el-button size="small" text type="danger" @click="stopSegmentRecord" v-else><span class="rec-dot-sm"></span>停止</el-button>
          </div>
        </div>

        <!-- 分段列表 -->
        <div class="segments-list" v-if="segments.length">
          <div v-for="(seg, i) in segments" :key="seg.id || i" class="segment-item" :class="seg.segment_type">
            <div class="seg-header">
              <span class="seg-type-badge" :class="seg.segment_type">{{ seg.segment_type === 'audio' ? '语音' : '文本' }}</span>
              <input v-model="seg.speaker" class="seg-speaker" placeholder="说话人" @change="updateSegment(seg)"/>
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
          <template v-if="isRecording && !editForm.id">
            <span class="rec-dot"></span>
            <span class="rec-time">{{ formatDuration(recordingDuration) }}</span>
            <el-button type="danger" size="small" round @click="stopRecording">停止录音</el-button>
          </template>
          <template v-else>
            <el-button size="small" round @click="startRecording">
              <el-icon style="margin-right:4px"><Microphone/></el-icon>开始录音
            </el-button>
          </template>
          <div v-if="editForm.recording_path" class="recording-play">
            <audio v-if="recordingUrl" :src="recordingUrl" controls style="height:28px"/>
            <span v-else>已有录音</span>
          </div>
        </div>
      </div>

      <!-- 语音转文字 -->
      <div class="detail-section" v-if="editForm.id && (editForm.has_recording || segments.some(s => s.segment_type === 'audio'))">
        <div class="section-head">
          <label>语音转文字</label>
          <span v-if="(editForm as any).stt_status === 'done'" class="stt-status done">已转写</span>
          <span v-else-if="(editForm as any).stt_status === 'pending'" class="stt-status pending">转写中...</span>
        </div>
        <div class="stt-area">
          <el-button size="small" round @click="doStt" :loading="sttLoading" :disabled="(editForm as any).stt_status === 'pending'">
            <el-icon style="margin-right:4px"><MagicStick/></el-icon>转写录音（说话人分离）
          </el-button>
          <div v-if="(editForm as any).stt_text" class="stt-text">
            <p>{{ (editForm as any).stt_text }}</p>
          </div>
        </div>
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
      <div class="detail-section" v-if="editForm.id">
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
      <div class="detail-section" v-if="editForm.id">
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
import {onActivated, onMounted, reactive, ref, watch} from 'vue'
import {useMeetingsStore} from '@/stores/meetings'
import {ArrowDown, ArrowUp, Location, Microphone, Plus, Upload, Document, MagicStick, User, EditPen} from '@element-plus/icons-vue'
import {ElMessage, ElMessageBox} from 'element-plus'
import type {AiSummary, Meeting, MeetingAttachment, MeetingSegment} from '@/types/meeting'

const meetingsStore = useMeetingsStore()
const pageRef = ref<HTMLElement>()
const fileInputRef = ref<HTMLInputElement>()

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
const recordingUrl = ref('')
const pendingRecordingPath = ref('')

// 分段内录音
const isSegmentRecording = ref(false)
const segmentRecorder = ref<MediaRecorder | null>(null)
const segmentChunks = ref<Blob[]>([])

// STT
const sttLoading = ref(false)

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

// ========== 快速录音 ==========
async function startQuickRecord() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio: true})
    mediaRecorder.value = new MediaRecorder(stream, {mimeType: 'audio/webm'})
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
        const path = await window.electronAPI.meetings.saveRecording(dataUrl)
        if (path) {
          pendingRecordingPath.value = path
          recordingUrl.value = dataUrl
          ElMessage.success('录音完成，请创建会议')
          openCreateWithRecording(path, dataUrl)
        }
      } catch (e: any) {
        ElMessage.error('录音保存失败: ' + e.message)
      }
    }

    mediaRecorder.value.start()
    isRecording.value = true
    recordingDuration.value = 0
    recordingTimer.value = setInterval(() => { recordingDuration.value++ }, 1000)
  } catch {
    ElMessage.error('无法访问麦克风，请检查权限')
  }
}

function stopQuickRecord() {
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    mediaRecorder.value.stop()
  }
  isRecording.value = false
  if (recordingTimer.value) {
    clearInterval(recordingTimer.value)
    recordingTimer.value = null
  }
}

function openCreateWithRecording(recordingPath: string, dataUrl: string) {
  editingMeeting.value = null
  Object.assign(editForm, {
    id: 0, title: '', description: '', meeting_type: 'regular', status: 'ongoing',
    start_time: new Date().toISOString().slice(0, 16).replace('T', ' '),
    end_time: '', location: '', participants: [], minutes: '',
    attachments: [], recording_path: recordingPath, has_recording: 1, todo_ids: [],
    stt_text: '', stt_status: 'none'
  })
  recordingUrl.value = dataUrl
  aiSummary.value = null
  aiChatHistory.value = []
  segments.value = []
  segAudioUrls.value = {}
  showMoreOptions.value = false
  detailVisible.value = true
}

// ========== 会议内录音 ==========
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio: true})
    mediaRecorder.value = new MediaRecorder(stream, {mimeType: 'audio/webm'})
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
          editForm.recording_path = path
          editForm.has_recording = 1
          recordingUrl.value = dataUrl
          ElMessage.success('录音已保存')
        }
      } catch (e: any) {
        ElMessage.error('录音保存失败: ' + e.message)
      }
    }

    mediaRecorder.value.start()
    isRecording.value = true
    recordingDuration.value = 0
    recordingTimer.value = setInterval(() => { recordingDuration.value++ }, 1000)
  } catch {
    ElMessage.error('无法访问麦克风，请检查权限')
  }
}

function stopRecording() {
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    mediaRecorder.value.stop()
  }
  isRecording.value = false
  if (recordingTimer.value) {
    clearInterval(recordingTimer.value)
    recordingTimer.value = null
  }
}

// ========== 分段录音 ==========
async function startSegmentRecord() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio: true})
    segmentRecorder.value = new MediaRecorder(stream, {mimeType: 'audio/webm'})
    segmentChunks.value = []

    segmentRecorder.value.ondataavailable = (e) => {
      if (e.data.size > 0) segmentChunks.value.push(e.data)
    }

    segmentRecorder.value.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(segmentChunks.value, {type: 'audio/webm'})
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })

      try {
        const path = await window.electronAPI.meetings.saveRecording(dataUrl, editForm.id || undefined)
        if (path) {
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
              created_at: new Date().toISOString()
            })
          }
          segAudioUrls.value[path] = dataUrl
          ElMessage.success('录音已插入')
        }
      } catch (e: any) {
        ElMessage.error('录音保存失败: ' + e.message)
      }
    }

    segmentRecorder.value.start()
    isSegmentRecording.value = true
  } catch {
    ElMessage.error('无法访问麦克风，请检查权限')
  }
}

function stopSegmentRecord() {
  if (segmentRecorder.value && segmentRecorder.value.state !== 'inactive') {
    segmentRecorder.value.stop()
  }
  isSegmentRecording.value = false
}

// ========== 分段管理 ==========
function addTextSegment() {
  segments.value.push({
    id: -(Date.now()),
    meeting_id: editForm.id || 0,
    segment_type: 'text',
    content: '',
    speaker: '',
    sort_order: segments.value.length,
    created_at: new Date().toISOString()
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
          created_at: new Date().toISOString()
        })
      }
      segAudioUrls.value[path] = dataUrl
    }
  }
  input.click()
}

async function updateSegment(seg: MeetingSegment) {
  if (seg.id > 0) {
    await window.electronAPI.meetings.segments.update(seg.id, {
      content: seg.content,
      speaker: seg.speaker
    })
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
  editingMeeting.value = null
  Object.assign(editForm, {
    id: 0, title: '', description: '', meeting_type: 'regular', status: 'pending',
    start_time: new Date().toISOString().slice(0, 16).replace('T', ' '),
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
    todo_ids: editForm.todo_ids
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
        sort_order: segments.value.indexOf(s)
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
  await handleFilterChange()
  await meetingsStore.fetchStats()
})
onActivated(async () => {
  await handleFilterChange()
  await meetingsStore.fetchStats()
})

// 清理录音
watch(detailVisible, (v) => {
  if (!v) {
    if (isRecording.value) stopRecording()
    if (isSegmentRecording.value) stopSegmentRecord()
  }
})
</script>

<style scoped>
.meetings-page { max-width: 700px; outline: none; }

.page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
.page-title { font-size: 22px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.page-subtitle { font-size: 13px; color: var(--text-tertiary); }
.header-actions { display: flex; gap: 8px; flex-shrink: 0; }

/* 录音浮窗 */
.recording-float {
  position: fixed; bottom: 24px; right: 24px; z-index: 9999;
  display: flex; align-items: center; gap: 10px;
  padding: 10px 18px; border-radius: 24px;
  background: var(--bg-primary); border: 1px solid rgba(245,108,108,.3);
  box-shadow: 0 4px 16px rgba(0,0,0,.12);
}
.rec-dot { width: 8px; height: 8px; border-radius: 50%; background: #F56C6C; animation: pulse 1s infinite; }
.rec-dot-sm { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #F56C6C; animation: pulse 1s infinite; margin-right: 4px; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
.rec-time { font-size: 14px; font-weight: 600; color: #F56C6C; font-variant-numeric: tabular-nums; }

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
.seg-type-badge { font-size: 10px; padding: 1px 6px; border-radius: 3px; font-weight: 500; }
.seg-type-badge.audio { background: rgba(64,158,255,.1); color: #409EFF; }
.seg-type-badge.text { background: rgba(103,194,58,.1); color: #67C23A; }
.seg-speaker { width: 80px; border: 1px solid var(--border-color-light); border-radius: 3px; padding: 1px 4px; font-size: 11px; color: var(--text-primary); background: transparent; outline: none; font-family: inherit; }
.seg-speaker:focus { border-color: var(--color-primary); }
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
.empty { padding: 40px 0; text-align: center; color: var(--text-tertiary); font-size: 13px; }
.loading { padding: 40px 0; text-align: center; color: var(--text-tertiary); font-size: 13px; }
</style>
