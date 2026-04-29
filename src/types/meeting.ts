export interface MeetingAttachment {
    name: string
    path: string
    type: string
    size?: number
}

export interface AiSummary {
    topics: string[]
    decisions: string[]
    action_items: Array<{ task: string; assignee: string | null; deadline: string | null }>
    key_points: string[]
    summary: string
}

export interface MeetingSegment {
    id: number
    meeting_id: number
    segment_type: 'text' | 'audio'
    content: string
    speaker: string
    sort_order: number
    start_time: number  // 秒，相对于录音开始
    end_time: number    // 秒，相对于录音开始
    created_at: string
}

export interface SttUtterance {
    speaker: string
    text: string
    start_time: number
    end_time: number
}

export interface SttResult {
    utterances: SttUtterance[]
    full_text: string
}

export interface Meeting {
    id: number
    title: string
    description: string
    meeting_type: 'regular' | 'project' | 'adhoc'
    status: 'pending' | 'ongoing' | 'completed'
    start_time: string
    end_time: string | null
    location: string
    participants: string  // JSON string
    minutes: string
    ai_summary: string | null  // JSON string
    attachments: string  // JSON string
    recording_path: string | null
    has_recording: number
    todo_ids: string  // JSON string
    stt_text: string | null
    stt_status: 'none' | 'pending' | 'done' | 'error'
    created_at: string
    updated_at: string
}

export interface CreateMeetingInput {
    title: string
    description?: string
    meeting_type?: 'regular' | 'project' | 'adhoc'
    status?: 'pending' | 'ongoing' | 'completed'
    start_time: string
    end_date?: string | null
    location?: string
    participants?: string[]
    minutes?: string
    attachments?: MeetingAttachment[]
    recording_path?: string | null
    has_recording?: number
    todo_ids?: number[]
    stt_text?: string | null
    stt_status?: 'none' | 'pending' | 'done' | 'error'
}

export interface MeetingStats {
    total: number
    pending: number
    ongoing: number
    completed: number
    today: number
}
