<template>
  <div class="system-section">
    <div class="section-header">
      <div>
        <h2 class="section-title">系统设置</h2>
        <p class="section-subtitle">自定义应用行为和外观</p>
      </div>
    </div>

    <div class="settings-list">
      <!-- 用户信息 -->
      <div class="setting-section">
        <h3 class="section-title">用户信息</h3>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">称呼</div>
            <div class="setting-desc">AI 会用这个昵称呼叫你</div>
          </div>
          <div class="setting-actions">
            <el-input
                :model-value="settingsStore.settings.user_nickname || ''"
                @change="(val: string) => settingsStore.setSetting('user_nickname', val)"
                placeholder="输入称呼"
                size="small"
                style="width: 160px;"
            />
          </div>
        </div>
      </div>

      <!-- 使用模式 -->
      <div class="setting-section">
        <h3 class="section-title">使用模式</h3>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">应用模式</div>
            <div class="setting-desc">切换提醒工具或 AI 提醒模式，切换后需刷新页面生效</div>
          </div>
          <div class="setting-actions">
            <el-select
              :model-value="settingsStore.settings.app_mode || 'simple'"
              @change="onAppModeChange"
              size="small"
              style="width: 140px;"
            >
              <el-option label="AI 模式" value="ai"/>
              <el-option label="普通模式" value="simple"/>
            </el-select>
          </div>
        </div>
      </div>

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
              @change="onLaunchAtStartupChange"
          />
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">关闭时最小化到托盘</div>
            <div class="setting-desc">点击关闭按钮时隐藏到系统托盘而非退出</div>
          </div>
          <el-switch
              :model-value="settingsStore.settings.minimize_to_tray !== 'false'"
              @change="onMinimizeToTrayChange"
          />
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">通知关闭时间</div>
            <div class="setting-desc">桌面提醒弹窗的自动关闭时间</div>
          </div>
          <el-select
              :model-value="settingsStore.settings.notification_duration || '5000'"
              @change="(val: string) => settingsStore.setSetting('notification_duration', val)"
              size="small"
              style="width: 160px;"
          >
            <el-option label="5 秒" value="5000"/>
            <el-option label="1 分钟" value="60000"/>
            <el-option label="3 分钟" value="180000"/>
            <el-option label="5 分钟" value="300000"/>
            <el-option label="手动关闭" value="0"/>
          </el-select>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">通知提示音</div>
            <div class="setting-desc">桌面通知时播放的提示音类型</div>
          </div>
          <div class="setting-actions">
            <el-select
                :model-value="settingsStore.settings.notification_sound || 'on'"
                @change="(val: string) => settingsStore.setSetting('notification_sound', val)"
                size="small"
                style="width: 130px;"
            >
              <el-option label="内置音效" value="on"/>
              <el-option label="系统提示音" value="system"/>
              <el-option label="自定义音乐" value="custom"/>
              <el-option label="关闭" value="off"/>
            </el-select>
            <el-button size="small" plain @click="previewSound" :disabled="(settingsStore.settings.notification_sound || 'on') === 'off'">试听</el-button>
          </div>
        </div>

        <div class="setting-item" v-if="(settingsStore.settings.notification_sound || 'on') === 'custom'">
          <div class="setting-info">
            <div class="setting-label">自定义提示音文件</div>
            <div class="setting-desc">{{ settingsStore.settings.notification_sound_file || '未选择' }}</div>
          </div>
          <el-button size="small" plain @click="selectSoundFile">选择文件</el-button>
        </div>

        <div class="setting-item" v-if="behaviorNeedsRestart">
          <div class="setting-info">
            <div class="setting-label" style="color: #E6A23C;">配置已修改</div>
            <div class="setting-desc">行为设置已更改，需重启应用生效</div>
          </div>
          <el-button type="warning" size="small" @click="restartApp">重启应用</el-button>
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

      <!-- 待办通知 -->
      <div class="setting-section">
        <h3 class="section-title">待办通知</h3>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">截止日提醒</div>
            <div class="setting-desc">待办截止日期当天未完成时发送通知提醒</div>
          </div>
          <el-switch
              :model-value="settingsStore.settings.todo_notify_enabled === 'true'"
              @change="(val: boolean) => settingsStore.setSetting('todo_notify_enabled', String(val))"
          />
        </div>

        <template v-if="settingsStore.settings.todo_notify_enabled === 'true'">
          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">通知时间</div>
              <div class="setting-desc">截止日当天几点发送提醒</div>
            </div>
            <el-select
                :model-value="settingsStore.settings.todo_notify_time || '18:00'"
                @change="(val: string) => settingsStore.setSetting('todo_notify_time', val)"
                size="small"
                style="width: 120px;"
            >
              <el-option v-for="t in todoNotifyTimes" :key="t" :label="t" :value="t"/>
            </el-select>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">通知渠道</div>
              <div class="setting-desc">选择发送截止日提醒的通知渠道</div>
            </div>
            <el-select
                :model-value="todoNotifyChannels"
                @change="onTodoNotifyChannelsChange"
                multiple
                size="small"
                style="width: 260px;"
                collapse-tags
                collapse-tags-tooltip
            >
              <el-option v-for="ch in todoChannelOptions" :key="ch.key" :label="ch.icon + ' ' + ch.name" :value="ch.key"/>
            </el-select>
          </div>
        </template>

        <div class="setting-item" style="margin-top: 16px;">
          <div class="setting-info">
            <div class="setting-label">每日总结提醒</div>
            <div class="setting-desc">每天定时提醒还有多少待办未完成</div>
          </div>
          <el-switch
              :model-value="settingsStore.settings.todo_summary_enabled === 'true'"
              @change="(val: boolean) => settingsStore.setSetting('todo_summary_enabled', String(val))"
          />
        </div>

        <template v-if="settingsStore.settings.todo_summary_enabled === 'true'">
          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">总结时间</div>
              <div class="setting-desc">每天几点发送待办总结</div>
            </div>
            <el-select
                :model-value="settingsStore.settings.todo_summary_time || '18:00'"
                @change="(val: string) => settingsStore.setSetting('todo_summary_time', val)"
                size="small"
                style="width: 120px;"
            >
              <el-option v-for="t in todoNotifyTimes" :key="t" :label="t" :value="t"/>
            </el-select>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">通知渠道</div>
              <div class="setting-desc">选择发送待办总结的通知渠道</div>
            </div>
            <el-select
                :model-value="todoSummaryChannels"
                @change="onTodoSummaryChannelsChange"
                multiple
                size="small"
                style="width: 260px;"
                collapse-tags
                collapse-tags-tooltip
            >
              <el-option v-for="ch in todoChannelOptions" :key="ch.key" :label="ch.icon + ' ' + ch.name" :value="ch.key"/>
            </el-select>
          </div>
        </template>
      </div>

      <!-- API 接口设置 -->
      <div class="setting-section">
        <h3 class="section-title">API 接口</h3>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">启用后台 API 接口</div>
            <div class="setting-desc">允许外部程序通过 HTTP 接口创建和管理提醒</div>
          </div>
          <el-switch
              :model-value="settingsStore.settings.api_enabled === 'true'"
              @change="onApiEnabledChange"
          />
        </div>

        <template v-if="settingsStore.settings.api_enabled === 'true'">
          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">监听端口</div>
              <div class="setting-desc">API 服务监听的端口号</div>
            </div>
            <el-input-number
                :model-value="Number(settingsStore.settings.api_port || 33333)"
                :min="1024"
                :max="65535"
                size="small"
                controls-position="right"
                @change="(val: number) => onApiSettingChange('api_port', String(val))"
            />
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">监听地址</div>
              <div class="setting-desc"><span class="api-code">0.0.0.0</span> 允许外部访问，<span class="api-code">127.0.0.1</span>
                仅本机
              </div>
            </div>
            <el-input
                :model-value="settingsStore.settings.api_host || '0.0.0.0'"
                @change="(val: string) => onApiSettingChange('api_host', val)"
                size="small"
                style="width: 160px;"
            />
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">访问令牌（Token）</div>
              <div class="setting-desc">留空则不校验，建议设置以保证安全</div>
            </div>
            <el-input
                :model-value="settingsStore.settings.api_token || ''"
                @change="(val: string) => onApiSettingChange('api_token', val)"
                placeholder="留空则不校验"
                size="small"
                show-password
                style="width: 160px;"
            />
          </div>

          <!-- API 文档 - 默认收缩可展开 -->
          <div class="api-doc-collapse">
            <div class="api-doc-header" @click="showApiDoc = !showApiDoc">
              <span class="api-doc-title">API 接口文档</span>
              <el-icon :class="{ 'rotate-icon': showApiDoc }">
                <ArrowDown/>
              </el-icon>
            </div>

            <transition name="doc-slide">
              <div v-if="showApiDoc" class="api-doc-body">
                <div class="api-doc">
                  <p class="api-intro">
                    应用已在本地开启 HTTP 服务，外部程序（脚本、AI Agent、自动化工具等）可通过该接口创建和管理提醒，也可通过
                    AI 对话接口用自然语言创建提醒。
                  </p>

                  <!-- 基本信息 -->
                  <div class="api-row">
                    <span class="api-label">服务地址</span>
                    <span class="api-value api-code">http://{{
                        settingsStore.settings.api_host || '0.0.0.0'
                      }}:{{ settingsStore.settings.api_port || '33333' }}</span>
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
                    <span class="api-endpoint-desc">健康检查</span>
                  </div>

                  <div class="api-endpoint">
                    <span class="api-method post">POST</span>
                    <span class="api-path">/api/reminders</span>
                    <span class="api-endpoint-desc">创建提醒</span>
                  </div>

                  <div class="api-endpoint">
                    <span class="api-method get">GET</span>
                    <span class="api-path">/api/reminders</span>
                    <span class="api-endpoint-desc">查询提醒列表</span>
                  </div>

                  <div class="api-endpoint">
                    <span class="api-method get">GET</span>
                    <span class="api-path">/api/reminders/:id</span>
                    <span class="api-endpoint-desc">获取单条提醒</span>
                  </div>

                  <div class="api-endpoint">
                    <span class="api-method delete">DELETE</span>
                    <span class="api-path">/api/reminders/:id</span>
                    <span class="api-endpoint-desc">删除提醒</span>
                  </div>

                  <div class="api-endpoint">
                    <span class="api-method post">POST</span>
                    <span class="api-path">/api/chat</span>
                    <span class="api-endpoint-desc">AI 对话（可通过自然语言创建提醒）</span>
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
                      <span class="api-field-desc"><span class="api-code">interval</span>（周期循环）或 <span
                          class="api-code">scheduled</span>（定时一次）</span>
                    </div>
                    <div class="api-field-row">
                      <span class="api-field-name api-code">start_time</span>
                      <span class="api-field-type">string</span>
                      <span class="api-field-req req">✅</span>
                      <span class="api-field-desc">开始时间，ISO 8601，如 <span
                          class="api-code">2025-03-20T09:00:00</span></span>
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
                      <span class="api-field-desc"><span class="api-code">minutes</span> / <span
                          class="api-code">hours</span> / <span class="api-code">days</span> / <span class="api-code">months</span> / <span
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
                          class="api-code">01-01</span></span>
                    </div>
                    <div class="api-field-row">
                      <span class="api-field-name api-code">active_hours_start</span>
                      <span class="api-field-type">string</span>
                      <span class="api-field-req">-</span>
                      <span class="api-field-desc">活跃时段开始，格式 <span class="api-code">HH:mm</span></span>
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
                          class="api-code">desktop</span> / <span class="api-code">email</span> / <span
                          class="api-code">telegram</span> / <span class="api-code">wechat_work</span> / <span
                          class="api-code">wechat_work_webhook</span> / <span class="api-code">webhook</span></span>
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

                  <!-- AI 对话接口 -->
                  <div class="api-endpoints-title" style="margin-top:14px;">POST /api/chat - AI 对话接口</div>
                  <p class="api-intro">
                    通过 AI 对话接口，可以用自然语言创建提醒。AI 会自动识别意图并调用对应的工具。适合集成到外部 AI Agent
                    或自动化流程中。
                  </p>

                  <div class="api-fields-table">
                    <div class="api-field-row api-field-header">
                      <span class="api-field-name">字段</span>
                      <span class="api-field-type">类型</span>
                      <span class="api-field-req">必填</span>
                      <span class="api-field-desc">说明</span>
                    </div>
                    <div class="api-field-row">
                      <span class="api-field-name api-code">message</span>
                      <span class="api-field-type">string</span>
                      <span class="api-field-req req">✅</span>
                      <span class="api-field-desc">用户消息，如 "每30分钟提醒我喝水"</span>
                    </div>
                    <div class="api-field-row">
                      <span class="api-field-name api-code">model_config_id</span>
                      <span class="api-field-type">number</span>
                      <span class="api-field-req">-</span>
                      <span class="api-field-desc">模型配置 ID，不传则使用默认模型</span>
                    </div>
                    <div class="api-field-row">
                      <span class="api-field-name api-code">history</span>
                      <span class="api-field-type">array</span>
                      <span class="api-field-req">-</span>
                      <span class="api-field-desc">对话历史 <span class="api-code">[{role, content}]</span>，支持多轮对话</span>
                    </div>
                  </div>

                  <div class="api-example-title" style="margin-top:8px;">AI 对话请求示例</div>
                  <pre class="api-pre">curl -X POST http://127.0.0.1:{{
                      settingsStore.settings.api_port || '33333'
                    }}/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer &lt;your_token&gt;" \
  -d '{
    "message": "每30分钟提醒我喝水",
    "history": []
  }'</pre>

                  <div class="api-example-title" style="margin-top:6px;">AI 对话响应示例</div>
                  <pre class="api-pre">{
  "success": true,
  "data": {
    "reply": "好的，已为你创建喝水提醒！📋 每 30 分钟循环提醒，通过桌面通知推送。",
    "tool_calls": [
      {
        "name": "create_reminder",
        "args": {
          "title": "喝水提醒",
          "remind_type": "interval",
          "interval_value": 30,
          "interval_unit": "minutes",
          "channels": ["desktop"]
        }
      }
    ]
  }
}</pre>

                  <!-- 调用示例 -->
                  <div class="api-example-title" style="margin-top:14px;">创建提醒 - curl 示例</div>
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

                  <div class="api-example-title" style="margin-top:14px;">AI Agent 对话调用示例</div>
                  <p class="api-intro">通过 AI 对话接口，直接用自然语言即可创建提醒：</p>
                  <div class="api-chat-examples">
                    <div class="api-chat-bubble user">每30分钟提醒我喝水</div>
                    <div class="api-chat-bubble ai">好的，已为你创建喝水提醒 📋 每 30 分钟循环提醒，活跃时段
                      09:00-18:00，通过桌面通知推送。
                    </div>
                    <div class="api-chat-bubble user">明天下午3点提醒我开会</div>
                    <div class="api-chat-bubble ai">已创建会议提醒 📋 明天 15:00 定时提醒，通过桌面通知推送。</div>
                  </div>

                  <div class="api-example-title" style="margin-top:14px;">Python 调用示例</div>
                  <pre class="api-pre">import requests

BASE = "http://127.0.0.1:{{ settingsStore.settings.api_port || '33333' }}"
TOKEN = "{{ settingsStore.settings.api_token || 'your_token' }}"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {TOKEN}"
}

# 方式1: 通过 AI 对话创建提醒（推荐）
resp = requests.post(f"{BASE}/api/chat", headers=headers, json={
    "message": "每30分钟提醒我喝水",
    "history": []
})
print(resp.json())

# 方式2: 直接创建提醒
resp = requests.post(f"{BASE}/api/reminders", headers=headers, json={
    "title": "喝水提醒",
    "remind_type": "interval",
    "start_time": "2025-03-20T09:00:00",
    "interval_value": 30,
    "interval_unit": "minutes",
    "channels": ["desktop"]
})
print(resp.json())

# 查询提醒列表
resp = requests.get(f"{BASE}/api/reminders?is_active=1", headers=headers)
print(resp.json())</pre>

                  <div class="api-example-title" style="margin-top:10px;">HTTP 状态码说明</div>
                  <div class="api-field-row api-field-header" style="margin-top:4px;">
                    <span class="api-field-name">状态码</span>
                    <span style="flex:1">含义</span>
                  </div>
                  <div class="api-field-row"><span class="api-field-name api-code">200</span><span
                      style="flex:1">成功</span>
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
            </transition>
          </div>
        </template>
      </div>

      <!-- 数据管理 -->
      <div class="setting-section">
        <h3 class="section-title">数据</h3>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">数据库加密</div>
            <div class="setting-desc">
              {{ settingsStore.settings.db_encrypted === 'true' ? '已启用，数据库文件已加密' : '未加密' }}
            </div>
          </div>
          <el-button size="small" plain @click="showEncryptionDialog = true">
            {{ settingsStore.settings.db_encrypted === 'true' ? '管理密码' : '设置密码' }}
          </el-button>
        </div>

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
          <span class="gift-link" @click="showBlessing = true">🎁</span>
        </h3>

        <div class="about-info">
          <div class="about-row">
            <span class="about-label">应用名称</span>
            <span class="about-value">king提醒助手</span>
          </div>
          <div class="about-row">
            <span class="about-label">版本</span>
            <span class="about-value">V{{ appVersion }}</span>
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
            <span class="about-label">Github</span>
            <span class="about-value"><a target="_blank"
                                         href="https://github.com/coder-kingyifan/king-remind">https://github.com/coder-kingyifan/king-remind</a></span>
          </div>
          <div class="about-row">
            <span class="about-label">Gitee(码云)</span>
            <span class="about-value">  <a target="_blank" href="https://gitee.com/kingyifan/king-remind">https://gitee.com/kingyifan/king-remind</a>
              </span>
          </div>
        </div>

        <div class="about-actions">
          <el-button size="small" plain :loading="checkingUpdate" @click="checkUpdate">检查更新</el-button>
        </div>

        <div class="tip-section">
          <div class="tip-title">觉得好用？请kingyifan喝杯咖啡 ☕</div>
          <div class="tip-images">
            <div class="tip-item" @click="openTipPreview(alipayImg)">
              <img :src="alipayImg" class="tip-qr" alt="支付宝"/>
              <span class="tip-label">支付宝</span>
            </div>
            <div class="tip-item" @click="openTipPreview(wechatpayImg)">
              <img :src="wechatpayImg" class="tip-qr" alt="微信"/>
              <span class="tip-label">微信</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 打赏码放大预览 -->
    <el-dialog
        v-model="showTipPreview"
        width="auto"
        :show-close="true"
        class="tip-preview-dialog"
        @close="closeTipPreview"
        align-center
    >
      <div class="tip-preview-wrapper">
        <img :src="tipPreviewSrc" class="tip-preview-img" alt="打赏码"/>
      </div>
    </el-dialog>

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
            愿你眼里有光，心中有爱<br/>
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

    <!-- 数据库加密弹窗 -->
    <el-dialog
        v-model="showEncryptionDialog"
        :title="settingsStore.settings.db_encrypted === 'true' ? '管理数据库密码' : '设置数据库密码'"
        width="420px"
        :close-on-click-modal="false"
    >
      <div class="encryption-dialog-body">
        <!-- 已加密：修改或移除 -->
        <template v-if="settingsStore.settings.db_encrypted === 'true'">
          <div class="setup-field">
            <label class="setup-label">当前密码</label>
            <el-input v-model="encCurrentPassword" type="password" show-password placeholder="请输入当前密码"/>
          </div>
          <div class="setup-field">
            <label class="setup-label">新密码（留空则不修改）</label>
            <el-input v-model="encNewPassword" type="password" show-password placeholder="输入新密码"/>
          </div>
          <div class="enc-actions">
            <el-button type="danger" plain size="small" @click="removeEncryption" :loading="encLoading">移除加密
            </el-button>
            <el-button type="primary" @click="changeEncryptionPassword" :loading="encLoading">修改密码</el-button>
          </div>
        </template>
        <!-- 未加密：设置密码 -->
        <template v-else>
          <div class="setup-field">
            <label class="setup-label">设置密码</label>
            <el-input v-model="encNewPassword" type="password" show-password placeholder="设置数据库加密密码"/>
          </div>
          <div class="setup-field">
            <label class="setup-label">确认密码</label>
            <el-input v-model="encConfirmPassword" type="password" show-password placeholder="再次输入密码"/>
          </div>
          <el-button type="primary" style="width: 100%; margin-top: 8px;" @click="setEncryption" :loading="encLoading">
            设置密码并加密
          </el-button>
        </template>
        <div v-if="encError" class="enc-error">{{ encError }}</div>
      </div>
    </el-dialog>

    <!-- 更新提示弹窗 -->
    <el-dialog
        v-model="showUpdateDialog"
        title="发现新版本"
        width="420px"
        :close-on-click-modal="true"
    >
      <div class="update-dialog-body">
        <div class="update-version">V{{ updateInfo.latestVersion }}</div>
        <div class="update-current">当前版本：V{{ updateInfo.currentVersion }}</div>
        <div v-if="updateInfo.releaseNotes" class="update-notes">
          <div class="update-notes-title">更新内容</div>
          <div class="update-notes-content" v-html="renderMarkdown(updateInfo.releaseNotes)"></div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showUpdateDialog = false">稍后再说</el-button>
        <el-button type="primary" @click="downloadUpdate">立即下载</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {onMounted, ref, computed} from 'vue'
import {useSettingsStore} from '@/stores/settings'
import {ElMessage} from 'element-plus'
import {ArrowDown} from '@element-plus/icons-vue'
import {setCachedAppMode} from '@/router'
import {CHANNELS} from '@/types/notification'
import alipayImg from '@/../resources/alipay.jpg'
import wechatpayImg from '@/../resources/wechatpay.jpg'

const settingsStore = useSettingsStore()
const showBlessing = ref(false)
const behaviorNeedsRestart = ref(false)
const showApiDoc = ref(false)
const showEncryptionDialog = ref(false)
const encCurrentPassword = ref('')
const encNewPassword = ref('')
const encConfirmPassword = ref('')
const encError = ref('')
const encLoading = ref(false)
const tipPreviewSrc = ref('')
const showTipPreview = ref(false)

// 更新相关
const appVersion = ref('')
const checkingUpdate = ref(false)
const showUpdateDialog = ref(false)
const updateInfo = ref<{ hasUpdate: boolean; currentVersion: string; latestVersion: string; downloadUrl: string; releaseNotes: string }>({
    hasUpdate: false, currentVersion: '', latestVersion: '', downloadUrl: '', releaseNotes: ''
})

function openTipPreview(src: string) {
  tipPreviewSrc.value = src
  showTipPreview.value = true
}

function closeTipPreview() {
  showTipPreview.value = false
  tipPreviewSrc.value = ''
}

onMounted(async () => {
  // 获取应用版本
  try {
    appVersion.value = await window.electronAPI.app.getVersion()
  } catch {
    appVersion.value = '2.0.0'
  }
  // 监听启动时自动检查更新的通知
  window.electronAPI.updater.onUpdateAvailable((info: any) => {
    updateInfo.value = info
    showUpdateDialog.value = true
  })
})

async function onAppModeChange(val: string) {
  await settingsStore.setSetting('app_mode', val)
  setCachedAppMode(val)
  ElMessage.success('模式已切换，刷新页面后生效')
}

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

// 待办通知时间选项（整点和半点）
const todoNotifyTimes = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30',
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00'
]

// 待办通知渠道选项
const todoChannelOptions = computed(() => {
  // desktop 始终可选，其他渠道需已启用
  return CHANNELS.filter(ch => ch.key === 'desktop' || settingsStore.settings[`notify_${ch.key}_enabled`] === 'true')
})

const todoNotifyChannels = computed(() => {
  try {
    const raw = settingsStore.settings.todo_notify_channels
    return raw ? JSON.parse(raw) : ['desktop']
  } catch { return ['desktop'] }
})

async function onTodoNotifyChannelsChange(val: string[]) {
  await settingsStore.setSetting('todo_notify_channels', JSON.stringify(val))
}

const todoSummaryChannels = computed(() => {
  try {
    const raw = settingsStore.settings.todo_summary_channels
    return raw ? JSON.parse(raw) : ['desktop']
  } catch { return ['desktop'] }
})

async function onTodoSummaryChannelsChange(val: string[]) {
  await settingsStore.setSetting('todo_summary_channels', JSON.stringify(val))
}

async function onLaunchAtStartupChange(val: boolean) {
  await settingsStore.setSetting('launch_at_startup', String(val))
  behaviorNeedsRestart.value = true
}

async function onMinimizeToTrayChange(val: boolean) {
  await settingsStore.setSetting('minimize_to_tray', String(val))
  behaviorNeedsRestart.value = true
}

async function onApiEnabledChange(val: boolean) {
  await settingsStore.setSetting('api_enabled', String(val))
  if (val) {
    try {
      await window.electronAPI.api.restart()
      ElMessage.success('API 接口已启用')
    } catch {
      ElMessage.error('API 接口启动失败')
    }
  } else {
    try {
      await window.electronAPI.api.toggle(false)
      ElMessage.success('API 接口已关闭')
    } catch { /* ignore */
    }
  }
}

async function onApiSettingChange(key: string, value: string) {
  await settingsStore.setSetting(key, value)
  // Restart API server dynamically
  try {
    await window.electronAPI.api.restart()
    ElMessage.success('API 配置已更新')
  } catch { /* ignore */
  }
}

async function restartApp() {
  try {
    await window.electronAPI.app.restart()
  } catch (e: any) {
    ElMessage.error('重启失败: ' + (e.message || '未知错误'))
  }
}

async function setEncryption() {
  encError.value = ''
  if (!encNewPassword.value) {
    encError.value = '请输入密码'
    return
  }
  if (encNewPassword.value !== encConfirmPassword.value) {
    encError.value = '两次输入的密码不一致'
    return
  }
  encLoading.value = true
  try {
    await window.electronAPI.db.setEncryption(encNewPassword.value)
    await settingsStore.setSetting('db_encrypted', 'true')
    ElMessage.success('数据库加密设置成功，需要重启应用生效')
    showEncryptionDialog.value = false
    encNewPassword.value = ''
    encConfirmPassword.value = ''
    behaviorNeedsRestart.value = true
  } catch (e: any) {
    encError.value = e.message || '设置失败'
  } finally {
    encLoading.value = false
  }
}

async function changeEncryptionPassword() {
  encError.value = ''
  if (!encCurrentPassword.value) {
    encError.value = '请输入当前密码'
    return
  }
  if (!encNewPassword.value) {
    encError.value = '请输入新密码'
    return
  }
  encLoading.value = true
  try {
    const valid = await window.electronAPI.db.verifyPassword(encCurrentPassword.value)
    if (!valid) {
      encError.value = '当前密码错误'
      return
    }
    await window.electronAPI.db.setEncryption(encNewPassword.value)
    ElMessage.success('密码修改成功，需要重启应用生效')
    showEncryptionDialog.value = false
    encCurrentPassword.value = ''
    encNewPassword.value = ''
  } catch (e: any) {
    encError.value = e.message || '修改失败'
  } finally {
    encLoading.value = false
  }
}

async function removeEncryption() {
  encError.value = ''
  if (!encCurrentPassword.value) {
    encError.value = '请输入当前密码以确认移除加密'
    return
  }
  encLoading.value = true
  try {
    const valid = await window.electronAPI.db.verifyPassword(encCurrentPassword.value)
    if (!valid) {
      encError.value = '密码错误'
      return
    }
    await window.electronAPI.db.removeEncryption()
    await settingsStore.setSetting('db_encrypted', 'false')
    ElMessage.success('加密已移除，需要重启应用生效')
    showEncryptionDialog.value = false
    encCurrentPassword.value = ''
  } catch (e: any) {
    encError.value = e.message || '移除失败'
  } finally {
    encLoading.value = false
  }
}

async function cleanupLogs() {
  try {
    ElMessage.success('日志清理完成')
  } catch {
    ElMessage.error('清理失败')
  }
}

async function selectSoundFile() {
  try {
    const filePath = await window.electronAPI.notifications.selectSoundFile()
    if (filePath) {
      await settingsStore.setSetting('notification_sound_file', filePath)
      ElMessage.success('提示音文件已设置')
    }
  } catch (e: any) {
    ElMessage.error('选择文件失败: ' + (e.message || '未知错误'))
  }
}

function previewSound() {
  try {
    window.electronAPI.notifications.previewSound()
  } catch (e: any) {
    ElMessage.error('试听失败: ' + (e.message || '未知错误'))
  }
}

async function checkUpdate() {
  checkingUpdate.value = true
  try {
    const info = await window.electronAPI.updater.check()
    if (info.hasUpdate) {
      updateInfo.value = info
      showUpdateDialog.value = true
    } else {
      ElMessage.success('已是最新版本')
    }
  } catch (e: any) {
    ElMessage.error('检查更新失败: ' + (e.message || '未知错误'))
  } finally {
    checkingUpdate.value = false
  }
}

function downloadUpdate() {
  if (updateInfo.value.downloadUrl) {
    window.open(updateInfo.value.downloadUrl, '_blank')
  }
  showUpdateDialog.value = false
}

/** 简单的 Markdown 渲染（仅处理标题、列表、加粗） */
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br/>')
}
</script>

<style scoped>
.system-section {
  max-width: 640px;
}

.section-header {
  margin-bottom: 20px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.section-subtitle {
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

/* API 文档折叠 */
.api-doc-collapse {
  border: 1px solid var(--border-color-light);
  border-radius: 8px;
  margin-top: 12px;
  overflow: hidden;
}

.api-doc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: pointer;
  background: var(--bg-secondary, #f5f7fa);
  transition: background 0.2s;
}

.api-doc-header:hover {
  background: var(--bg-hover, #ebeef5);
}

.api-doc-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.rotate-icon {
  transform: rotate(180deg);
  transition: transform 0.3s;
}

.api-doc-body {
  padding: 14px;
  border-top: 1px solid var(--border-color-light);
}

.doc-slide-enter-active {
  transition: all 0.3s ease;
}

.doc-slide-leave-active {
  transition: all 0.2s ease;
}

.doc-slide-enter-from,
.doc-slide-leave-to {
  opacity: 0;
  max-height: 0;
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

/* AI 对话调用示例 */
.api-chat-examples {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.api-chat-bubble {
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.5;
  max-width: 85%;
}

.api-chat-bubble.user {
  align-self: flex-end;
  background: var(--color-primary, #409EFF);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.api-chat-bubble.ai {
  align-self: flex-start;
  background: var(--bg-secondary, #f5f7fa);
  color: var(--text-primary);
  border-bottom-left-radius: 4px;
}

/* 数据库加密弹窗 */
.encryption-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.enc-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
}

.enc-error {
  font-size: 12px;
  color: #F56C6C;
  padding-left: 4px;
}

/* 打赏 */
.tip-section {
  margin-top: 16px;
  text-align: center;
}

.tip-title {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.tip-images {
  display: flex;
  justify-content: center;
  gap: 24px;
}

.tip-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.tip-item:hover .tip-qr {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.tip-qr {
  width: 140px;
  height: 140px;
  border-radius: 8px;
  border: 1px solid var(--border-color-light);
  transition: transform 0.2s, box-shadow 0.2s;
}

.tip-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.tip-preview-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px;
}

.tip-preview-img {
  width: 280px;
  height: 280px;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

/* 更新相关 */
.about-actions {
  margin-top: 12px;
  text-align: center;
}

.update-dialog-body {
  text-align: center;
}

.update-version {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary, #409EFF);
  margin-bottom: 4px;
}

.update-current {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: 12px;
}

.update-notes {
  text-align: left;
  margin-top: 12px;
}

.update-notes-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.update-notes-content {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.8;
  max-height: 200px;
  overflow-y: auto;
  padding: 8px 10px;
  background: var(--bg-secondary, #f5f7fa);
  border-radius: 6px;
}

.update-notes-content :deep(h2) {
  font-size: 14px;
  font-weight: 600;
  margin: 8px 0 4px;
}

.update-notes-content :deep(h3) {
  font-size: 13px;
  font-weight: 600;
  margin: 6px 0 2px;
}

.update-notes-content :deep(li) {
  margin-left: 16px;
  list-style: disc;
}

.update-notes-content :deep(strong) {
  font-weight: 600;
}
</style>
