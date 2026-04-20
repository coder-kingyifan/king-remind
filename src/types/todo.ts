export interface Todo {
    id: number
    title: string
    description: string
    completed: number
    priority: 'low' | 'normal' | 'high' | 'urgent'
    due_date: string | null
    category: string
    images: string  // JSON string of image paths
    sort_order: number
    created_at: string
    updated_at: string
}

export interface CreateTodoInput {
    title: string
    description?: string
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    due_date?: string | null
    category?: string
    images?: string[]
}

export interface TodoStats {
    total: number
    completed: number
    pending: number
    overdue: number
}
