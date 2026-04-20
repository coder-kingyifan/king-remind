import {defineStore} from 'pinia'
import {ref, toRaw} from 'vue'
import type {CreateTodoInput, Todo, TodoStats} from '@/types/todo'

function plain<T>(obj: T): T {
    return JSON.parse(JSON.stringify(toRaw(obj)))
}

export const useTodosStore = defineStore('todos', () => {
    const todos = ref<Todo[]>([])
    const stats = ref<TodoStats>({total: 0, completed: 0, pending: 0, overdue: 0})
    const loading = ref(false)

    async function fetchTodos(filters?: { completed?: number; category?: string; search?: string }) {
        loading.value = true
        try {
            todos.value = await window.electronAPI.todos.list(filters ? plain(filters) : undefined)
        } finally {
            loading.value = false
        }
    }

    async function fetchStats() {
        stats.value = await window.electronAPI.todos.stats()
    }

    async function createTodo(data: CreateTodoInput) {
        const result = await window.electronAPI.todos.create(plain(data))
        await fetchTodos()
        await fetchStats()
        return result
    }

    async function updateTodo(id: number, data: Partial<CreateTodoInput & { completed: number }>) {
        const result = await window.electronAPI.todos.update(id, plain(data))
        await fetchTodos()
        await fetchStats()
        return result
    }

    async function deleteTodo(id: number) {
        await window.electronAPI.todos.delete(id)
        await fetchTodos()
        await fetchStats()
    }

    async function toggleTodo(id: number) {
        await window.electronAPI.todos.toggle(id)
        await fetchTodos()
        await fetchStats()
    }

    return {
        todos,
        stats,
        loading,
        fetchTodos,
        fetchStats,
        createTodo,
        updateTodo,
        deleteTodo,
        toggleTodo
    }
})
