# King 提醒助手 - 本地 HTTP API 文档

## 概述

应用启动后可在本地监听一个 HTTP API，可用于外部程序（如 AI Agent、脚本、自动化工具等）快速创建和管理提醒，也可通过 AI 对话接口用自然语言创建提醒。

- **默认地址**: `http://127.0.0.1:33333`
- **启用方式**: 系统设置 → API 接口 → 启用后台 API 接口（启用后自动重启应用生效）
- **端口配置**: 系统设置 → API 接口 → 监听端口（默认 33333）
- **监听地址**: 系统设置 → API 接口 → 监听地址（默认 0.0.0.0，允许外部访问）
- **认证配置**: 系统设置 → API 接口 → 访问令牌（留空则不校验）

## 首次配置

1. 打开应用 → 首次启动向导（或系统设置 → API 接口）
2. 开启「启用后台 API 接口」开关
3. 设置监听端口（默认 33333）、监听地址（默认 0.0.0.0）和访问令牌
4. 应用自动重启使配置生效
5. 重启后在系统设置 → API 接口 → 展开接口文档查看

## 认证

若 `api_token` 不为空，所有请求需在 Header 中携带：

```
Authorization: Bearer <token>
```

---

## 接口列表

### GET /api/ping

健康检查。

**响应示例**

```json
{
  "success": true,
  "data": { "message": "pong", "version": "1.0.0" }
}
```

---

### POST /api/reminders

创建一条新提醒。创建成功后调度器立即检查，若时间已到则立刻触发。

**请求体** `application/json`

| 字段                   | 类型       | 必填 | 说明                                                                                             |
|----------------------|----------|----|------------------------------------------------------------------------------------------------|
| `title`              | string   | ✅  | 提醒标题                                                                                           |
| `description`        | string   |    | 提醒内容描述                                                                                         |
| `icon`               | string   |    | 图标（emoji），默认 `🔔`                                                                              |
| `color`              | string   |    | 颜色（十六进制），默认 `#409EFF`                                                                          |
| `remind_type`        | string   | ✅  | 提醒类型：`interval`（周期）或 `scheduled`（定时）                                                           |
| `start_time`         | string   | ✅  | 开始时间，ISO 8601 格式，如 `2025-03-20T09:00:00`                                                       |
| `end_time`           | string   |    | 结束时间，ISO 8601 格式，超过后停止                                                                         |
| `interval_value`     | number   |    | 周期数值，`remind_type=interval` 时有效，默认 `60`                                                        |
| `interval_unit`      | string   |    | 周期单位：`minutes` / `hours` / `days` / `months` / `years`，默认 `minutes`                            |
| `weekdays`           | number[] |    | 仅在指定星期触发，0=周日，1=周一，…6=周六，如 `[1,3,5]`                                                           |
| `workday_only`       | boolean  |    | 仅工作日触发                                                                                         |
| `holiday_only`       | boolean  |    | 仅节假日触发                                                                                         |
| `lunar_date`         | string   |    | 农历日期，格式 `MM-DD`，如 `01-01`（正月初一）                                                                |
| `active_hours_start` | string   |    | 活跃时间段开始，格式 `HH:mm`，如 `09:00`                                                                   |
| `active_hours_end`   | string   |    | 活跃时间段结束，格式 `HH:mm`，如 `18:00`                                                                   |
| `channels`           | string[] |    | 通知渠道，默认 `["desktop"]`，可选值：`desktop` / `email` / `telegram` / `wechat_work` / `wechat_work_webhook` / `webhook` |

**示例：5 分钟后提醒一次（定时）**

```json
POST http://127.0.0.1:33333/api/reminders
Content-Type: application/json

{
  "title": "喝水",
  "description": "记得补充水分",
  "remind_type": "scheduled",
  "start_time": "2025-03-20T10:30:00",
  "channels": ["desktop"]
}
```

**示例：每 30 分钟循环提醒**

```json
{
  "title": "站起来活动一下",
  "remind_type": "interval",
  "start_time": "2025-03-20T09:00:00",
  "interval_value": 30,
  "interval_unit": "minutes",
  "active_hours_start": "09:00",
  "active_hours_end": "18:00",
  "channels": ["desktop", "webhook"]
}
```

**成功响应** `200`

```json
{
  "success": true,
  "data": {
    "id": 42,
    "title": "喝水",
    "description": "记得补充水分",
    "icon": "🔔",
    "color": "#409EFF",
    "remind_type": "scheduled",
    "start_time": "2025-03-20T10:30:00",
    "end_time": null,
    "interval_value": 60,
    "interval_unit": "minutes",
    "channels": "[\"desktop\"]",
    "is_active": 1,
    "next_trigger_at": "2025-03-20T02:30:00.000Z",
    "created_at": "2025-03-20 09:00:00"
  }
}
```

**错误响应** `400`

```json
{ "success": false, "error": "缺少必填字段: title" }
```

---

### GET /api/reminders

获取提醒列表。

**Query 参数**

| 参数          | 类型     | 说明         |
|-------------|--------|------------|
| `is_active` | 0 或 1  | 按激活状态筛选    |
| `search`    | string | 按标题/描述模糊搜索 |

**示例**

```
GET http://127.0.0.1:33333/api/reminders?is_active=1
```

**响应**

```json
{
  "success": true,
  "data": [ /* Reminder 对象数组 */ ]
}
```

---

### GET /api/reminders/:id

获取单条提醒详情。

**示例**

```
GET http://127.0.0.1:33333/api/reminders/42
```

**响应** `200` / `404`

---

### DELETE /api/reminders/:id

删除一条提醒。

**示例**

```
DELETE http://127.0.0.1:33333/api/reminders/42
```

**成功响应**

```json
{ "success": true, "data": { "deleted": true } }
```

---

### POST /api/chat

AI 对话接口。通过自然语言与 AI 助手对话，AI 会自动识别意图并创建提醒、查询提醒等。适合集成到外部 AI Agent 或自动化流程中。

**请求体** `application/json`

| 字段               | 类型     | 必填 | 说明                                           |
|------------------|--------|----|----------------------------------------------|
| `message`        | string | ✅  | 用户消息，如 "每30分钟提醒我喝水"                          |
| `model_config_id`| number |    | 模型配置 ID，不传则使用默认模型                            |
| `history`        | array  |    | 对话历史 `[{role: "user"/"assistant", content: "..."}]`，支持多轮对话 |

**请求示例**

```json
POST http://127.0.0.1:33333/api/chat
Content-Type: application/json
Authorization: Bearer your_token

{
  "message": "每30分钟提醒我喝水",
  "history": []
}
```

**多轮对话示例**

```json
{
  "message": "改成每小时提醒一次",
  "history": [
    { "role": "user", "content": "每30分钟提醒我喝水" },
    { "role": "assistant", "content": "好的，已为你创建喝水提醒！每 30 分钟循环提醒。" }
  ]
}
```

**成功响应** `200`

```json
{
  "success": true,
  "data": {
    "reply": "好的，已为你创建喝水提醒！📋 每 30 分钟循环提醒，活跃时段 09:00-18:00，通过桌面通知推送。",
    "tool_calls": [
      {
        "name": "create_reminder",
        "args": {
          "title": "喝水提醒",
          "remind_type": "interval",
          "start_time": "2025-03-20T09:00:00",
          "interval_value": 30,
          "interval_unit": "minutes",
          "active_hours_start": "09:00",
          "active_hours_end": "18:00",
          "channels": ["desktop"]
        },
        "result": {
          "id": 42,
          "title": "喝水提醒",
          "is_active": 1
        }
      }
    ]
  }
}
```

**无工具调用的响应**

```json
{
  "success": true,
  "data": {
    "reply": "你好！我是 King 提醒助手，有什么可以帮你的吗？"
  }
}
```

**错误响应** `500`

```json
{ "success": false, "error": "AI 对话失败: 未配置 AI 模型" }
```

---

### GET /api/models

获取可用的模型配置列表。

**响应示例**

```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "默认模型", "provider": "openai", "model": "gpt-4o-mini", "is_default": 1 },
    { "id": 2, "name": "本地模型", "provider": "ollama", "model": "qwen3:8b", "is_default": 0 }
  ]
}
```

---

## 统一响应格式

```json
// 成功
{ "success": true, "data": <任意类型> }

// 失败
{ "success": false, "error": "错误描述" }
```

| HTTP 状态码 | 含义         |
|----------|------------|
| 200      | 成功         |
| 400      | 请求参数错误     |
| 401      | Token 验证失败 |
| 404      | 资源不存在      |
| 500      | 服务器内部错误    |

---

## AI 对话调用示例

| 用户输入                    | AI 操作                      |
|-------------------------|-----------------------------|
| 每30分钟提醒我喝水              | 创建循环提醒，间隔30分钟               |
| 明天下午3点提醒我开会             | 创建定时提醒，指定时间                 |
| 工作日每天早上9点提醒我站会          | 创建循环提醒，限定工作日                |
| 查看我的所有提醒                | 调用 list_reminders 查询列表     |
| 删除喝水提醒                  | 调用 delete_reminder 删除对应提醒   |

---

## 代码调用示例

### Python

```python
import requests

BASE = "http://127.0.0.1:33333"
TOKEN = "your_token"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {TOKEN}"
}

# 方式1: 通过 AI 对话创建提醒（推荐 - 自然语言）
resp = requests.post(f"{BASE}/api/chat", headers=headers, json={
    "message": "每30分钟提醒我喝水",
    "history": []
})
print(resp.json())

# 方式2: 直接创建提醒（精确控制参数）
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
print(resp.json())

# 获取可用模型
resp = requests.get(f"{BASE}/api/models", headers=headers)
print(resp.json())
```

### Node.js

```javascript
const BASE = "http://127.0.0.1:33333";
const TOKEN = "your_token";

// AI 对话创建提醒
const res = await fetch(`${BASE}/api/chat`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${TOKEN}`
  },
  body: JSON.stringify({
    message: "每30分钟提醒我喝水",
    history: []
  })
});
const data = await res.json();
console.log(data);

// 直接创建提醒
const res2 = await fetch(`${BASE}/api/reminders`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${TOKEN}`
  },
  body: JSON.stringify({
    title: "喝水提醒",
    remind_type: "interval",
    start_time: "2025-03-20T09:00:00",
    interval_value: 30,
    interval_unit: "minutes",
    channels: ["desktop"]
  })
});
const data2 = await res2.json();
console.log(data2);
```

### curl

```bash
# AI 对话创建提醒
curl -X POST http://127.0.0.1:33333/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_token" \
  -d '{
    "message": "每30分钟提醒我喝水",
    "history": []
  }'

# 直接创建提醒
curl -X POST http://127.0.0.1:33333/api/reminders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_token" \
  -d '{
    "title": "喝水提醒",
    "remind_type": "interval",
    "start_time": "2025-03-20T09:00:00",
    "interval_value": 30,
    "interval_unit": "minutes",
    "active_hours_start": "09:00",
    "active_hours_end": "18:00",
    "channels": ["desktop"]
  }'
```
