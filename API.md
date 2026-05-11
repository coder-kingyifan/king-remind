# King Mate - 本地 HTTP API 文档

## 概览

应用启动后可在本地监听 HTTP API，用于外部程序、脚本、AI Agent 或自动化工具管理提醒、会议、待办、通知配置和 AI 对话。

- **默认地址**: `http://127.0.0.1:33333`
- **启用方式**: 系统设置 -> API 接口 -> 启用后台 API 接口
- **端口配置**: 系统设置 -> API 接口 -> 监听端口，默认 `33333`
- **监听地址**: 系统设置 -> API 接口 -> 监听地址，默认 `0.0.0.0`
- **认证配置**: 系统设置 -> API 接口 -> 访问令牌，留空则不校验

如果设置了访问令牌，所有请求都需要携带：

```http
Authorization: Bearer <token>
```

## 统一响应

```json
{ "success": true, "data": {} }
```

```json
{ "success": false, "error": "错误描述" }
```

常见状态码：`200` 成功，`400` 参数错误，`401` Token 校验失败，`404` 资源不存在，`500` 服务端错误。

## 健康检查

### GET /api/ping

```json
{
  "success": true,
  "data": { "message": "pong", "version": "2.0.2" }
}
```

## 提醒管理

### POST /api/reminders

创建提醒。创建成功后调度器会立即检查。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | string | 是 | 提醒标题 |
| `description` | string | 否 | 提醒说明 |
| `icon` | string | 否 | 图标，默认 `🔔` |
| `color` | string | 否 | 十六进制颜色，默认 `#409EFF` |
| `remind_type` | string | 是 | `interval` 周期提醒，或 `scheduled` 定时提醒 |
| `start_time` | string | 是 | ISO 8601 时间，如 `2026-05-12T09:00:00` |
| `end_time` | string | 否 | 结束时间 |
| `interval_value` | number | 否 | 周期数值，默认 `60` |
| `interval_unit` | string | 否 | `minutes` / `hours` / `days` / `months` / `years` |
| `weekdays` | number[] | 否 | 指定星期，`0` 为周日，`1` 为周一 |
| `workday_only` | boolean | 否 | 仅工作日触发 |
| `holiday_only` | boolean | 否 | 仅节假日触发 |
| `lunar_date` | string | 否 | 农历日期，格式 `MM-DD` |
| `active_hours_start` | string | 否 | 活跃时间开始，格式 `HH:mm` |
| `active_hours_end` | string | 否 | 活跃时间结束，格式 `HH:mm` |
| `channels` | string[] | 否 | 默认 `["desktop"]` |

```bash
curl -X POST http://127.0.0.1:33333/api/reminders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_token" \
  -d '{
    "title": "喝水",
    "remind_type": "interval",
    "start_time": "2026-05-12T09:00:00",
    "interval_value": 30,
    "interval_unit": "minutes",
    "channels": ["desktop"]
  }'
```

### GET /api/reminders

查询提醒列表。

| Query | 说明 |
| --- | --- |
| `is_active` | `0` 或 `1`，按启用状态筛选 |
| `search` | 按标题或说明模糊搜索 |

### GET /api/reminders/stats

获取提醒统计：`total`、`active`、`triggeredToday`。

### GET /api/reminders/:id

获取单条提醒。

### PUT /api/reminders/:id

更新提醒。请求字段同创建接口，所有字段可选。

### POST /api/reminders/:id/toggle

切换提醒启用状态。

### DELETE /api/reminders/:id

删除提醒。

## 会议管理

### POST /api/meetings

创建会议。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | string | 是 | 会议标题 |
| `description` | string | 否 | 会议说明 |
| `meeting_type` | string | 否 | `regular` / `project` / `adhoc`，默认 `regular` |
| `status` | string | 否 | `pending` / `ongoing` / `completed`，默认 `pending` |
| `start_time` | string | 是 | 开始时间，ISO 8601 |
| `end_time` | string | 否 | 结束时间 |
| `location` | string | 否 | 地点 |
| `participants` | string[] | 否 | 参会人 |
| `minutes` | string | 否 | 会议纪要 |
| `attachments` | array | 否 | 附件列表 `{ name, path, type, size }` |
| `recording_path` | string | 否 | 录音路径 |
| `has_recording` | boolean | 否 | 是否有录音 |
| `todo_ids` | number[] | 否 | 关联待办 ID |

```bash
curl -X POST http://127.0.0.1:33333/api/meetings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_token" \
  -d '{
    "title": "项目周会",
    "meeting_type": "project",
    "start_time": "2026-05-12T10:00:00",
    "end_time": "2026-05-12T11:00:00",
    "location": "会议室 A",
    "participants": ["张三", "李四"]
  }'
```

### GET /api/meetings

查询会议列表。

| Query | 说明 |
| --- | --- |
| `status` | 按状态筛选 |
| `meeting_type` | 按会议类型筛选 |
| `search` | 按标题、说明、地点搜索 |
| `start_date` | 开始日期下限，格式 `YYYY-MM-DD` |
| `end_date` | 开始日期上限，格式 `YYYY-MM-DD` |

### GET /api/meetings/stats

获取会议统计：`total`、`pending`、`ongoing`、`completed`、`today`。

### GET /api/meetings/:id

获取单场会议。

### PUT /api/meetings/:id

更新会议。请求字段同创建接口，所有字段可选，额外支持 `ai_summary`、`stt_text`、`stt_status`。

### POST /api/meetings/:id/status

更新会议状态。

```json
{ "status": "completed" }
```

### DELETE /api/meetings/:id

删除会议。

## 待办管理

待办接口主路径为 `/api/todos`。旧路径 `/api/todo` 仍保持兼容。

### POST /api/todos

创建待办。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | string | 是 | 待办标题 |
| `description` | string | 否 | 描述 |
| `priority` | string | 否 | `normal` / `high` / `urgent` / `low`，默认 `normal` |
| `due_date` | string | 否 | 截止日期，格式 `YYYY-MM-DD` |
| `category` | string | 否 | 分类 |
| `images` | string[] | 否 | 图片路径列表 |

```bash
curl -X POST http://127.0.0.1:33333/api/todos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_token" \
  -d '{
    "title": "完成项目报告",
    "priority": "high",
    "due_date": "2026-05-12",
    "category": "工作"
  }'
```

### GET /api/todos

查询待办列表。

| Query | 说明 |
| --- | --- |
| `completed` | `0` 或 `1`，按完成状态筛选 |
| `category` | 按分类筛选 |
| `search` | 按标题搜索 |

### GET /api/todos/stats

获取待办统计：`total`、`completed`、`pending`、`overdue`。

### GET /api/todos/:id

获取单条待办。

### PUT /api/todos/:id

更新待办。请求字段同创建接口，所有字段可选，额外支持 `completed`、`sort_order`。

### POST /api/todos/:id/toggle

切换待办完成状态。

### DELETE /api/todos/:id

删除待办。

## AI 对话

### POST /api/chat

通过自然语言与 AI 助手对话，AI 可调用工具创建或查询提醒，并可辅助生成技能。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `message` | string | 是 | 用户消息 |
| `model_config_id` | number | 否 | 模型配置 ID，不传则使用默认模型 |
| `history` | array | 否 | 对话历史 `[{ "role": "user", "content": "..." }]` |

```bash
curl -X POST http://127.0.0.1:33333/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_token" \
  -d '{
    "message": "每 30 分钟提醒我喝水",
    "history": []
  }'
```

## 模型与设置

### GET /api/models

获取可用模型配置列表。

### GET /api/settings

获取系统设置。

### PUT /api/settings

批量更新系统设置。

## 通知渠道

### GET /api/notifications/configs

获取所有通知渠道配置。

### PUT /api/notifications/configs/:channel

更新通知渠道配置。

### POST /api/notifications/test/:channel

测试通知渠道。

## 调用示例

### Python

```python
import requests

BASE = "http://127.0.0.1:33333"
TOKEN = "your_token"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {TOKEN}"
}

requests.post(f"{BASE}/api/reminders", headers=headers, json={
    "title": "喝水提醒",
    "remind_type": "interval",
    "start_time": "2026-05-12T09:00:00",
    "interval_value": 30,
    "interval_unit": "minutes",
    "channels": ["desktop"]
})

requests.post(f"{BASE}/api/meetings", headers=headers, json={
    "title": "项目周会",
    "start_time": "2026-05-12T10:00:00",
    "participants": ["张三", "李四"]
})

requests.post(f"{BASE}/api/todos", headers=headers, json={
    "title": "完成项目报告",
    "priority": "high",
    "due_date": "2026-05-12"
})

print(requests.get(f"{BASE}/api/reminders", headers=headers).json())
print(requests.get(f"{BASE}/api/meetings", headers=headers).json())
print(requests.get(f"{BASE}/api/todos?completed=0", headers=headers).json())
```

### curl

```bash
curl http://127.0.0.1:33333/api/ping
curl http://127.0.0.1:33333/api/reminders
curl http://127.0.0.1:33333/api/meetings
curl http://127.0.0.1:33333/api/todos
```
