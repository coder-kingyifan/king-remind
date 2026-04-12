import {createMemoryHistory, createRouter} from 'vue-router'

const router = createRouter({
    history: createMemoryHistory(),
    routes: [
        {
            path: '/',
            name: 'dashboard',
            component: () => import('@/pages/DashboardPage.vue'),
            meta: {title: '仪表盘', icon: 'Odometer'}
        },
        {
            path: '/reminders',
            name: 'reminders',
            component: () => import('@/pages/RemindersPage.vue'),
            meta: {title: '提醒管理', icon: 'Bell'}
        },
        {
            path: '/skills',
            name: 'skills',
            component: () => import('@/pages/SkillsPage.vue'),
            meta: {title: '技能中心', icon: 'MagicStick'}
        },
        {
            path: '/notifications',
            name: 'notifications',
            component: () => import('@/pages/NotificationSettingsPage.vue'),
            meta: {title: '通知渠道', icon: 'Message'}
        },
        {
            path: '/settings',
            name: 'settings',
            component: () => import('@/pages/SystemSettingsPage.vue'),
            meta: {title: '系统设置', icon: 'Setting'}
        },
        {
            path: '/model-config',
            name: 'model-config',
            component: () => import('@/pages/ModelConfigPage.vue'),
            meta: {title: '模型配置', icon: 'Cpu'}
        },
        {
            path: '/ai-chat',
            name: 'ai-chat',
            component: () => import('@/pages/AiChatPage.vue'),
            meta: {title: 'AI 助手', icon: 'ChatDotRound'}
        }
    ]
})

export default router
