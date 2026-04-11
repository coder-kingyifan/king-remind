import {resolve} from 'path'
import {defineConfig, externalizeDepsPlugin} from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import {ElementPlusResolver} from 'unplugin-vue-components/resolvers'

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        build: {
            lib: {
                entry: resolve('electron/main/index.ts')
            },
            rollupOptions: {
                external: ['sql.js']
            }
        }
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: {
            lib: {
                entry: resolve('electron/preload/index.ts')
            }
        }
    },
    renderer: {
        root: '.',
        build: {
            rollupOptions: {
                input: resolve('index.html')
            }
        },
        resolve: {
            alias: {
                '@': resolve('src')
            }
        },
        plugins: [
            vue(),
            AutoImport({
                resolvers: [ElementPlusResolver()],
                imports: ['vue', 'vue-router', 'pinia']
            }),
            Components({
                resolvers: [ElementPlusResolver()]
            })
        ],
        css: {
            preprocessorOptions: {
                scss: {
                    additionalData: `@use "@/assets/styles/variables" as *;`
                }
            }
        }
    }
})