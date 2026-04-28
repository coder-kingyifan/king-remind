import {defineStore} from 'pinia'
import {ref, toRaw} from 'vue'
import type {CreateMeetingInput, Meeting, MeetingStats} from '@/types/meeting'

function plain<T>(obj: T): T {
    return JSON.parse(JSON.stringify(toRaw(obj)))
}

export const useMeetingsStore = defineStore('meetings', () => {
    const meetings = ref<Meeting[]>([])
    const stats = ref<MeetingStats>({total: 0, pending: 0, ongoing: 0, completed: 0, today: 0})
    const loading = ref(false)

    async function fetchMeetings(filters?: {
        status?: string
        meeting_type?: string
        search?: string
        start_date?: string
        end_date?: string
    }) {
        loading.value = true
        try {
            meetings.value = await window.electronAPI.meetings.list(filters ? plain(filters) : undefined)
        } finally {
            loading.value = false
        }
    }

    async function fetchStats() {
        stats.value = await window.electronAPI.meetings.stats()
    }

    async function createMeeting(data: CreateMeetingInput) {
        const result = await window.electronAPI.meetings.create(plain(data))
        await fetchMeetings()
        await fetchStats()
        return result
    }

    async function updateMeeting(id: number, data: Partial<CreateMeetingInput>) {
        const result = await window.electronAPI.meetings.update(id, plain(data))
        await fetchMeetings()
        await fetchStats()
        return result
    }

    async function deleteMeeting(id: number) {
        await window.electronAPI.meetings.delete(id)
        await fetchMeetings()
        await fetchStats()
    }

    async function updateStatus(id: number, status: string) {
        const result = await window.electronAPI.meetings.updateStatus(id, status)
        await fetchMeetings()
        await fetchStats()
        return result
    }

    return {
        meetings,
        stats,
        loading,
        fetchMeetings,
        fetchStats,
        createMeeting,
        updateMeeting,
        deleteMeeting,
        updateStatus
    }
})
