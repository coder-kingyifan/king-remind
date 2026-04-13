import {createApp} from 'vue'
import {createPinia} from 'pinia'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import router from './router'
import App from './App.vue'
import './assets/styles/global.scss'
import {initNetworkProxy} from './network-proxy'

const app = createApp(App)

// 注册 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus, {locale: zhCn, size: 'default'})

// 初始化网络请求代理，将主进程的 axios 请求映射到 DevTools Network 面板
initNetworkProxy()

app.mount('#app')
