<p align="center">
  <img src="./resources/icon.png" width="96" alt="King Mate" />
</p>

<h1 align="center">King Mate</h1>

<p align="center">
  <b>开源桌面效率助手 — 日程 / 待办 / 会议 / AI 对话 / 技能 / 多渠道通知</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js&logoColor=white" alt="Vue" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Element%20Plus-2.9-409EFF?logo=element&logoColor=white" alt="Element Plus" />
  <img src="https://img.shields.io/badge/Version-V2.0.1-blue" alt="Version V2.0.1" />
  <img src="https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-orange" alt="License" />
</p>

<br />

## 界面预览

<details>
<summary><b>引导页</b></summary>
<br/>
<p align="center">
  <img src="./docs/readme/引导页-设置昵称.jpg" width="600" alt="设置昵称"/>
</p>
<p align="center">
  <img src="./docs/readme/引导页-设置数据库密码.jpg" width="600" alt="设置数据库密码"/>
</p>
<p align="center">
  <img src="./docs/readme/引导页-配置模式.jpg" width="600" alt="配置模式"/>
</p>
<p align="center">
  <img src="./docs/readme/引导页-完成引导.jpg" width="600" alt="完成引导"/>
</p>
</details>

<details>
<summary><b>首页</b></summary>
<br/>
<p align="center">
  <img src="./docs/readme/首页-黑.jpg" width="600" alt="首页（暗色）"/>
</p>
<p align="center">
  <img src="./docs/readme/首页-白.jpg" width="600" alt="首页（亮色）"/>
</p>
</details>

<details>
<summary><b>AI 对话</b></summary>
<br/>
<p align="center">
  <img src="./docs/readme/ai对话.jpg" width="600" alt="AI 对话"/>
</p>
<p align="center">
  <img src="./docs/readme/普通模式.jpg" width="600" alt="普通模式"/>
</p>
</details>

<details>
<summary><b>数据概览 & 日程管理</b></summary>
<br/>
<p align="center">
  <img src="./docs/readme/数据概览.jpg" width="600" alt="数据概览"/>
</p>
<p align="center">
  <img src="./docs/readme/%E6%8F%90%E9%86%92%E7%AE%A1%E7%90%86.jpg" width="600" alt="日程管理"/>
</p>
</details>

<details>
<summary><b>技能系统</b></summary>
<br/>
<p align="center">
  <img src="./docs/readme/技能管理.jpg" width="600" alt="技能管理"/>
</p>
<p align="center">
  <img src="./docs/readme/技能商店.jpg" width="600" alt="技能商店"/>
</p>
<p align="center">
  <img src="./docs/readme/技能测试.jpg" width="600" alt="技能测试"/>
</p>
</details>

<details>
<summary><b>微信通知</b></summary>
<br/>
<p align="center">
  <img src="./docs/readme/%E5%BE%AE%E4%BF%A1-%E5%88%9B%E5%BB%BA%E6%8F%90%E9%86%92.jpg" width="600" alt="微信创建事项"/>
</p>
<p align="center">
  <img src="./docs/readme/微信-创建技能.jpg" width="600" alt="微信创建技能"/>
</p>
</details>

<details>
<summary><b>系统配置</b></summary>
<br/>
<p align="center">
  <img src="./docs/readme/渠道配置.jpg" width="600" alt="渠道配置"/>
</p>
<p align="center">
  <img src="./docs/readme/模型配置.jpg" width="600" alt="模型配置"/>
</p>
<p align="center">
  <img src="./docs/readme/系统设置.jpg" width="600" alt="系统设置"/>
</p>
<p align="center">
  <img src="./docs/readme/系统设置2.jpg" width="600" alt="系统设置"/>
</p>
<p align="center">
  <img src="./docs/readme/系统设置-后端接口配置.jpg" width="600" alt="后端接口配置"/>
</p>
</details>

<details>
<summary><b>Docker 部署</b></summary>
<br/>
<p align="center">
  <img src="./docs/readme/docker-引导页面.jpg" width="600" alt="Docker 引导页面"/>
</p>
<p align="center">
  <img src="./docs/readme/docker-对话页面.jpg" width="600" alt="Docker 对话页面"/>
</p>
</details>

<br />

## 为什么做 King Mate

工作、生活、会议、临时想法和各种通知常常散落在不同地方。King Mate 希望把这些入口收拢到一个本地桌面应用里：日程事项、待办清单、会议记录、AI 对话、技能扩展和多渠道通知都能在同一个工作流里完成。

- **安排更快** — 用表单或自然语言创建日程、待办和会议
- **处理更清楚** — 数据概览、分组列表、状态筛选和通知记录集中展示
- **扩展更灵活** — 技能可调用 API、AI 提示词或联网搜索，把动态内容带进通知
- **数据更可控** — 本地数据库存储，可选加密，也支持本地 HTTP API 和 Docker Headless 模式

<br />

## 核心功能

### 日程管理

- **循环任务** — 按分钟 / 小时 / 天 / 月 / 年周期触发
- **定时事项** — 指定日期时间一次性触发，触发后自动停用
- **农历事项** — 支持按农历日期设置，每年自动换算阳历
- **星期筛选** — 周循环模式下指定星期几触发
- **工作日 / 节假日模式** — 内置中国法定节假日数据，可仅在工作日或节假日触发
- **活跃时段** — 设定每日生效时间范围（如 09:00–18:00）
- **结束时间** — 可选设置截止日期，到期自动停用
- **自定义图标 / 颜色** — 每条事项可选独立 emoji 图标和颜色标识
- **托盘暂停** — 系统托盘一键暂停 / 恢复所有计划
- **技能绑定** — AI 模式下可为事项绑定技能，触发前自动获取动态内容

### 待办事项

- **快速添加** — 输入内容回车即添加，支持描述、日期和优先级
- **按天分组** — 自动按逾期 / 今天 / 明天 / 即将到来分组
- **优先级排序** — 紧急 > 重要 > 普通，高优先级置顶
- **图片支持** — Ctrl+V 粘贴图片关联待办
- **完成折叠** — 已完成事项可隐藏或展开，列表保持清爽
- **逾期跟进** — 前一天未完成的待办自动归入逾期组
- **定时通知** — 可配置截止日通知和每日待办总结，通知渠道可自选

### 会议管理

- **会议记录** — 创建会议并记录标题、描述、参与者、地点
- **分段内容** — 支持文本段、音频段和录音片段，方便整理会议材料
- **AI 摘要** — 基于会议记录生成总结、议题、决议、行动项和要点
- **AI 问答** — 可直接围绕会议内容追问
- **附件管理** — 支持拖拽上传文档、图片和音频附件
- **状态追踪** — 待开始 / 进行中 / 已完成

### AI 智能对话

内置 AI 助手，支持自然语言创建和管理日程、待办、技能，也可以作为日常对话入口。

- **自然语言操作** — "明天下午3点开会"、"添加待办：完成报告"
- **多会话管理** — 多个对话独立上下文，历史记录持久化
- **多轮对话** — 连续对话上下文关联
- **图片识别** — 发送图片，AI 识别后可创建相关事项
- **思维链展示** — 支持 DeepSeek-R1、qwq 等推理模型的推理过程
- **技能调用** — AI 自动调用技能获取动态内容（如天气）并绑定到事项
- **联网搜索** — AI 对话可调用联网搜索技能，获取实时信息
- **微信连接** — 扫码连接后，微信消息可交给 AI 助手处理并回复

**支持的 AI 服务商：**

| 服务商 | 说明 |
|:--|:--|
| OpenAI | GPT-4o、GPT-4o-mini、o1-mini、o3-mini 等 |
| DeepSeek | deepseek-chat、deepseek-reasoner |
| 阿里百炼（通义千问） | qwen-plus、qwq-plus、qwen-coder-plus 等 |
| Kimi（月之暗面） | moonshot-v1 系列 |
| 智谱 GLM | glm-4-flash、glm-4-plus、glm-z1-flash 等 |
| Claude（Anthropic） | claude-sonnet-4、claude-haiku-4、claude-opus-4 |
| 字节豆包 | doubao-pro、doubao-lite 系列 |
| 腾讯混元 | hunyuan-lite、hunyuan-turbo 等 |
| 百度文心一言 | ernie-4.0、ernie-3.5、ernie-speed 系列 |
| 讯飞星火 | 4.0Ultra、generalv3.5 等 |
| 零一万物（Yi） | yi-lightning、yi-large 等 |
| SiliconFlow（硅基流动） | Qwen、DeepSeek、GLM 等开源模型 |
| Groq | llama-3.3、mixtral 等 |
| 小米 | MiMo |
| Ollama（本地） | 本地部署任意模型（qwen3、deepseek-r1、llama3 等） |
| 自定义 | OpenAI / Anthropic 兼容接口 |

**联网搜索服务商：**

| 服务商 | 搜索协议 | 说明 |
|:--|:--|:--|
| Perplexity | OpenAI 兼容 | sonar、sonar-pro、sonar-reasoning 等 |
| Tavily | Tavily 协议 | tavily-search、tavily-extract |
| Jina | Jina 协议 | jina-search、jina-reader、grounding |
| 博查 AI | 博查协议 | bocha-web-search、bocha-ai-search |
| Exa | Exa 协议 | exa-search、exa-contents |

### 技能系统

技能可以独立执行，也可以绑定到日程事项，每次触发时自动获取动态内容。

**内置技能：**

| 技能 | 说明 |
|:--|:--|
| 天气查询 | 实时天气信息 |
| 每日一言 | 励志名言 / 哲理金句 / 唯美句子 |
| 倒计时 | 日期倒计时计算 |
| 喝水助手 | 按时间段推荐饮水量 |
| 诗词推荐 | 古典诗词赏析 |
| 健康贴士 | 按时段健康建议（早/午/晚） |
| 运动推荐 | 室内/户外/轻量运动推荐 |
| 每日英语 | 英语词汇学习（含音标和例句） |
| 每日一笑 | 笑话 / 段子 |
| 星座运势 | 每日星座运势 |
| 农历信息 | 农历日期展示 |
| 工作汇报 | 工作总结素材 |

**自定义技能类型：** API 调用 / AI 提示词 / 联网搜索 + AI 总结

**技能商店：** 内置社区技能商店，一键浏览、安装和更新社区技能，无需手动配置；支持按分类搜索和查看安装状态。

### 多渠道通知

每个事项可同时启用多个通知渠道，均支持独立配置和发送测试。

| 渠道 | 说明 |
|:--|:--|
| 桌面通知 | 自定义浮窗（最多同时 3 条），支持提示音、自动消失、进度条动画 |
| 邮件 | SMTP 发送，支持 SSL/TLS，多收件人 |
| Telegram | Bot API 推送，支持多 Chat ID，支持 HTTP 代理 |
| 企业微信 | 应用消息推送，支持 `@all` 或指定用户 |
| 企微群机器人 | Webhook 群消息推送 |
| 微信 | 通过微信机器人（ClawBot）主动推送，扫码登录绑定 |
| 测试公众号 | 微信公众平台测试号消息推送，支持客服文本消息和模板消息 |
| 钉钉 | 群机器人 Webhook 推送 |
| 飞书 | 群机器人 Webhook 推送 |
| Bark | iOS 推送通知 |
| Discord | Webhook 推送 |
| Webhook | 自定义 HTTP 请求（GET/POST/PUT/PATCH），支持自定义 Header 和模板变量 |

### 模型与系统

- **模型配置** — 支持对话模型与联网搜索模型分组管理，可配置多模型、默认模型和多模态标记
- **应用模式** — 支持 AI 模式和普通模式，按使用习惯隐藏或展示 AI 相关入口
- **外观主题** — 支持亮色、暗色和跟随系统
- **托盘行为** — 支持开机自启动、关闭时最小化到托盘、置顶窗口等桌面行为
- **提示音** — 支持内置音效、系统提示音、自定义音乐或静音
- **API 服务** — 可启用本地 HTTP API，配置监听地址、端口和 Bearer Token
- **自动更新** — 系统设置中可检查新版本

### 数据安全

- **AES-256-GCM 加密** — 数据库文件可选加密，密钥独立存储
- **密钥分离** — 加密数据库（`remind.db.enc`）与密钥文件（`remind.key`）分开存放
- **透明加解密** — 应用启动自动加载密钥，无需手动输入密码
- **本地优先** — 应用数据默认保存在本机，真实凭据通过本地配置或环境变量提供

## 技术栈

| 分类 | 技术 |
|:--|:--|
| 桌面框架 | Electron 33 |
| 前端 | Vue 3 + TypeScript |
| 构建 | electron-vite + Vite |
| UI | Element Plus |
| 状态管理 | Pinia |
| 数据库 | sql.js（SQLite），支持 AES-256-GCM 加密 |
| 节假日 | chinese-days |
| 邮件 | Nodemailer |
| 通信 | 本地 HTTP API |
| HTTP | Axios |
| 样式 | SCSS |
| 打包 | electron-builder |

<br />

## 快速开始

### 环境要求

- Node.js >= 22
- npm

### 安装与运行

```bash
git clone https://github.com/coder-kingyifan/king-mate.git
cd king-mate

# 安装依赖（建议设置国内镜像源）
npm config set registry https://registry.npmmirror.com
npm install

# 启动开发模式（带界面）
npm run dev

# Windows 用户如遇控制台中文乱码
npm run dev:win

# 启动 Headless 模式（终端 REPL 交互）
npm run dev:headless
```

> 按 `F12` 打开开发者工具

### 构建打包

**Windows：**

```bash
npm run build       # 编译前端和主进程
npm run pack        # 打包 Windows 安装程序 (NSIS) + 便携版
npm run pack:dir    # 打包为免安装目录
```

产物输出到 `dist/` 目录：`king-mate-V2.0.1-setup.exe`（安装程序）、`king-mate-V2.0.1-portable.exe`（便携版）

**macOS / Linux：**

```bash
npm run build
npx electron-builder --mac --config    # macOS（需在 macOS 上操作）
npx electron-builder --linux --config  # Linux
```

> macOS 打包需在 macOS 系统上操作，如需签名和公证需配置 Apple Developer 证书。

<br />

## Docker 部署

支持在无图形界面的服务器环境下以 Headless 模式运行，通过环境变量预配置通知渠道。

```bash
git clone https://github.com/coder-kingyifan/king-mate.git
cd king-mate

# 复制环境变量模板并配置通知渠道
cp .env.example .env

# 构建并后台启动
docker compose up -d --build

# 查看启动日志
docker compose logs -f
```

### 核心特性

- **国内加速** — 内置清华及阿里镜像源，秒级构建
- **持久化** — 数据存储于 `remind-data` 卷，重启不丢失
- **交互支持** — 支持 Docker 交互模式，直接命令行对话
- **通知预配置** — 通过 `KING_*` 环境变量预配置邮件、Telegram、企业微信、钉钉、飞书等渠道
- **健康检查** — 内置 curl 健康检查，自动监控服务状态

### 容器交互

```bash
# 进入交互 REPL（支持所有命令）
docker compose exec king-mate king-repl

# 单条命令执行
docker compose exec king-mate king-repl /status
docker compose exec king-mate king-repl "明天下午3点开会"

# 交互模式启动（前台 REPL）
docker compose run --rm king-mate
```

### 通知渠道配置

**方式一：环境变量预配置（推荐）**

复制 `.env.example` 为 `.env`，按需填写：

| 变量前缀 | 渠道 | 关键配置项 |
|:--|:--|:--|
| `KING_EMAIL_*` | 邮件 | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM`, `TO` |
| `KING_TELEGRAM_*` | Telegram | `BOT_TOKEN`, `CHAT_ID`, `PROXY_URL` |
| `KING_WECHAT_WORK_*` | 企业微信 | `CORP_ID`, `CORP_SECRET`, `AGENT_ID`, `TO_USER` |
| `KING_WECHAT_WORK_WEBHOOK_*` | 企微群机器人 | `WEBHOOK_URL` |
| `KING_DINGTALK_*` | 钉钉 | `WEBHOOK_URL`, `SECRET` |
| `KING_FEISHU_*` | 飞书 | `WEBHOOK_URL` |
| `KING_BARK_*` | Bark | `SERVER_URL`, `KEY` |
| `KING_DISCORD_*` | Discord | `WEBHOOK_URL` |
| `KING_WEBHOOK_*` | 自定义 Webhook | `URL` |

> 默认不覆盖数据库已有配置。如需强制覆盖，设置 `KING_CONFIG_OVERRIDE=true`。

**方式二：通过 API 配置**

```bash
# 查看通知渠道配置
curl http://localhost:33333/api/notifications/configs

# 更新渠道配置
curl -X PUT http://localhost:33333/api/notifications/configs/wechat_work_webhook \
  -H "Content-Type: application/json" \
  -d '{"is_enabled":1,"config_json":"{\"webhook_url\":\"https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx\"}"}'

# 测试通知渠道
curl -X POST http://localhost:33333/api/notifications/test/wechat_work_webhook
```

### 常用命令

```bash
docker compose up -d --build   # 重新构建并启动
docker compose logs -f          # 查看实时日志
docker compose restart          # 重启服务
docker compose down             # 停止并移除容器
```

### 环境变量

| 变量 | 默认值 | 说明 |
|:--|:--|:--|
| `KING_API_ENABLED` | `true` | API 服务开关 |
| `KING_API_PORT` | `33333` | API 端口 |
| `KING_API_TOKEN` | 空 | API 鉴权令牌（留空不鉴权） |
| `KING_CONFIG_OVERRIDE` | `false` | 是否允许环境变量覆盖数据库已有配置 |
| `API_HOST` | `0.0.0.0` | API 监听地址 |

<br />

## HTTP API

应用启动后在本地开启 REST API（默认端口 `33333`），支持可选 Bearer Token 认证。

接口分组：

| 分组 | 接口 |
|:--|:--|
| 健康检查 | `GET /api/ping` |
| 日程事项 | `POST /api/reminders`、`GET /api/reminders`、`GET /api/reminders/:id`、`DELETE /api/reminders/:id` |
| 待办 | `POST /api/todo`、`GET /api/todo`、`GET /api/todo/stats`、`GET /api/todo/:id`、`PUT /api/todo/:id`、`DELETE /api/todo/:id`、`POST /api/todo/:id/toggle` |
| AI 对话 | `POST /api/chat` |
| 模型配置 | `GET /api/models` |
| 通知配置 | `GET /api/notifications/configs`、`PUT /api/notifications/configs/:channel`、`POST /api/notifications/test/:channel` |
| 系统设置 | `GET /api/settings`、`PUT /api/settings` |
| 微信机器人 | `GET /api/wechat-bot/qrcode`、`GET /api/wechat-bot/status`、`POST /api/wechat-bot/login`、`POST /api/wechat-bot/logout`、`POST /api/wechat-bot/toggle` |

```bash
# 健康检查
curl http://127.0.0.1:33333/api/ping

# 创建事项
curl -X POST http://127.0.0.1:33333/api/reminders \
  -H "Content-Type: application/json" \
  -d '{"title":"喝水","remind_type":"interval","start_time":"2025-06-01T09:00:00","interval_value":30,"interval_unit":"minutes","channels":["desktop"]}'

# AI 对话
curl -X POST http://127.0.0.1:33333/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"明天下午3点开会"}'

# 获取事项列表
curl http://127.0.0.1:33333/api/reminders?is_active=1
```

完整接口文档见 [API.md](./API.md)。

<br />

## 项目结构

```
king-mate/
├── electron/
│   ├── main/                  # 主进程
│   │   ├── index.ts           # 入口，窗口 / 托盘 / 调度器初始化
│   │   ├── repl.ts            # 终端 REPL 交互模式
│   │   ├── scheduler.ts       # 任务调度器（含农历 / 工作日判定）
│   │   ├── llm.ts             # LLM 集成（多服务商 / 流式 / 工具调用 / 联网搜索）
│   │   ├── skill-store.ts     # 技能商店（远程清单 / 安装 / 更新 / 卸载）
│   │   ├── api-server.ts      # 本地 HTTP API 服务
│   │   ├── env-config.ts      # Headless / Docker 环境变量预配置
│   │   ├── updater.ts         # 更新检查
│   │   ├── db/                # 数据库层
│   │   │   ├── connection.ts  # SQLite 连接 / 加密
│   │   │   ├── reminders.ts   # 事项 CRUD
│   │   │   ├── todos.ts       # 待办 CRUD
│   │   │   ├── meetings.ts    # 会议管理
│   │   │   ├── skills.ts      # 技能 CRUD
│   │   │   └── ...            # 其他数据表
│   │   ├── notifications/     # 通知渠道（桌面 / 邮件 / TG / 企微 / 微信 / 钉钉 / 飞书 / Bark / Discord / Webhook）
│   │   └── skills/            # 技能执行器
│   └── preload/               # 预加载脚本
├── src/
│   ├── pages/                 # 页面：AI 对话 / 数据概览 / 日程 / 待办 / 会议 / 设置 / 技能 / 技能商店 / 鸣谢
│   ├── components/            # 布局组件 / 事项表单 / 聊天 / 技能 / 设置向导
│   ├── stores/                # Pinia 状态管理
│   └── assets/                # SCSS 样式 / 静态资源
├── resources/                 # 应用图标 / 提示音
├── docs/acknowledgements.json # 鸣谢页本地数据
├── API.md                     # HTTP API 文档
├── Dockerfile                 # Docker 构建文件
└── docker-compose.yml         # Docker Compose 配置
```

<br />

## 配置指南

<details>
<summary><b>Telegram</b></summary>
<br />

1. 在 Telegram 搜索 **@BotFather**，发送 `/newbot` 创建机器人，获取 **Bot Token**
2. 搜索 **@userinfobot**，发送任意消息获取你的数字 **Chat ID**
3. 给你创建的机器人发送 `/start` 启动对话
4. 在应用「通知渠道 → Telegram」中填入 Bot Token 和 Chat ID（支持多个，逗号分隔）
5. 国内网络需填写代理地址（如 `http://127.0.0.1:7890`）

</details>

<details>
<summary><b>邮件（SMTP）</b></summary>
<br />

| 邮箱 | SMTP 服务器 | 端口 | SSL |
|:--|:--|:--|:--|
| QQ 邮箱 | smtp.qq.com | 465 | 是 |
| 163 邮箱 | smtp.163.com | 465 | 是 |
| Gmail | smtp.gmail.com | 587 | 否 |

> 密码字段填写邮箱的**授权码**（非登录密码）。收件人支持多个地址，逗号分隔。

</details>

<details>
<summary><b>企业微信</b></summary>
<br />

1. 在 [企业微信管理后台](https://work.weixin.qq.com/) 创建应用
2. 获取 **企业 ID**（Corp ID）、**应用 Secret** 和 **Agent ID**
3. 在应用「通知渠道 → 企业微信」中填写以上信息
4. 接收者填 `@all`（全员）或用 `|` 分隔的用户 ID

</details>

<details>
<summary><b>微信（ClawBot 机器人）</b></summary>
<br />

1. 在应用「微信机器人」页面点击获取二维码，使用微信扫码登录
2. 登录成功后，在微信中给机器人发一条消息完成绑定
3. 绑定完成后，在「通知渠道 → 微信」中启用该渠道
4. 事项触发时自动通过微信机器人发送消息

> 需先完成绑定才能启用微信通知渠道。断开连接后需重新绑定。

</details>

<details>
<summary><b>Webhook</b></summary>
<br />

支持自定义 HTTP 方法（GET/POST/PUT/PATCH）和请求头。默认请求体：

```json
{
  "title": "事项标题",
  "body": "事项内容",
  "icon": "🔔",
  "reminderId": 42
}
```

可使用 `{{title}}`、`{{body}}`、`{{reminder_id}}` 模板变量自定义。

</details>

<br />

## 许可证

[CC BY-NC-SA 4.0](LICENSE) — 署名-非商业性使用-相同方式共享

- **署名** — 须注明原作者
- **非商业性使用** — 不得用于商业目的，仅限个人学习和学校使用
- **相同方式共享** — 基于本作品的演绎作品须采用相同的协议

## 联系

**作者**：kingyifan
&nbsp;&middot;&nbsp;
[GitHub](https://github.com/coder-kingyifan)
&nbsp;&middot;&nbsp;
[Issues](https://github.com/coder-kingyifan/king-mate/issues)

如果您有好的想法和建议可以关注公众号联系作者：

<p align="center">
  <img src="./docs/gzhqcode.jpg" width="180" alt="公众号二维码" />
</p>

## 打赏

觉得好用？请作者喝杯咖啡

<p align="center">
  <img src="./resources/alipay.jpg" width="180" alt="支付宝" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="./resources/wechatpay.jpg" width="180" alt="微信" />
</p>

---

## 特别鸣谢

[Linux.do](https://linux.do/t/topic/1830841)、
[奶昔论坛](https://forum.naixi.net/thread-11364-1-1.html)、
[NodeSeek](https://www.nodeseek.com/post-692113-1)、
[吾爱破解](https://www.52pojie.cn/thread-2103637-1-1.html)

<p align="center">
  如果这个项目对你有帮助，欢迎给一个 Star
</p>

<p align="center">
  <a href="https://www.star-history.com/#coder-kingyifan/king-mate&type=date&legend=top-left">
    <img src="https://api.star-history.com/svg?repos=coder-kingyifan/king-mate&type=date&legend=top-left" width="600" alt="Star History" />
  </a>
</p>
