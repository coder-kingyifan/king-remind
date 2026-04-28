import {createWebHashHistory, createRouter} from 'vue-router'

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        {
            path: '/',
            name: 'ai-chat',
            component: () => import('@/pages/AiChatPage.vue'),
            meta: {title: 'AI 助手', icon: 'ChatDotRound'}
        },
        {
            path: '/dashboard',
            name: 'dashboard',
            component: () => import('@/pages/DashboardPage.vue'),
            meta: {title: '数据概览', icon: 'Odometer'}
        },
        {
            path: '/reminders',
            name: 'reminders',
            component: () => import('@/pages/RemindersPage.vue'),
            meta: {title: '提醒管理', icon: 'Bell'}
        },
        {
            path: '/todos',
            name: 'todos',
            component: () => import('@/pages/TodosPage.vue'),
            meta: {title: '待办事项', icon: 'List'}
        },
        {
            path: '/meetings',
            name: 'meetings',
            component: () => import('@/pages/MeetingsPage.vue'),
            meta: {title: '会议管理', icon: 'Memo'}
        },
        {
            path: '/notifications',
            name: 'notifications',
            component: () => import('@/pages/NotificationSettingsPage.vue'),
            meta: {title: '通知渠道', icon: 'Message'}
        },
        {
            path: '/model-config',
            name: 'model-config',
            component: () => import('@/pages/ModelConfigPage.vue'),
            meta: {title: '大模型 管理', icon: 'Cpu'}
        },
        {
            path: '/skills',
            name: 'skills',
            component: () => import('@/pages/SkillsPage.vue'),
            meta: {title: '技能中心', icon: 'MagicStick'}
        },
        {
            path: '/skill-store',
            name: 'skill-store',
            component: () => import('@/pages/SkillStorePage.vue'),
            meta: {title: '技能商店', icon: 'ShoppingBag'}
        },
        {
            path: '/settings',
            name: 'settings',
            component: () => import('@/pages/SystemSettingsPage.vue'),
            meta: {title: '系统设置', icon: 'Setting'}
        }
    ]
})

// 缓存 app_mode，避免每次导航都读取
let cachedAppMode: string | null = null

// 普通提醒模式下，/ 重定向到 /dashboard
router.beforeEach(async (to, _from, next) => {
    if (to.path === '/') {
        try {
            if (cachedAppMode === null) {
                const settings = await window.electronAPI.settings.getAll()
                cachedAppMode = settings.app_mode || 'ai'
            }
            if (cachedAppMode === 'simple') {
                return next('/dashboard')
            }
        } catch { /* ignore */ }
    }
    next()
})

// 供外部调用以更新缓存
export function setCachedAppMode(mode: string) {
    cachedAppMode = mode
}

export default router
