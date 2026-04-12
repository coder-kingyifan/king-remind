# King 提醒助手 - 本地 HTTP API 文档

## 概述

应用启动后可在本地监听一个 HTTP API，可用于外部程序（如 AI Agent、脚本、自动化工具等）快速创建和管理提醒。

- **默认地址**: `http://127.0.0.1:33333`
- **启用方式**: 系统设置 → API 接口 → 启用后台 API 接口（需重启应用生效）
- **端口配置**: 数据库 `settings` 表中 `api_port` 字段（默认 33333）
- **监听地址**: 数据库 `settings` 表中 `api_host` 字段（默认 0.0.0.0，允许外部访问）
- **认证配置**: 数据库 `settings` 表中 `api_token` 字段（留空则不校验）

## 首次配置

1. 打开应用 → 系统设置 → API 接口
2. 开启「启用后台 API 接口」开关
3. 设置监听端口（默认 33333）、监听地址（默认 0.0.0.0）和访问令牌
4. 点击「重启应用」使配置生效
5. 重启后在系统设置页面可查看完整的 API 文档

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

## AI 对话调用

除了通过 HTTP API，还可以通过应用内 AI 助手用自然语言创建提醒：

| 用户输入                    | AI 操作                      |
|-------------------------|-----------------------------|
| 每30分钟提醒我喝水              | 创建循环提醒，间隔30分钟               |
| 明天下午3点提醒我开会             | 创建定时提醒，指定时间                 |
| 工作日每天早上9点提醒我站会          | 创建循环提醒，限定工作日                |
| 查看我的所有提醒                | 调用 GET /api/reminders 查询列表  |
| 删除喝水提醒                  | 调用 DELETE /api/reminders/:id |

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

# 创建提醒
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
```

### Node.js

```javascript
const BASE = "http://127.0.0.1:33333";
const TOKEN = "your_token";

// 创建提醒
const res = await fetch(`${BASE}/api/reminders`, {
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
const data = await res.json();
console.log(data);
```

### curl

```bash
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
