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
              <img :src="wechatWorkIcon" class="channel-icon-img"/>
            </span>
            <span v-else-if="channel.key === 'wechat_test'" class="channel-icon">
              <img :src="wechatTestIcon" class="channel-icon-img"/>
            </span>
            <span v-else-if="channel.key === 'dingtalk'" class="channel-icon">
              <img :src="dingtalkIcon" class="channel-icon-img"/>
            </span>
            <span v-else-if="channel.key === 'feishu'" class="channel-icon">
              <img :src="feishuIcon" class="channel-icon-img"/>
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
                :disabled="channel.key !== 'desktop' && !isConfigured(channel.key)"
                @change="(val: boolean) => handleToggle(channel.key, val)"
            />
            <el-tooltip
              v-if="channel.key !== 'desktop' && !isConfigured(channel.key)"
              content="请先配置后再启用"
              placement="top"
            >
              <el-icon :size="14" class="config-warn-icon"><WarningFilled/></el-icon>
            </el-tooltip>
            <span
                v-if="(notificationsStore.isEnabled(channel.key) || !isConfigured(channel.key)) && channel.key !== 'desktop'"
                class="expand-arrow"
                :class="{ expanded: expandedChannels[channel.key] }"
                @click="toggleExpand(channel.key)"
            >
              <el-icon :size="16"><ArrowDown/></el-icon>
            </span>
          </div>
        </div>

        <!-- 桌面通知配置 -->
        <div v-if="channel.key === 'desktop' && notificationsStore.isEnabled(channel.key)" class="channel-config">
          <p class="config-tip">桌面通知使用系统原生通知，无需额外配置。</p>
        </div>

        <!-- 邮件配置 -->
        <div v-if="channel.key === 'email' && (notificationsStore.isEnabled(channel.key) || !isConfigured(channel.key)) && expandedChannels['email']"
             class="channel-config">
          <el-form :model="emailConfig" label-position="top" size="small">
            <div class="config-row">
              <el-form-item label="SMTP 服务器">
                <el-input v-model="emailConfig.smtp_host" placeholder="smtp.example.com"/>
              </el-form-item>
              <el-form-item label="端口">
                <el-input-number v-model="emailConfig.smtp_port" :min="1" :max="65535" style="width: 100%;"/>
              </el-form-item>
            </div>
            <el-form-item>
              <el-checkbox v-model="emailConfig.smtp_secure">使用 SSL/TLS</el-checkbox>
            </el-form-item>
            <div class="config-row">
              <el-form-item label="用户名">
                <el-input v-model="emailConfig.smtp_user" placeholder="your@email.com"/>
              </el-form-item>
              <el-form-item label="密码/授权码">
                <el-input v-model="emailConfig.smtp_pass" type="password" show-password placeholder="SMTP密码或授权码"/>
              </el-form-item>
            </div>
            <el-form-item label="发件人地址">
              <el-input v-model="emailConfig.from_address" placeholder="留空则使用用户名"/>
            </el-form-item>
            <el-form-item label="收件人地址（多个用逗号分隔）">
              <el-input v-model="emailToStr" placeholder="多个地址用逗号分隔"/>
            </el-form-item>
            <div class="template-section">
              <div class="template-header" @click="templateExpanded.email = !templateExpanded.email">
                <span class="template-header-title">消息模板</span>
                <el-icon :size="14" class="template-arrow" :class="{ expanded: templateExpanded.email }">
                  <ArrowDown/>
                </el-icon>
              </div>
              <div v-if="templateExpanded.email" class="template-body">
                <div class="template-vars-tip" v-pre>
                  可用变量：<code>{{title}}</code> 标题 · <code>{{body}}</code> 内容 · <code>{{icon}}</code> 图标 ·
                  <code>{{time}}</code> 时间 · <code>{{app_name}}</code> 应用名
                </div>
                <el-form-item label="邮件主题模板">
                  <el-input v-model="emailConfig.subject_template" placeholder="[{{app_name}}] {{title}}"/>
                </el-form-item>
                <el-form-item label="邮件正文模板（HTML）">
                  <el-input v-model="emailConfig.body_template" type="textarea" :rows="5"
                            placeholder="留空使用默认精美模板"/>
                </el-form-item>
              </div>
            </div>
            <div class="config-actions">
              <el-button size="small" @click="saveConfig('email', emailConfig)">保存配置</el-button>
              <el-button size="small" type="success" plain :loading="testing === 'email'" @click="testChannel('email')">
                发送测试
              </el-button>
            </div>
          </el-form>
        </div>

        <!-- Telegram 配置 -->
        <div
            v-if="channel.key === 'telegram' && (notificationsStore.isEnabled(channel.key) || !isConfigured(channel.key)) && expandedChannels['telegram']"
            class="channel-config">
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
              <el-input v-model="telegramConfig.bot_token" placeholder="123456:ABC-DEF..."/>
            </el-form-item>
            <el-form-item label="Chat ID（多个用逗号分隔）">
              <el-input v-model="telegramConfig.chat_id" placeholder="如 123456789 或 123456789,987654321"/>
            </el-form-item>
            <el-form-item label="代理地址（国内网络需要）">
              <el-input v-model="telegramConfig.proxy_url" placeholder="http://127.0.0.1:7890"/>
            </el-form-item>
            <div class="template-section">
              <div class="template-header" @click="templateExpanded.telegram = !templateExpanded.telegram">
                <span class="template-header-title">消息模板</span>
                <el-icon :size="14" class="template-arrow" :class="{ expanded: templateExpanded.telegram }">
                  <ArrowDown/>
                </el-icon>
              </div>
              <div v-if="templateExpanded.telegram" class="template-body">
                <div class="template-vars-tip" v-pre>
                  可用变量：<code>{{title}}</code> 标题 · <code>{{body}}</code> 内容 · <code>{{icon}}</code> 图标 ·
                  <code>{{time}}</code> 时间 · <code>{{app_name}}</code> 应用名。支持 HTML 标签如 <code>&lt;b&gt;</code>
                  <code>&lt;i&gt;</code>
                </div>
                <el-form-item label="消息模板">
                  <el-input v-model="telegramConfig.message_template" type="textarea" :rows="3"
                            placeholder="{{icon}} <b>{{title}}</b>\n\n{{body}}\n\n<i>来自 {{app_name}} · {{time}}</i>"/>
                </el-form-item>
              </div>
            </div>
            <div class="config-actions">
              <el-button size="small" @click="saveConfig('telegram', telegramConfig)">保存配置</el-button>
              <el-button size="small" type="success" plain :loading="testing === 'telegram'"
                         @click="testChannel('telegram')">
                发送测试
              </el-button>
            </div>
          </el-form>
        </div>

        <!-- 企业微信配置 -->
        <div
            v-if="channel.key === 'wechat_work' && (notificationsStore.isEnabled(channel.key) || !isConfigured(channel.key)) && expandedChannels['wechat_work']"
            class="channel-config">
          <el-form :model="wechatConfig" label-position="top" size="small">
            <el-form-item label="企业 ID (Corp ID)">
              <el-input v-model="wechatConfig.corp_id" placeholder="ww..."/>
            </el-form-item>
            <el-form-item label="应用 Secret">
              <el-input v-model="wechatConfig.corp_secret" type="password" show-password placeholder="应用的Secret"/>
            </el-form-item>
            <div class="config-row">
              <el-form-item label="Agent ID">
                <el-input v-model="wechatConfig.agent_id" placeholder="应用ID"/>
              </el-form-item>
              <el-form-item label="接收人（多个用 | 分隔）">
                <el-input v-model="wechatConfig.to_user" placeholder="@all 或 user1|user2"/>
              </el-form-item>
            </div>
            <el-form-item label="消息格式">
              <el-radio-group v-model="wechatConfig.msg_type">
                <el-radio value="text">文本消息</el-radio>
                <el-radio value="markdown">Markdown</el-radio>
              </el-radio-group>
            </el-form-item>
            <div class="template-section">
              <div class="template-header" @click="templateExpanded.wechat_work = !templateExpanded.wechat_work">
                <span class="template-header-title">消息模板</span>
                <el-icon :size="14" class="template-arrow" :class="{ expanded: templateExpanded.wechat_work }">
                  <ArrowDown/>
                </el-icon>
              </div>
              <div v-if="templateExpanded.wechat_work" class="template-body">
                <div class="template-vars-tip" v-pre>
                  可用变量：<code>{{title}}</code> 标题 · <code>{{body}}</code> 内容 · <code>{{icon}}</code> 图标 ·
                  <code>{{time}}</code> 时间 · <code>{{app_name}}</code> 应用名
                </div>
                <el-form-item v-if="wechatConfig.msg_type === 'text'" label="文本消息模板">
                  <el-input v-model="wechatConfig.message_template" type="textarea" :rows="3"
                            placeholder="{{icon}} {{title}}&#10;&#10;{{body}}&#10;&#10;{{app_name}} · {{time}}"/>
                </el-form-item>
                <el-form-item v-else label="Markdown 消息模板">
                  <el-input v-model="wechatConfig.markdown_template" type="textarea" :rows="4"
                            placeholder="# {{icon}} {{title}}&#10;&#10;{{body}}&#10;&#10;> {{app_name}} · {{time}}"/>
                </el-form-item>
              </div>
            </div>
            <div class="config-actions">
              <el-button size="small" @click="saveConfig('wechat_work', wechatConfig)">保存配置</el-button>
              <el-button size="small" type="success" plain :loading="testing === 'wechat_work'"
                         @click="testChannel('wechat_work')">
                发送测试
              </el-button>
            </div>
          </el-form>
        </div>

        <!-- 企业微信消息推送配置 -->
        <div
            v-if="channel.key === 'wechat_work_webhook' && (notificationsStore.isEnabled(channel.key) || !isConfigured(channel.key)) && expandedChannels['wechat_work_webhook']"
            class="channel-config">
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
              <el-input v-model="wechatWebhookConfig.webhook_url"
                        placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"/>
            </el-form-item>
            <el-form-item label="消息格式">
              <el-radio-group v-model="wechatWebhookConfig.msg_type">
                <el-radio value="text">文本消息</el-radio>
                <el-radio value="markdown">Markdown</el-radio>
              </el-radio-group>
            </el-form-item>
            <template v-if="wechatWebhookConfig.msg_type === 'text'">
              <el-form-item label="@提醒">
                <el-radio-group v-model="wechatWebhookConfig.mention_mode">
                  <el-radio value="none">不提醒</el-radio>
                  <el-radio value="all">@所有人</el-radio>
                  <el-radio value="custom">指定成员</el-radio>
                </el-radio-group>
              </el-form-item>
              <div v-if="wechatWebhookConfig.mention_mode === 'custom'" class="config-row">
                <el-form-item label="成员 UserID（逗号分隔）">
                  <el-input v-model="wechatWebhookConfig.mention_userids" placeholder="zhangsan,lisi"/>
                </el-form-item>
                <el-form-item label="成员手机号（逗号分隔）">
                  <el-input v-model="wechatWebhookConfig.mention_mobiles" placeholder="13800138000,13900139000"/>
                </el-form-item>
              </div>
            </template>
            <div class="template-section">
              <div class="template-header"
                   @click="templateExpanded.wechat_work_webhook = !templateExpanded.wechat_work_webhook">
                <span class="template-header-title">消息模板</span>
                <el-icon :size="14" class="template-arrow" :class="{ expanded: templateExpanded.wechat_work_webhook }">
                  <ArrowDown/>
                </el-icon>
              </div>
              <div v-if="templateExpanded.wechat_work_webhook" class="template-body">
                <div class="template-vars-tip" v-pre>
                  可用变量：<code>{{title}}</code> 标题 · <code>{{body}}</code> 内容 · <code>{{icon}}</code> 图标 ·
                  <code>{{time}}</code> 时间 · <code>{{app_name}}</code> 应用名
                </div>
                <el-form-item v-if="wechatWebhookConfig.msg_type === 'text'" label="文本消息模板">
                  <el-input v-model="wechatWebhookConfig.message_template" type="textarea" :rows="3"
                            placeholder="{{icon}} {{title}}&#10;&#10;{{body}}&#10;&#10;{{app_name}} · {{time}}"/>
                </el-form-item>
                <el-form-item v-else label="Markdown 消息模板">
                  <el-input v-model="wechatWebhookConfig.markdown_template" type="textarea" :rows="4"
                            placeholder="# {{icon}} {{title}}&#10;&#10;{{body}}&#10;&#10;> {{app_name}} · {{time}}"/>
                </el-form-item>
              </div>
            </div>
            <div class="config-actions">
              <el-button size="small" @click="saveConfig('wechat_work_webhook', wechatWebhookConfig)">保存配置
              </el-button>
              <el-button size="small" type="success" plain :loading="testing === 'wechat_work_webhook'"
                         @click="testChannel('wechat_work_webhook')">
                发送测试
              </el-button>
            </div>
          </el-form>
        </div>

        <!-- 测试公众号配置 -->
        <div
            v-if="channel.key === 'wechat_test' && (notificationsStore.isEnabled(channel.key) || !isConfigured(channel.key)) && expandedChannels['wechat_test']"
            class="channel-config">
          <div class="config-guide">
            <div class="guide-title">配置步骤</div>
            <ol class="guide-steps">
              <li>访问 <b>微信公众平台测试号</b>（mp.weixin.qq.com/debug/cgi-bin/sandbox?t=sandbox/login）扫码登录</li>
              <li>获取 <b>appID</b> 和 <b>appsecret</b>，填写到下方</li>
              <li>关注测试号二维码，获取 <b>用户 OpenID</b>（多个用逗号分隔）</li>
              <li>如需模板消息：在测试号页面点击"新增测试模板"，模板内容格式如 <code v-pre>{{first.DATA}}</code> <code v-pre>{{keyword1.DATA}}</code> <code v-pre>{{remark.DATA}}</code>，每个 <code v-pre>{{xxx.DATA}}</code> 对应下方一个字段名 <code>xxx</code></li>
            </ol>
          </div>
          <el-form :model="wechatTestConfig" label-position="top" size="small">
            <div class="config-row">
              <el-form-item label="AppID">
                <el-input v-model="wechatTestConfig.app_id" placeholder="wx..."/>
              </el-form-item>
              <el-form-item label="AppSecret">
                <el-input v-model="wechatTestConfig.app_secret" type="password" show-password placeholder="应用密钥"/>
              </el-form-item>
            </div>
            <el-form-item label="接收人 OpenID（多个用逗号分隔）">
              <el-input v-model="wechatTestConfig.to_openid" placeholder="oXXXX1,oXXXX2"/>
            </el-form-item>
            <el-form-item label="消息格式">
              <el-radio-group v-model="wechatTestConfig.msg_type">
                <el-radio value="text">客服消息（文本）</el-radio>
                <el-radio value="template">模板消息</el-radio>
              </el-radio-group>
            </el-form-item>
            <template v-if="wechatTestConfig.msg_type === 'template'">
              <div class="config-row">
                <el-form-item label="模板 ID">
                  <el-input v-model="wechatTestConfig.template_id" placeholder="模板消息ID"/>
                </el-form-item>
                <el-form-item label="模板跳转 URL（可选）">
                  <el-input v-model="wechatTestConfig.template_url" placeholder="https://..."/>
                </el-form-item>
              </div>
              <div class="template-fields-section">
                <div class="template-fields-header">
                  <span class="template-header-title">模板字段</span>
                </div>
                <div class="template-vars-tip">
                  对应微信模板中的变量：<code>字段名</code> 就是模板里 <code v-pre>{{xxx.DATA}}</code> 中的 <code>xxx</code>，<code>字段值</code> 支持变量
                  <code v-pre>{{title}}</code> <code v-pre>{{body}}</code> <code v-pre>{{icon}}</code> <code v-pre>{{time}}</code> <code v-pre>{{app_name}}</code>，<code>颜色</code> 可点击色块选择（可留空）
                </div>
                <div class="template-example">
                  例：微信模板内容为 <code v-pre>{{first.DATA}} 标题：{{keyword1.DATA}} {{remark.DATA}}</code>，则下方填 3 行：first / keyword1 / remark
                </div>
                <div v-for="(field, index) in wechatTestTemplateFields" :key="index" class="template-field-row">
                  <el-input v-model="field.key" placeholder="字段名，如 keyword1" class="field-key"/>
                  <el-input v-model="field.value" placeholder="字段值，如 &#123;&#123;title&#125;&#125;" class="field-value"/>
                  <el-color-picker v-model="field.color" size="small" class="field-color" show-alpha/>
                  <el-button :icon="Delete" size="small" circle @click="wechatTestTemplateFields.splice(index, 1)"/>
                </div>
                <el-button size="small" @click="wechatTestTemplateFields.push({key: '', value: '', color: ''})">
                  + 添加字段
                </el-button>
              </div>
            </template>
            <div class="template-section" v-if="wechatTestConfig.msg_type === 'text'">
              <div class="template-header" @click="templateExpanded.wechat_test = !templateExpanded.wechat_test">
                <span class="template-header-title">消息模板</span>
                <el-icon :size="14" class="template-arrow" :class="{ expanded: templateExpanded.wechat_test }">
                  <ArrowDown/>
                </el-icon>
              </div>
              <div v-if="templateExpanded.wechat_test" class="template-body">
                <div class="template-vars-tip" v-pre>
                  可用变量：<code>{{title}}</code> 标题 · <code>{{body}}</code> 内容 · <code>{{icon}}</code> 图标 ·
                  <code>{{time}}</code> 时间 · <code>{{app_name}}</code> 应用名
                </div>
                <el-form-item label="文本消息模板">
                  <el-input v-model="wechatTestConfig.message_template" type="textarea" :rows="3"
                            placeholder="{{icon}} {{title}}&#10;&#10;{{body}}&#10;&#10;{{app_name}} · {{time}}"/>
                </el-form-item>
              </div>
            </div>
            <div class="config-actions">
              <el-button size="small" @click="saveWechatTestConfig">保存配置</el-button>
              <el-button size="small" type="success" plain :loading="testing === 'wechat_test'"
                         @click="testChannel('wechat_test')">
                发送测试
              </el-button>
            </div>
          </el-form>
        </div>

        <!-- 钉钉群机器人配置 -->
        <div
            v-if="channel.key === 'dingtalk' && (notificationsStore.isEnabled(channel.key) || !isConfigured(channel.key)) && expandedChannels['dingtalk']"
            class="channel-config">
          <div class="config-guide">
            <div class="guide-title">配置步骤</div>
            <ol class="guide-steps">
              <li>在钉钉群聊中，点击右上角 <b>群设置</b> → <b>智能群助手</b> → <b>添加机器人</b> → <b>自定义</b></li>
              <li>创建后复制 <b>Webhook 地址</b>，粘贴到下方</li>
              <li>如需安全验证，勾选"加签"并复制 <b>签名密钥</b> 填入下方</li>
            </ol>
          </div>
          <el-form :model="dingtalkConfig" label-position="top" size="small">
            <el-form-item label="Webhook URL">
              <el-input v-model="dingtalkConfig.webhook_url"
                        placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxx"/>
            </el-form-item>
            <el-form-item label="签名密钥（加签验证，可选）">
              <el-input v-model="dingtalkConfig.secret" type="password" show-password placeholder="SEC..."/>
            </el-form-item>
            <el-form-item label="消息格式">
              <el-radio-group v-model="dingtalkConfig.msg_type">
                <el-radio value="text">文本消息</el-radio>
                <el-radio value="markdown">Markdown</el-radio>
              </el-radio-group>
            </el-form-item>
            <template v-if="dingtalkConfig.msg_type === 'text'">
              <el-form-item label="@提醒">
                <el-radio-group v-model="dingtalkConfig.mention_mode">
                  <el-radio value="none">不提醒</el-radio>
                  <el-radio value="all">@所有人</el-radio>
                  <el-radio value="custom">指定成员</el-radio>
                </el-radio-group>
              </el-form-item>
              <div v-if="dingtalkConfig.mention_mode === 'custom'" class="config-row">
                <el-form-item label="手机号（逗号分隔）">
                  <el-input v-model="dingtalkConfig.mention_mobiles" placeholder="13800138000"/>
                </el-form-item>
                <el-form-item label="UserID（逗号分隔）">
                  <el-input v-model="dingtalkConfig.mention_userids" placeholder="zhangsan"/>
                </el-form-item>
              </div>
            </template>
            <div class="template-section">
              <div class="template-header" @click="templateExpanded.dingtalk = !templateExpanded.dingtalk">
                <span class="template-header-title">消息模板</span>
                <el-icon :size="14" class="template-arrow" :class="{ expanded: templateExpanded.dingtalk }">
                  <ArrowDown/>
                </el-icon>
              </div>
              <div v-if="templateExpanded.dingtalk" class="template-body">
                <div class="template-vars-tip" v-pre>
                  可用变量：<code>{{title}}</code> 标题 · <code>{{body}}</code> 内容 · <code>{{icon}}</code> 图标 ·
                  <code>{{time}}</code> 时间 · <code>{{app_name}}</code> 应用名
                </div>
                <el-form-item v-if="dingtalkConfig.msg_type === 'text'" label="文本消息模板">
                  <el-input v-model="dingtalkConfig.message_template" type="textarea" :rows="3"/>
                </el-form-item>
                <el-form-item v-else label="Markdown 消息模板">
                  <el-input v-model="dingtalkConfig.markdown_template" type="textarea" :rows="4"/>
                </el-form-item>
              </div>
            </div>
            <div class="config-actions">
              <el-button size="small" @click="saveConfig('dingtalk', dingtalkConfig)">保存配置</el-button>
              <el-button size="small" type="success" plain :loading="testing === 'dingtalk'"
                         @click="testChannel('dingtalk')">发送测试</el-button>
            </div>
          </el-form>
        </div>

        <!-- 飞书群机器人配置 -->
        <div
            v-if="channel.key === 'feishu' && (notificationsStore.isEnabled(channel.key) || !isConfigured(channel.key)) && expandedChannels['feishu']"
            class="channel-config">
          <div class="config-guide">
            <div class="guide-title">配置步骤</div>
            <ol class="guide-steps">
              <li>在飞书群聊中，点击右上角 <b>设置</b> → <b>群机器人</b> → <b>添加机器人</b> → <b>自定义机器人</b></li>
              <li>创建后复制 <b>Webhook 地址</b>，粘贴到下方</li>
            </ol>
          </div>
          <el-form :model="feishuConfig" label-position="top" size="small">
            <el-form-item label="Webhook URL">
              <el-input v-model="feishuConfig.webhook_url"
                        placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxx"/>
            </el-form-item>
            <el-form-item label="消息格式">
              <el-radio-group v-model="feishuConfig.msg_type">
                <el-radio value="text">文本消息</el-radio>
                <el-radio value="interactive">富文本（Markdown）</el-radio>
              </el-radio-group>
            </el-form-item>
            <div class="template-section">
              <div class="template-header" @click="templateExpanded.feishu = !templateExpanded.feishu">
                <span class="template-header-title">消息模板</span>
                <el-icon :size="14" class="template-arrow" :class="{ expanded: templateExpanded.feishu }">
                  <ArrowDown/>
                </el-icon>
              </div>
              <div v-if="templateExpanded.feishu" class="template-body">
                <div class="template-vars-tip" v-pre>
                  可用变量：<code>{{title}}</code> 标题 · <code>{{body}}</code> 内容 · <code>{{icon}}</code> 图标 ·
                  <code>{{time}}</code> 时间 · <code>{{app_name}}</code> 应用名
                </div>
                <el-form-item label="消息模板">
                  <el-input v-model="feishuConfig.message_template" type="textarea" :rows="3"/>
                </el-form-item>
              </div>
            </div>
            <div class="config-actions">
              <el-button size="small" @click="saveConfig('feishu', feishuConfig)">保存配置</el-button>
              <el-button size="small" type="success" plain :loading="testing === 'feishu'"
                         @click="testChannel('feishu')">发送测试</el-button>
            </div>
          </el-form>
        </div>

        <!-- Bark 配置 -->
        <div
            v-if="channel.key === 'bark' && (notificationsStore.isEnabled(channel.key) || !isConfigured(channel.key)) && expandedChannels['bark']"
            class="channel-config">
          <div class="config-guide">
            <div class="guide-title">配置步骤</div>
            <ol class="guide-steps">
              <li>在 App Store 搜索 <b>Bark</b> 下载安装</li>
              <li>打开 Bark App，复制显示的服务器地址（如 <code>https://api.day.app/你的Key</code>）</li>
              <li>将服务器地址填入下方（格式：<code>https://api.day.app</code> 或自建地址）</li>
              <li>如需自建服务端，参考 <b>github.com/Finb/Bark</b></li>
            </ol>
          </div>
          <el-form :model="barkConfig" label-position="top" size="small">
            <el-form-item label="服务器地址">
              <el-input v-model="barkConfig.server_url" placeholder="https://api.day.app"/>
            </el-form-item>
            <div class="config-row">
              <el-form-item label="提示音">
                <el-input v-model="barkConfig.sound" placeholder="alarm"/>
              </el-form-item>
              <el-form-item label="消息分组">
                <el-input v-model="barkConfig.group" placeholder="king-remind"/>
              </el-form-item>
            </div>
            <el-form-item label="点击跳转 URL（可选）">
              <el-input v-model="barkConfig.url" placeholder="https://..."/>
            </el-form-item>
            <div class="config-actions">
              <el-button size="small" @click="saveConfig('bark', barkConfig)">保存配置</el-button>
              <el-button size="small" type="success" plain :loading="testing === 'bark'"
                         @click="testChannel('bark')">发送测试</el-button>
            </div>
          </el-form>
        </div>

        <!-- Discord 配置 -->
        <div
            v-if="channel.key === 'discord' && (notificationsStore.isEnabled(channel.key) || !isConfigured(channel.key)) && expandedChannels['discord']"
            class="channel-config">
          <div class="config-guide">
            <div class="guide-title">配置步骤</div>
            <ol class="guide-steps">
              <li>在 Discord 频道设置中，点击 <b>整合</b> → <b>Webhook</b> → <b>新建 Webhook</b></li>
              <li>复制 <b>Webhook URL</b>，粘贴到下方</li>
            </ol>
          </div>
          <el-form :model="discordConfig" label-position="top" size="small">
            <el-form-item label="Webhook URL">
              <el-input v-model="discordConfig.webhook_url"
                        placeholder="https://discord.com/api/webhooks/xxx/yyy"/>
            </el-form-item>
            <div class="config-row">
              <el-form-item label="机器人名称">
                <el-input v-model="discordConfig.username" placeholder="king提醒助手"/>
              </el-form-item>
              <el-form-item label="头像 URL（可选）">
                <el-input v-model="discordConfig.avatar_url" placeholder="https://..."/>
              </el-form-item>
            </div>
            <div class="template-section">
              <div class="template-header" @click="templateExpanded.discord = !templateExpanded.discord">
                <span class="template-header-title">消息模板</span>
                <el-icon :size="14" class="template-arrow" :class="{ expanded: templateExpanded.discord }">
                  <ArrowDown/>
                </el-icon>
              </div>
              <div v-if="templateExpanded.discord" class="template-body">
                <div class="template-vars-tip" v-pre>
                  可用变量：<code>{{title}}</code> 标题 · <code>{{body}}</code> 内容 · <code>{{icon}}</code> 图标 ·
                  <code>{{time}}</code> 时间 · <code>{{app_name}}</code> 应用名。支持 Markdown 如 <code>**粗体**</code>
                  <code>_斜体_</code>
                </div>
                <el-form-item label="消息模板">
                  <el-input v-model="discordConfig.message_template" type="textarea" :rows="3"/>
                </el-form-item>
              </div>
            </div>
            <div class="config-actions">
              <el-button size="small" @click="saveConfig('discord', discordConfig)">保存配置</el-button>
              <el-button size="small" type="success" plain :loading="testing === 'discord'"
                         @click="testChannel('discord')">发送测试</el-button>
            </div>
          </el-form>
        </div>

        <!-- Webhook 配置 -->
        <div
            v-if="channel.key === 'webhook' && (notificationsStore.isEnabled(channel.key) || !isConfigured(channel.key)) && expandedChannels['webhook']"
            class="channel-config">
          <div class="config-guide">
            <div class="guide-title">配置说明</div>
            <ul class="guide-steps">
              <li>填写接收通知的 HTTP 端点 URL</li>
              <li>支持 GET / POST / PUT 等方法，默认 POST</li>
              <li>自定义请求头使用 JSON 格式，如 <code>{"Authorization": "Bearer token"}</code></li>
              <li v-pre>消息体模板支持变量：<code>{{title}}</code>、<code>{{body}}</code>、<code>{{reminder_id}}</code>，留空则使用默认
                JSON 格式
              </li>
            </ul>
          </div>
          <el-form :model="webhookConfig" label-position="top" size="small">
            <div class="config-row">
              <el-form-item label="Webhook URL" style="grid-column: 1 / -1">
                <el-input v-model="webhookConfig.url" placeholder="https://example.com/webhook"/>
              </el-form-item>
            </div>
            <div class="config-row">
              <el-form-item label="请求方法">
                <el-select v-model="webhookConfig.method" style="width: 100%">
                  <el-option label="POST" value="POST"/>
                  <el-option label="GET" value="GET"/>
                  <el-option label="PUT" value="PUT"/>
                  <el-option label="PATCH" value="PATCH"/>
                </el-select>
              </el-form-item>
              <el-form-item label="自定义请求头 (JSON)">
                <el-input v-model="webhookConfig.headers" placeholder='{"Authorization": "Bearer xxx"}'/>
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
              <el-button size="small" type="success" plain :loading="testing === 'webhook'"
                         @click="testChannel('webhook')">
                发送测试
              </el-button>
            </div>
          </el-form>
        </div>

        <!-- 测试结果 -->
        <div v-if="testResults[channel.key]" class="test-result"
             :class="testResults[channel.key]?.success ? 'success' : 'error'">
          {{ testResults[channel.key]?.success ? '✓ 测试成功！' : `✗ 测试失败: ${testResults[channel.key]?.error}` }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {onMounted, reactive, ref, watch} from 'vue'
import {useNotificationsStore} from '@/stores/notifications'
import {CHANNELS} from '@/types/notification'
import {ElMessage} from 'element-plus'
import {ArrowDown, WarningFilled, Delete} from '@element-plus/icons-vue'
import wechatWorkIcon from '@/../resources/wechat-work.png'
import wechatTestIcon from '@/../resources/wechat.png'
import dingtalkIcon from '@/../resources/dingding.ico'
import feishuIcon from '@/../resources/feishu.png'

const notificationsStore = useNotificationsStore()
const testing = ref('')
const testResults = ref<Record<string, { success: boolean; error?: string } | null>>({})
const expandedChannels = reactive<Record<string, boolean>>({})
const templateExpanded = reactive<Record<string, boolean>>({})

function toggleExpand(key: string) {
  expandedChannels[key] = !expandedChannels[key]
}

// 各渠道配置
const emailConfig = ref({
  smtp_host: '', smtp_port: 587, smtp_secure: false,
  smtp_user: '', smtp_pass: '', from_address: '', to_addresses: [] as string[],
  subject_template: '', body_template: ''
})
const emailToStr = ref('')

const telegramConfig = ref({bot_token: '', chat_id: '', proxy_url: '', message_template: ''})
const wechatConfig = ref({
  corp_id: '',
  corp_secret: '',
  agent_id: '',
  to_user: '@all',
  msg_type: 'text',
  message_template: '',
  markdown_template: ''
})
const wechatWebhookConfig = ref({
  webhook_url: '',
  msg_type: 'text',
  mention_mode: 'none',
  mention_userids: '',
  mention_mobiles: '',
  message_template: '',
  markdown_template: ''
})
const webhookConfig = ref({url: '', method: 'POST', headers: '{}', body_template: ''})
const dingtalkConfig = ref({
  webhook_url: '',
  msg_type: 'text',
  secret: '',
  mention_mode: 'none',
  mention_mobiles: '',
  mention_userids: '',
  message_template: '',
  markdown_template: ''
})
const feishuConfig = ref({
  webhook_url: '',
  msg_type: 'text',
  message_template: ''
})
const barkConfig = ref({server_url: '', sound: 'alarm', group: 'king-remind', url: '', message_template: ''})
const discordConfig = ref({webhook_url: '', username: 'king提醒助手', avatar_url: '', message_template: ''})
const wechatTestConfig = ref({
  app_id: '',
  app_secret: '',
  to_openid: '',
  msg_type: 'text',
  template_id: '',
  template_url: '',
  message_template: ''
})
const wechatTestTemplateFields = ref<Array<{key: string; value: string; color: string}>>([
  {key: 'first', value: '{{icon}} {{title}}', color: ''},
  {key: 'keyword1', value: '{{body}}', color: ''},
  {key: 'remark', value: '{{app_name}} · {{time}}', color: ''}
])

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
    } else if (channel === 'wechat_test') {
      Object.assign(wechatTestConfig.value, json)
      if (json.template_fields && Array.isArray(json.template_fields)) {
        wechatTestTemplateFields.value = json.template_fields
      }
    } else if (channel === 'webhook') {
      Object.assign(webhookConfig.value, json)
    } else if (channel === 'dingtalk') {
      Object.assign(dingtalkConfig.value, json)
    } else if (channel === 'feishu') {
      Object.assign(feishuConfig.value, json)
    } else if (channel === 'bark') {
      Object.assign(barkConfig.value, json)
    } else if (channel === 'discord') {
      Object.assign(discordConfig.value, json)
    }
  } catch {
  }
}

function isConfigured(channel: string): boolean {
  if (channel === 'desktop') return true
  if (channel === 'email') {
    return !!(emailConfig.value.smtp_host && emailConfig.value.smtp_user && emailConfig.value.smtp_pass)
  }
  if (channel === 'telegram') {
    return !!(telegramConfig.value.bot_token && telegramConfig.value.chat_id)
  }
  if (channel === 'wechat_work') {
    return !!(wechatConfig.value.corp_id && wechatConfig.value.corp_secret && wechatConfig.value.agent_id)
  }
  if (channel === 'wechat_work_webhook') {
    return !!wechatWebhookConfig.value.webhook_url
  }
  if (channel === 'wechat_test') {
    return !!(wechatTestConfig.value.app_id && wechatTestConfig.value.app_secret && wechatTestConfig.value.to_openid)
  }
  if (channel === 'webhook') {
    return !!webhookConfig.value.url
  }
  if (channel === 'dingtalk') {
    return !!dingtalkConfig.value.webhook_url
  }
  if (channel === 'feishu') {
    return !!feishuConfig.value.webhook_url
  }
  if (channel === 'bark') {
    return !!barkConfig.value.server_url
  }
  if (channel === 'discord') {
    return !!discordConfig.value.webhook_url
  }
  return false
}

async function handleToggle(channel: string, enabled: boolean) {
  await notificationsStore.updateConfig(channel, {is_enabled: enabled ? 1 : 0})
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

async function saveWechatTestConfig() {
  try {
    const config = {
      ...wechatTestConfig.value,
      template_fields: wechatTestTemplateFields.value
    }
    await notificationsStore.updateConfig('wechat_test', {
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
      wechat_test: {...wechatTestConfig.value, template_fields: wechatTestTemplateFields.value},
      webhook: webhookConfig.value,
      dingtalk: dingtalkConfig.value,
      feishu: feishuConfig.value,
      bark: barkConfig.value,
      discord: discordConfig.value
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
    testResults.value[channel] = {success: false, error: err.message}
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

.config-warn-icon {
  color: var(--el-color-warning, #E6A23C);
  cursor: default;
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

.template-section {
  margin-top: 8px;
  border: 1px solid var(--border-color-light);
  border-radius: 8px;
  overflow: hidden;
}

.template-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: pointer;
  background: var(--bg-secondary);
  transition: background 0.2s ease;
}

.template-header:hover {
  background: var(--bg-hover);
}

.template-header-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.template-arrow {
  transition: transform 0.2s ease;
  color: var(--text-tertiary);
}

.template-arrow.expanded {
  transform: rotate(180deg);
}

.template-body {
  padding: 14px;
}

.template-vars-tip {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 12px;
  line-height: 1.6;
}

.template-vars-tip code {
  background: var(--bg-hover);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 11px;
  color: var(--text-secondary);
}

.template-fields-section {
  margin-top: 8px;
  padding: 14px;
  border: 1px solid var(--border-color-light);
  border-radius: 8px;
}

.template-fields-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}

.template-fields-tip {
  font-size: 11px;
  color: var(--text-tertiary);
}

.template-example {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  line-height: 1.6;
}

.template-example code {
  background: var(--bg-hover);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 11px;
  color: var(--text-secondary);
}

.template-field-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.field-key {
  width: 140px;
  flex-shrink: 0;
}

.field-value {
  flex: 1;
}

.field-color {
  width: 120px;
  flex-shrink: 0;
}
</style>
