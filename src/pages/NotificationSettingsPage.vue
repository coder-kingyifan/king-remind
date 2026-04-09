<template>
  <div class="notification-settings">
    <div class="page-header">
      <h1 class="page-title">通知渠道</h1>
      <p class="page-subtitle">配置各个通知渠道的连接信息</p>
    </div>

    <div class="channel-list">
      <div v-for="channel in CHANNELS" :key="channel.key" class="channel-card">
        <div class="channel-header">
          <div class="channel-info">
            <span v-if="channel.key === 'wechat_work'" class="channel-icon">
              <img :src="wechatWorkIcon" class="channel-icon-img" />
            </span>
            <span v-else class="channel-icon">{{ channel.icon }}</span>
            <div>
              <div class="channel-name">{{ channel.name }}</div>
              <div class="channel-desc">{{ channel.description }}</div>
            </div>
          </div>
          <div class="channel-actions">
            <el-switch
              :model-value="notificationsStore.isEnabled(channel.key)"
              @change="(val: boolean) => handleToggle(channel.key, val)"
            />
            <span
              v-if="notificationsStore.isEnabled(channel.key) && channel.key !== 'desktop'"
              class="expand-arrow"
              :class="{ expanded: expandedChannels[channel.key] }"
              @click="toggleExpand(channel.key)"
            >
              <el-icon :size="16"><ArrowDown /></el-icon>
            </span>
          </div>
        </div>

        <!-- 桌面通知配置 -->
        <div v-if="channel.key === 'desktop' && notificationsStore.isEnabled(channel.key)" class="channel-config">
          <p class="config-tip">桌面通知使用系统原生通知，无需额外配置。</p>
        </div>

        <!-- 邮件配置 -->
        <div v-if="channel.key === 'email' && notificationsStore.isEnabled(channel.key) && expandedChannels['email']" class="channel-config">
          <el-form :model="emailConfig" label-position="top" size="small">
            <div class="config-row">
              <el-form-item label="SMTP 服务器">
                <el-input v-model="emailConfig.smtp_host" placeholder="smtp.example.com" />
              </el-form-item>
              <el-form-item label="端口">
                <el-input-number v-model="emailConfig.smtp_port" :min="1" :max="65535" style="width: 100%;" />
              </el-form-item>
            </div>
            <el-form-item>
              <el-checkbox v-model="emailConfig.smtp_secure">使用 SSL/TLS</el-checkbox>
            </el-form-item>
            <div class="config-row">
              <el-form-item label="用户名">
                <el-input v-model="emailConfig.smtp_user" placeholder="your@email.com" />
              </el-form-item>
              <el-form-item label="密码/授权码">
                <el-input v-model="emailConfig.smtp_pass" type="password" show-password placeholder="SMTP密码或授权码" />
              </el-form-item>
            </div>
            <el-form-item label="发件人地址">
              <el-input v-model="emailConfig.from_address" placeholder="留空则使用用户名" />
            </el-form-item>
            <el-form-item label="收件人地址（多个用逗号分隔）">
              <el-input v-model="emailToStr" placeholder="多个地址用逗号分隔" />
            </el-form-item>
            <div class="config-actions">
              <el-button size="small" @click="saveConfig('email', emailConfig)">保存配置</el-button>
              <el-button size="small" type="success" plain :loading="testing === 'email'" @click="testChannel('email')">
                发送测试
              </el-button>
            </div>
          </el-form>
        </div>

        <!-- Telegram 配置 -->
        <div v-if="channel.key === 'telegram' && notificationsStore.isEnabled(channel.key) && expandedChannels['telegram']" class="channel-config">
          <div class="config-guide">
            <div class="guide-title">配置步骤</div>
            <ol class="guide-steps">
              <li>在 Telegram 搜索 <b>@BotFather</b>，发送 <code>/newbot</code> 创建机器人，获取 Bot Token</li>
              <li>搜索 <b>@userinfobot</b>，发送任意消息获取你的数字 Chat ID；多个接收人填多个 Chat ID，逗号分隔</li>
              <li>给你创建的机器人发送 <code>/start</code> 启动对话</li>
              <li>国内网络需要填写代理地址（如 Clash 默认 <code>http://127.0.0.1:7890</code>）</li>
            </ol>
          </div>
          <el-form :model="telegramConfig" label-position="top" size="small">
            <el-form-item label="Bot Token">
              <el-input v-model="telegramConfig.bot_token" placeholder="123456:ABC-DEF..." />
            </el-form-item>
            <el-form-item label="Chat ID（多个用逗号分隔）">
              <el-input v-model="telegramConfig.chat_id" placeholder="如 123456789 或 123456789,987654321" />
            </el-form-item>
            <el-form-item label="代理地址（国内网络需要）">
              <el-input v-model="telegramConfig.proxy_url" placeholder="http://127.0.0.1:7890" />
            </el-form-item>
            <div class="config-actions">
              <el-button size="small" @click="saveConfig('telegram', telegramConfig)">保存配置</el-button>
              <el-button size="small" type="success" plain :loading="testing === 'telegram'" @click="testChannel('telegram')">
                发送测试
              </el-button>
            </div>
          </el-form>
        </div>

        <!-- 企业微信配置 -->
        <div v-if="channel.key === 'wechat_work' && notificationsStore.isEnabled(channel.key) && expandedChannels['wechat_work']" class="channel-config">
          <el-form :model="wechatConfig" label-position="top" size="small">
            <el-form-item label="企业 ID (Corp ID)">
              <el-input v-model="wechatConfig.corp_id" placeholder="ww..." />
            </el-form-item>
            <el-form-item label="应用 Secret">
              <el-input v-model="wechatConfig.corp_secret" type="password" show-password placeholder="应用的Secret" />
            </el-form-item>
            <div class="config-row">
              <el-form-item label="Agent ID">
                <el-input v-model="wechatConfig.agent_id" placeholder="应用ID" />
              </el-form-item>
              <el-form-item label="接收人（多个用 | 分隔）">
                <el-input v-model="wechatConfig.to_user" placeholder="@all 或 user1|user2" />
              </el-form-item>
            </div>
            <div class="config-actions">
              <el-button size="small" @click="saveConfig('wechat_work', wechatConfig)">保存配置</el-button>
              <el-button size="small" type="success" plain :loading="testing === 'wechat_work'" @click="testChannel('wechat_work')">
                发送测试
              </el-button>
            </div>
          </el-form>
        </div>

        <!-- 企业微信消息推送配置 -->
        <div v-if="channel.key === 'wechat_work_webhook' && notificationsStore.isEnabled(channel.key) && expandedChannels['wechat_work_webhook']" class="channel-config">
          <div class="config-guide">
            <div class="guide-title">配置步骤</div>
            <ol class="guide-steps">
              <li>在企业微信群聊中，点击右上角 <b>...</b> → <b>消息推送</b> → <b>添加消息推送</b></li>
              <li>创建后复制 <b>Webhook 地址</b>，粘贴到下方</li>
              <li>每个消息推送的 Webhook 地址是唯一的，请妥善保管</li>
            </ol>
          </div>
          <el-form :model="wechatWebhookConfig" label-position="top" size="small">
            <el-form-item label="Webhook URL">
              <el-input v-model="wechatWebhookConfig.webhook_url" placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx" />
            </el-form-item>
            <div class="config-actions">
              <el-button size="small" @click="saveConfig('wechat_work_webhook', wechatWebhookConfig)">保存配置</el-button>
              <el-button size="small" type="success" plain :loading="testing === 'wechat_work_webhook'" @click="testChannel('wechat_work_webhook')">
                发送测试
              </el-button>
            </div>
          </el-form>
        </div>

        <!-- Webhook 配置 -->
        <div v-if="channel.key === 'webhook' && notificationsStore.isEnabled(channel.key) && expandedChannels['webhook']" class="channel-config">
          <div class="config-guide">
            <div class="guide-title">配置说明</div>
            <ul class="guide-steps">
              <li>填写接收通知的 HTTP 端点 URL</li>
              <li>支持 GET / POST / PUT 等方法，默认 POST</li>
              <li>自定义请求头使用 JSON 格式，如 <code>{"Authorization": "Bearer token"}</code></li>
              <li v-pre>消息体模板支持变量：<code>{{title}}</code>、<code>{{body}}</code>、<code>{{reminder_id}}</code>，留空则使用默认 JSON 格式</li>
            </ul>
          </div>
          <el-form :model="webhookConfig" label-position="top" size="small">
            <div class="config-row">
              <el-form-item label="Webhook URL" style="grid-column: 1 / -1">
                <el-input v-model="webhookConfig.url" placeholder="https://example.com/webhook" />
              </el-form-item>
            </div>
            <div class="config-row">
              <el-form-item label="请求方法">
                <el-select v-model="webhookConfig.method" style="width: 100%">
                  <el-option label="POST" value="POST" />
                  <el-option label="GET" value="GET" />
                  <el-option label="PUT" value="PUT" />
                  <el-option label="PATCH" value="PATCH" />
                </el-select>
              </el-form-item>
              <el-form-item label="自定义请求头 (JSON)">
                <el-input v-model="webhookConfig.headers" placeholder='{"Authorization": "Bearer xxx"}' />
              </el-form-item>
            </div>
            <el-form-item label="消息体模板（留空使用默认 JSON）">
              <el-input
                v-model="webhookConfig.body_template"
                type="textarea"
                :rows="3"
                placeholder='{"text": "{{title}}: {{body}}"}'
              />
            </el-form-item>
            <div class="config-actions">
              <el-button size="small" @click="saveConfig('webhook', webhookConfig)">保存配置</el-button>
              <el-button size="small" type="success" plain :loading="testing === 'webhook'" @click="testChannel('webhook')">
                发送测试
              </el-button>
            </div>
          </el-form>
        </div>

        <!-- 测试结果 -->
        <div v-if="testResults[channel.key]" class="test-result" :class="testResults[channel.key]?.success ? 'success' : 'error'">
          {{ testResults[channel.key]?.success ? '✓ 测试成功！' : `✗ 测试失败: ${testResults[channel.key]?.error}` }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, watch, reactive } from 'vue'
import { useNotificationsStore } from '@/stores/notifications'
import { CHANNELS } from '@/types/notification'
import { ElMessage } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import wechatWorkIcon from '@/../resources/wechat-work.png'

const notificationsStore = useNotificationsStore()
const testing = ref('')
const testResults = ref<Record<string, { success: boolean; error?: string } | null>>({})
const expandedChannels = reactive<Record<string, boolean>>({})

function toggleExpand(key: string) {
  expandedChannels[key] = !expandedChannels[key]
}

// 各渠道配置
const emailConfig = ref({
  smtp_host: '', smtp_port: 587, smtp_secure: false,
  smtp_user: '', smtp_pass: '', from_address: '', to_addresses: [] as string[]
})
const emailToStr = ref('')

const telegramConfig = ref({ bot_token: '', chat_id: '', proxy_url: '' })
const wechatConfig = ref({ corp_id: '', corp_secret: '', agent_id: '', to_user: '@all' })
const wechatWebhookConfig = ref({ webhook_url: '' })
const webhookConfig = ref({ url: '', method: 'POST', headers: '{}', body_template: '' })

watch(emailToStr, (val) => {
  emailConfig.value.to_addresses = val.split(',').map(s => s.trim()).filter(Boolean)
})

function loadConfigFromStore(channel: string) {
  const config = notificationsStore.getConfig(channel)
  if (!config) return
  try {
    const json = JSON.parse(config.config_json)
    if (channel === 'email') {
      Object.assign(emailConfig.value, json)
      emailToStr.value = (json.to_addresses || []).join(', ')
    } else if (channel === 'telegram') {
      Object.assign(telegramConfig.value, json)
    } else if (channel === 'wechat_work') {
      Object.assign(wechatConfig.value, json)
    } else if (channel === 'wechat_work_webhook') {
      Object.assign(wechatWebhookConfig.value, json)
    } else if (channel === 'webhook') {
      Object.assign(webhookConfig.value, json)
    }
  } catch {}
}

async function handleToggle(channel: string, enabled: boolean) {
  await notificationsStore.updateConfig(channel, { is_enabled: enabled ? 1 : 0 })
  if (enabled) loadConfigFromStore(channel)
}

async function saveConfig(channel: string, config: any) {
  try {
    await notificationsStore.updateConfig(channel, {
      config_json: JSON.stringify(config)
    })
    ElMessage.success('配置已保存')
  } catch (err: any) {
    ElMessage.error(err.message || '保存失败')
  }
}

async function testChannel(channel: string) {
  testing.value = channel
  testResults.value[channel] = null
  try {
    // 先保存最新配置
    const configs: Record<string, any> = {
      email: emailConfig.value,
      telegram: telegramConfig.value,
      wechat_work: wechatConfig.value,
      wechat_work_webhook: wechatWebhookConfig.value,
      webhook: webhookConfig.value
    }
    if (configs[channel]) {
      await notificationsStore.updateConfig(channel, {
        config_json: JSON.stringify(configs[channel])
      })
    }

    const result = await notificationsStore.testChannel(channel)
    testResults.value[channel] = result
    if (result.success) {
      ElMessage.success('测试通知发送成功')
    } else {
      ElMessage.error(`测试失败: ${result.error}`)
    }
  } catch (err: any) {
    testResults.value[channel] = { success: false, error: err.message }
  } finally {
    testing.value = ''
  }
}

onMounted(async () => {
  await notificationsStore.fetchConfigs()
  for (const ch of CHANNELS) {
    loadConfigFromStore(ch.key)
  }
})
</script>

<style scoped>
.notification-settings {
  max-width: 700px;
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

.channel-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.channel-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: 12px;
  padding: 18px 20px;
  transition: all 0.2s ease;
}

.channel-card:hover {
  box-shadow: var(--shadow-sm);
}

.channel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.channel-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.expand-arrow {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  transition: all 0.2s ease;
  color: var(--text-tertiary);
}

.expand-arrow:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.expand-arrow .el-icon {
  transition: transform 0.2s ease;
}

.expand-arrow.expanded .el-icon {
  transform: rotate(180deg);
}

.channel-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.channel-icon {
  font-size: 24px;
}

.channel-icon-img {
  width: 24px;
  height: 24px;
  border-radius: 4px;
}

.channel-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.channel-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.channel-config {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color-light);
}

.config-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.config-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.config-tip {
  font-size: 13px;
  color: var(--text-tertiary);
  line-height: 1.6;
}

.config-guide {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}

.guide-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.guide-steps {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.8;
  padding-left: 18px;
  margin: 0;
}

.guide-steps code {
  background: var(--bg-hover);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 11px;
}

.guide-steps b {
  color: var(--text-secondary);
}

.test-result {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
}

.test-result.success {
  background: rgba(103, 194, 58, 0.1);
  color: #67C23A;
}

.test-result.error {
  background: rgba(245, 108, 108, 0.1);
  color: #F56C6C;
}
</style>
