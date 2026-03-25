import { createRouter, createMemoryHistory } from 'vue-router'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/pages/DashboardPage.vue'),
      meta: { title: '仪表盘', icon: 'Odometer' }
    },
    {
      path: '/reminders',
      name: 'reminders',
      component: () => import('@/pages/RemindersPage.vue'),
      meta: { title: '提醒管理', icon: 'Bell' }
    },
    {
      path: '/notifications',
      name: 'notifications',
      component: () => import('@/pages/NotificationSettingsPage.vue'),
      meta: { title: '通知渠道', icon: 'Message' }
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/pages/SystemSettingsPage.vue'),
      meta: { title: '系统设置', icon: 'Setting' }
    }
  ]
})

export default router
