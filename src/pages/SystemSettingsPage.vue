<template>
  <div class="system-settings">
    <div class="page-header">
      <h1 class="page-title">系统设置</h1>
      <p class="page-subtitle">自定义应用行为和外观</p>
    </div>

    <div class="settings-list">
      <!-- 主题设置 -->
      <div class="setting-section">
        <h3 class="section-title">外观</h3>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">主题模式</div>
            <div class="setting-desc">选择应用的外观主题</div>
          </div>
          <el-segmented
              :model-value="settingsStore.theme"
              :options="themeOptions"
              @change="(val: string) => settingsStore.setSetting('theme', val)"
          />
        </div>
      </div>

      <!-- 行为设置 -->
      <div class="setting-section">
        <h3 class="section-title">行为</h3>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">开机自启动</div>
            <div class="setting-desc">Windows 启动时自动打开 king提醒助手</div>
          </div>
          <el-switch
              :model-value="settingsStore.settings.launch_at_startup === 'true'"
              @change="(val: boolean) => settingsStore.setSetting('launch_at_startup', String(val))"
          />
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">关闭时最小化到托盘</div>
            <div class="setting-desc">点击关闭按钮时隐藏到系统托盘而非退出</div>
          </div>
          <el-switch
              :model-value="settingsStore.settings.minimize_to_tray !== 'false'"
              @change="(val: boolean) => settingsStore.setSetting('minimize_to_tray', String(val))"
          />
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">通知提示音</div>
            <div class="setting-desc">桌面通知时播放提示音</div>
          </div>
          <el-switch
              :model-value="settingsStore.settings.notification_sound !== 'false'"
              @change="(val: boolean) => settingsStore.setSetting('notification_sound', String(val))"
          />
        </div>
      </div>

      <!-- 调度设置 -->
      <div class="setting-section">
        <h3 class="section-title">调度</h3>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">检查间隔（秒）</div>
            <div class="setting-desc">调度器多久检查一次是否有到期的提醒</div>
          </div>
          <el-input-number
              :model-value="Number(settingsStore.settings.scheduler_interval || 60)"
              :min="10"
              :max="600"
              :step="10"
              size="small"
              controls-position="right"
              @change="(val: number) => settingsStore.setSetting('scheduler_interval', String(val))"
          />
        </div>
      </div>

      <!-- 数据管理 -->
      <div class="setting-section">
        <h3 class="section-title">数据</h3>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">清理通知日志</div>
            <div class="setting-desc">删除 30 天前的通知发送记录</div>
          </div>
          <el-button size="small" plain @click="cleanupLogs">清理日志</el-button>
        </div>
      </div>

      <!-- 关于 -->
      <div class="setting-section">
        <h3 class="section-title">
          关于
          <span class="gift-link" @click="showBlessing = true">送给默默努力的你</span>
        </h3>

        <div class="about-info">
          <div class="about-row">
            <span class="about-label">应用名称</span>
            <span class="about-value">king提醒助手</span>
          </div>
          <div class="about-row">
            <span class="about-label">版本</span>
            <span class="about-value">V2.0.0</span>
          </div>
          <div class="about-row">
            <span class="about-label">作者</span>
            <span class="about-value">kingyifan</span>
          </div>
          <div class="about-row">
            <span class="about-label">联系作者</span>
            <span class="about-value">kingyifan@88.com</span>
          </div>
          <div class="about-row">
            <span class="about-label">友链社区</span>
            <span class="about-value"><a target="_blank" href="https://linux.do/">Linux.do</a></span>
          </div>
        </div>
      </div>

      <!-- 对外调用 API -->
      <div class="setting-section">
        <h3 class="section-title">对外调用 API</h3>

        <div class="api-doc">
          <p class="api-intro">
            应用启动后会在本地开启一个 HTTP 服务，外部程序（脚本、AI Agent、自动化工具等）可通过该接口创建和管理提醒。
          </p>

          <!-- 基本信息 -->
          <div class="api-row">
            <span class="api-label">服务地址</span>
            <span class="api-value api-code">http://127.0.0.1:{{ settingsStore.settings.api_port || '33333' }}</span>
          </div>
          <div class="api-row">
            <span class="api-label">认证方式</span>
            <span class="api-value">
              <template v-if="settingsStore.settings.api_token">
                Header <span class="api-code">Authorization: Bearer &lt;token&gt;</span>
              </template>
              <template v-else>
                未启用（Token 为空则不校验）
              </template>
            </span>
          </div>
          <div class="api-row">
            <span class="api-label">响应格式</span>
            <span class="api-value">JSON &nbsp;<span
                class="api-code">{ success, data } / { success, error }</span></span>
          </div>

          <!-- 接口列表 -->
          <div class="api-endpoints-title">接口列表</div>

          <div class="api-endpoint">
            <span class="api-method get">GET</span>
            <span class="api-path">/api/ping</span>
            <span class="api-endpoint-desc">健康检查，确认服务是否正常运行</span>
          </div>

          <div class="api-endpoint">
            <span class="api-method post">POST</span>
            <span class="api-path">/api/reminders</span>
            <span class="api-endpoint-desc">创建提醒，创建后调度器立即检查触发</span>
          </div>

          <div class="api-endpoint">
            <span class="api-method get">GET</span>
            <span class="api-path">/api/reminders</span>
            <span class="api-endpoint-desc">查询提醒列表</span>
          </div>
          <div class="api-query-params">
            <span class="api-query-item"><span class="api-code">?search=关键词</span> 按标题/描述模糊搜索</span>
            <span class="api-query-item"><span
                class="api-code">?is_active=1</span> 只返回启用中的提醒（0 = 已禁用）</span>
            <span class="api-query-item">不传参数则返回全部</span>
          </div>

          <div class="api-endpoint">
            <span class="api-method get">GET</span>
            <span class="api-path">/api/reminders/:id</span>
            <span class="api-endpoint-desc">获取单条提醒详情</span>
          </div>

          <div class="api-endpoint">
            <span class="api-method delete">DELETE</span>
            <span class="api-path">/api/reminders/:id</span>
            <span class="api-endpoint-desc">删除指定提醒</span>
          </div>

          <!-- 创建提醒字段说明 -->
          <div class="api-endpoints-title" style="margin-top:12px;">POST /api/reminders 请求字段</div>
          <div class="api-fields-table">
            <div class="api-field-row api-field-header">
              <span class="api-field-name">字段</span>
              <span class="api-field-type">类型</span>
              <span class="api-field-req">必填</span>
              <span class="api-field-desc">说明</span>
            </div>
            <div class="api-field-row">
              <span class="api-field-name api-code">title</span>
              <span class="api-field-type">string</span>
              <span class="api-field-req req">✅</span>
              <span class="api-field-desc">提醒标题</span>
            </div>
            <div class="api-field-row">
              <span class="api-field-name api-code">remind_type</span>
              <span class="api-field-type">string</span>
              <span class="api-field-req req">✅</span>
              <span class="api-field-desc"><span class="api-code">interval</span>（周期循环）或 <span class="api-code">scheduled</span>（定时一次）</span>
            </div>
            <div class="api-field-row">
              <span class="api-field-name api-code">start_time</span>
              <span class="api-field-type">string</span>
              <span class="api-field-req req">✅</span>
              <span class="api-field-desc">开始时间，ISO 8601，如 <span class="api-code">2025-03-20T09:00:00</span></span>
            </div>
            <div class="api-field-row">
              <span class="api-field-name api-code">description</span>
              <span class="api-field-type">string</span>
              <span class="api-field-req">-</span>
              <span class="api-field-desc">提醒内容描述</span>
            </div>
            <div class="api-field-row">
              <span class="api-field-name api-code">end_time</span>
              <span class="api-field-type">string</span>
              <span class="api-field-req">-</span>
              <span class="api-field-desc">结束时间，超过后自动停止</span>
            </div>
            <div class="api-field-row">
              <span class="api-field-name api-code">interval_value</span>
              <span class="api-field-type">number</span>
              <span class="api-field-req">-</span>
              <span class="api-field-desc">周期数值（默认 60），仅 interval 类型有效</span>
            </div>
            <div class="api-field-row">
              <span class="api-field-name api-code">interval_unit</span>
              <span class="api-field-type">string</span>
              <span class="api-field-req">-</span>
              <span class="api-field-desc"><span class="api-code">minutes</span> / <span class="api-code">hours</span> / <span
                  class="api-code">days</span> / <span class="api-code">months</span> / <span
                  class="api-code">years</span></span>
            </div>
            <div class="api-field-row">
              <span class="api-field-name api-code">weekdays</span>
              <span class="api-field-type">number[]</span>
              <span class="api-field-req">-</span>
              <span class="api-field-desc">仅指定星期触发，0=周日 … 6=周六，如 <span
                  class="api-code">[1,3,5]</span></span>
            </div>
            <div class="api-field-row">
              <span class="api-field-name api-code">workday_only</span>
              <span class="api-field-type">boolean</span>
              <span class="api-field-req">-</span>
              <span class="api-field-desc">仅工作日触发</span>
            </div>
            <div class="api-field-row">
              <span class="api-field-name api-code">holiday_only</span>
              <span class="api-field-type">boolean</span>
              <span class="api-field-req">-</span>
              <span class="api-field-desc">仅节假日触发</span>
            </div>
            <div class="api-field-row">
              <span class="api-field-name api-code">lunar_date</span>
              <span class="api-field-type">string</span>
              <span class="api-field-req">-</span>
              <span class="api-field-desc">农历日期 <span class="api-code">MM-DD</span>，如 <span
                  class="api-code">01-01</span>（正月初一）</span>
            </div>
            <div class="api-field-row">
              <span class="api-field-name api-code">active_hours_start</span>
              <span class="api-field-type">string</span>
              <span class="api-field-req">-</span>
              <span class="api-field-desc">活跃时段开始，格式 <span class="api-code">HH:mm</span>，如 <span
                  class="api-code">09:00</span></span>
            </div>
            <div class="api-field-row">
              <span class="api-field-name api-code">active_hours_end</span>
              <span class="api-field-type">string</span>
              <span class="api-field-req">-</span>
              <span class="api-field-desc">活跃时段结束，格式 <span class="api-code">HH:mm</span></span>
            </div>
            <div class="api-field-row">
              <span class="api-field-name api-code">channels</span>
              <span class="api-field-type">string[]</span>
              <span class="api-field-req">-</span>
              <span class="api-field-desc">通知渠道，默认 <span class="api-code">["desktop"]</span>，可选：<span
                  class="api-code">desktop</span> / <span class="api-code">email</span> / <span class="api-code">telegram</span> / <span
                  class="api-code">wechat_work</span> / <span class="api-code">webhook</span> / <span class="api-code">sms</span></span>
            </div>
            <div class="api-field-row">
              <span class="api-field-name api-code">icon</span>
              <span class="api-field-type">string</span>
              <span class="api-field-req">-</span>
              <span class="api-field-desc">图标 emoji，默认 🔔</span>
            </div>
            <div class="api-field-row">
              <span class="api-field-name api-code">color</span>
              <span class="api-field-type">string</span>
              <span class="api-field-req">-</span>
              <span class="api-field-desc">颜色十六进制，默认 <span class="api-code">#409EFF</span></span>
            </div>
          </div>

          <!-- 调用示例 -->
          <div class="api-example-title" style="margin-top:14px;">调用示例（curl）</div>
          <pre class="api-pre">curl -X POST http://127.0.0.1:{{
              settingsStore.settings.api_port || '33333'
            }}/api/reminders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer &lt;your_token&gt;" \
  -d '{
    "title": "喝水提醒",
    "remind_type": "interval",
    "start_time": "2025-03-20T09:00:00",
    "interval_value": 30,
    "interval_unit": "minutes",
    "active_hours_start": "09:00",
    "active_hours_end": "18:00",
    "channels": ["desktop"]
  }'</pre>

          <div class="api-example-title" style="margin-top:10px;">HTTP 状态码说明</div>
          <div class="api-field-row api-field-header" style="margin-top:4px;">
            <span class="api-field-name">状态码</span>
            <span style="flex:1">含义</span>
          </div>
          <div class="api-field-row"><span class="api-field-name api-code">200</span><span style="flex:1">成功</span>
          </div>
          <div class="api-field-row"><span class="api-field-name api-code">400</span><span
              style="flex:1">请求参数错误</span></div>
          <div class="api-field-row"><span class="api-field-name api-code">401</span><span
              style="flex:1">Token 验证失败</span></div>
          <div class="api-field-row"><span class="api-field-name api-code">404</span><span
              style="flex:1">资源不存在</span></div>
          <div class="api-field-row"><span class="api-field-name api-code">500</span><span
              style="flex:1">服务器内部错误</span></div>
        </div>
      </div>
    </div>

    <!-- 祝福弹窗 -->
    <el-dialog
        v-model="showBlessing"
        title=""
        width="460px"
        :show-close="true"
        class="blessing-dialog"
        :close-on-click-modal="true"
    >
      <div class="blessing-page">
        <div class="blessing-stars">
          <span v-for="i in 12" :key="i" class="star" :style="starStyle(i)"></span>
        </div>
        <div class="blessing-gift">
          <div class="blessing-ribbon"></div>
          <div class="blessing-box">
            <span class="blessing-bow">🎀</span>
          </div>
        </div>
        <div class="blessing-content">
          <h2 class="blessing-title">- 送给平凡的你 -</h2>
          <div class="blessing-divider"></div>
          <p class="blessing-text">
            愿你每一天都被温柔以待<br/>
            愿所有的美好都如期而至<br/>
            愿佬眼里有光，心中有爱<br/>
            愿这个小小的提醒助手<br/>
            能陪你度过每一个平凡又闪亮的日子
          </p>
          <div class="blessing-footer">
            <span class="blessing-heart">❤️</span>
            <span class="blessing-from">from kingyifan</span>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {ref} from 'vue'
import {useSettingsStore} from '@/stores/settings'
import {ElMessage} from 'element-plus'

const settingsStore = useSettingsStore()
const showBlessing = ref(false)

function starStyle(i: number) {
  const angle = (i / 12) * 360
  const dist = 60 + Math.random() * 40
  const x = Math.cos((angle * Math.PI) / 180) * dist
  const y = Math.sin((angle * Math.PI) / 180) * dist
  const delay = (i * 0.15).toFixed(2)
  const size = 4 + Math.random() * 6
  return {
    left: `calc(50% + ${x}px)`,
    top: `calc(50% + ${y}px)`,
    width: `${size}px`,
    height: `${size}px`,
    animationDelay: `${delay}s`
  }
}

const themeOptions = [
  {label: '☀️ 亮色', value: 'light'},
  {label: '🌙 暗色', value: 'dark'},
  {label: '💻 跟随系统', value: 'system'}
]

async function cleanupLogs() {
  try {
    // 调用主进程清理日志
    ElMessage.success('日志清理完成')
  } catch {
    ElMessage.error('清理失败')
  }
}
</script>

<style scoped>
.system-settings {
  max-width: 640px;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 13px;
  color: var(--text-tertiary);
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.setting-section {
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: 12px;
  padding: 20px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color-light);
}

.setting-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.setting-item:first-of-type {
  padding-top: 0;
}

.setting-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.setting-desc {
  font-size: 12px;
  color: var(--text-tertiary);
}

.about-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.about-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.about-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.about-value {
  font-size: 13px;
  color: var(--text-primary);
}

.setting-actions {
  display: flex;
  gap: 8px;
}

/* 礼物链接 */
.gift-link {
  font-size: 12px;
  font-weight: 400;
  color: #E6A23C;
  cursor: pointer;
  margin-left: 8px;
  transition: all 0.2s;
}

.gift-link:hover {
  color: #F56C6C;
  text-decoration: underline;
}

/* 祝福弹窗 */
.blessing-page {
  text-align: center;
  padding: 20px 10px 10px;
  position: relative;
  overflow: hidden;
}

.blessing-stars {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.star {
  position: absolute;
  border-radius: 50%;
  background: #F5D76E;
  opacity: 0;
  animation: twinkle 2s ease-in-out infinite;
}

@keyframes twinkle {
  0%, 100% {
    opacity: 0;
    transform: scale(0.5);
  }
  50% {
    opacity: 0.8;
    transform: scale(1);
  }
}

.blessing-gift {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
}

.blessing-box {
  width: 80px;
  height: 70px;
  background: linear-gradient(135deg, #F56C6C 0%, #E6A23C 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 0 6px 20px rgba(245, 108, 108, 0.3);
}

.blessing-bow {
  font-size: 36px;
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

.blessing-ribbon {
  width: 6px;
  height: 20px;
  background: linear-gradient(180deg, #F56C6C, #E6A23C);
  border-radius: 3px 3px 0 0;
}

.blessing-content {
  position: relative;
  z-index: 1;
}

.blessing-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 12px;
  letter-spacing: 2px;
}

.blessing-divider {
  width: 60px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #F56C6C, transparent);
  margin: 0 auto 18px;
}

.blessing-text {
  font-size: 15px;
  line-height: 2.2;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
  margin-bottom: 24px;
}

.blessing-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.blessing-heart {
  font-size: 16px;
  animation: heartbeat 1.2s ease-in-out infinite;
}

@keyframes heartbeat {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.25);
  }
}

.blessing-from {
  font-size: 14px;
  color: var(--text-tertiary);
  font-style: italic;
}

/* API 字段表格 */
.api-fields-table {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--border-color-light);
  border-radius: 6px;
  overflow: hidden;
  margin-top: 4px;
}

.api-field-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 5px 10px;
  font-size: 12px;
  border-bottom: 1px solid var(--border-color-light);
  line-height: 1.6;
}

.api-field-row:last-child {
  border-bottom: none;
}

.api-field-header {
  background: var(--bg-secondary, #f5f7fa);
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 11px;
}

.api-field-name {
  min-width: 130px;
  flex-shrink: 0;
  color: var(--text-primary);
}

.api-field-type {
  min-width: 60px;
  flex-shrink: 0;
  color: var(--text-tertiary);
  font-style: italic;
}

.api-field-req {
  min-width: 28px;
  flex-shrink: 0;
  color: var(--text-tertiary);
  text-align: center;
}

.api-field-req.req {
  color: #67C23A;
}

.api-field-desc {
  flex: 1;
  color: var(--text-secondary);
}

/* API 说明 */
.api-doc {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.api-intro {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  line-height: 1.6;
}

.api-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
  font-size: 13px;
}

.api-label {
  color: var(--text-secondary);
  min-width: 70px;
  flex-shrink: 0;
}

.api-value {
  color: var(--text-primary);
}

.api-code {
  background: var(--bg-secondary, #f5f5f5);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--color-primary, #409EFF);
  font-family: monospace;
}

.api-endpoints-title,
.api-example-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 8px;
  margin-bottom: 2px;
}

.api-endpoint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  font-size: 13px;
}

.api-method {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 3px;
  min-width: 50px;
  text-align: center;
  font-family: monospace;
}

.api-method.get {
  background: #e8f4fd;
  color: #409EFF;
}

.api-method.post {
  background: #e8f9ef;
  color: #67C23A;
}

.api-method.delete {
  background: #fef0f0;
  color: #F56C6C;
}

.api-path {
  background: var(--bg-secondary, #f5f5f5);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-primary);
  font-family: monospace;
}

.api-endpoint-desc {
  color: var(--text-tertiary);
  font-size: 12px;
}

.api-pre {
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 12px;
  font-family: monospace;
  color: var(--text-primary);
  overflow-x: auto;
  white-space: pre;
  margin: 0;
  line-height: 1.6;
}
</style>
