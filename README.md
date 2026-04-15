<p align="center">
  <img src="./resources/icon.png" width="96" alt="King提醒助手" />
</p>

<h1 align="center">King 提醒助手</h1>

<p align="center">
  <b>功能丰富的桌面提醒应用，支持多渠道通知、AI 对话、技能商店、农历提醒与外部 API 集成</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js&logoColor=white" alt="Vue" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Element%20Plus-2.9-409EFF?logo=element&logoColor=white" alt="Element Plus" />
  <img src="https://img.shields.io/badge/Version-2.0.0-blue" alt="Version" />
  <img src="https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-orange" alt="License" />
</p>

<br />

## 界面预览

<table>
    <tr>
        <td><img src="./docs/readme/1.jpg" width="280" alt="欢迎页"/></td>
        <td><img src="./docs/readme/2.jpg" width="280" alt="数据库密码设置"/></td>
        <td><img src="./docs/readme/3.jpg" width="280" alt="Api接口设置"/></td>
    </tr>
    <tr>
        <td><img src="./docs/readme/4.jpg" width="280" alt="欢迎页"/></td>
        <td><img src="./docs/readme/5.jpg" width="280" alt="ai对话页（黑）"/></td>
        <td><img src="./docs/readme/6.jpg" width="280" alt="ai对话页（白）"/></td>
    </tr>
    <tr>
        <td><img src="./docs/readme/7.jpg" width="280" alt="数据概览"/></td>
        <td><img src="./docs/readme/8.jpg" width="280" alt="提醒管理"/></td>
        <td><img src="./docs/readme/9.jpg" width="280" alt="通知渠道"/></td>
    </tr>
    <tr>
        <td><img src="./docs/readme/10.jpg" width="280" alt="模型配置"/></td>
        <td><img src="./docs/readme/11.jpg" width="280" alt="技能中心"/></td>
        <td><img src="./docs/readme/12.jpg" width="280" alt="技能商店"/></td>
    </tr>
    <tr>
        <td><img src="./docs/readme/13.jpg" width="280" alt="系统设置"/></td>
        <td><img src="./docs/readme/14.jpg" width="280" alt="系统设置"/></td>
        <td><img src="./docs/readme/15.jpg" width="280" alt="对话示例"/></td>
    </tr>
</table>

<br />

## 创作初衷

### 在快节奏的时代，我们都在与"遗忘"抗争

现代生活的节奏越来越快，信息爆炸、任务繁重、压力剧增。我们的大脑每天都在处理海量信息，而**遗忘**，这个人类与生俱来的弱点，在数字时代被无限放大。

#### 那些被遗忘的重要时刻

- 💧 **健康管理的缺失** —— 连续工作数小时忘记喝水，直到身体发出警报才意识到自我关怀的重要性
- 🎂 **情感连接的断裂** —— 至亲好友的生日、纪念日等特殊时刻，因为忙碌而被搁置，事后追悔莫及
- 💕 **仪式感的消逝** —— 那些承载着爱与承诺的纪念日被忽略，让珍贵的关系蒙上遗憾的阴影
- 🏋️ **自律计划的夭折** —— 健身、阅读、学习的计划一次次被推迟，"下次一定"成了最无奈的借口
- 📝 **灵感的稍纵即逝** —— 脑海中闪现的创意和待办事项，没有及时记录便永远消失在时间的洪流中

#### 从个人痛点到产品使命

这不仅仅是一个提醒工具，而是**对现代人健忘症候群的温柔救赎**。

我们相信：

> **真正重要的不是提醒本身，而是那些被记住的瞬间所承载的价值** ——
> 一杯水的关怀，一句生日祝福的温暖，一次健身的坚持，一份纪念日的仪式感。

**King 提醒助手** 由此诞生。

它不只是一个冷冰冰的工具，而是你生活中的**数字管家**、**习惯教练**和**情感守护者**
。它将那些容易被遗忘的琐碎编织成一张温柔的守护网，让你在繁忙中不错过健康，在匆忙中不遗漏关爱，在忙碌中不失约自己。

**让科技有温度，让提醒有意义，让生活无遗憾。**

<br />

## 功能特性

### 提醒管理

- **循环提醒** — 按分钟 / 小时 / 天 / 月 / 年周期触发
- **定时提醒** — 指定日期时间一次性触发，触发后自动停用
- **农历提醒** — 支持按农历日期（如正月初一）设置提醒，每年自动换算阳历日期
- **星期筛选** — 周循环模式下指定星期几触发
- **工作日 / 节假日模式** — 内置中国法定节假日数据（`chinese-days`），可仅在工作日或仅在节假日触发
- **活跃时段** — 设定每日生效时间范围（如 09:00–18:00），避免非工作时间打扰
- **结束时间** — 可选设置提醒截止日期，到期自动停用
- **自定义图标 / 颜色** — 每条提醒可选独立 emoji 图标和颜色标识
- **托盘暂停** — 通过系统托盘一键暂停 / 恢复所有提醒

### AI 智能对话

内置 AI 助手，支持自然语言创建和管理提醒，无需手动填写表单。

- **自然语言创建提醒** — "明天下午3点提醒我开会"、"每30分钟提醒我喝水"、"工作日每天早上9点站会"
- **多会话管理** — 支持创建多个对话，独立上下文，历史记录持久化存储
- **多轮对话** — 支持连续对话，上下文关联
- **图片识别** — 发送图片内容，AI 识别后可创建相关提醒
- **思维链展示** — 支持展示 AI 推理过程（DeepSeek-R1、qwq 等推理模型）
- **提醒管理** — "查看我的提醒"、"删除第3个提醒"
- **技能调用** — AI 可自动调用技能获取动态内容（如天气）并绑定到提醒
- **联网搜索** — AI 对话可调用联网搜索技能，获取实时信息

**支持的 AI 服务商：**

| 服务商               | 说明                                           |
|:------------------|:---------------------------------------------|
| OpenAI            | GPT-4o、GPT-4o-mini、o1-mini、o3-mini 等         |
| DeepSeek          | deepseek-chat、deepseek-reasoner              |
| 阿里百炼（通义千问）        | qwen-plus、qwq-plus、qwen-coder-plus 等         |
| Kimi（月之暗面）        | moonshot-v1 系列                               |
| 智谱 GLM            | glm-4-flash、glm-4-plus、glm-z1-flash 等        |
| Claude（Anthropic） | claude-sonnet-4、claude-haiku-4、claude-opus-4 |
| 字节豆包              | doubao-pro、doubao-lite 系列                    |
| 腾讯混元              | hunyuan-lite、hunyuan-turbo 等                 |
| 百度文心一言            | ernie-4.0、ernie-3.5、ernie-speed 系列           |
| 讯飞星火              | 4.0Ultra、generalv3.5 等                       |
| 零一万物（Yi）          | yi-lightning、yi-large 等                      |
| SiliconFlow（硅基流动） | Qwen、DeepSeek、GLM 等开源模型                      |
| Groq              | llama-3.3、mixtral 等                          |
| 小米                | MiMo                                         |
| Ollama（本地）        | 本地部署任意模型（qwen3、deepseek-r1、llama3 等）         |
| 自定义               | OpenAI / Anthropic 兼容接口                      |

**联网搜索服务商：**

| 服务商        | 搜索协议      | 说明                                |
|:-----------|:----------|:----------------------------------|
| Perplexity | OpenAI 兼容 | sonar、sonar-pro、sonar-reasoning 等 |
| Tavily     | Tavily 协议 | tavily-search、tavily-extract      |
| Jina       | Jina 协议   | jina-search、jina-reader、grounding |
| 博查 AI      | 博查协议      | bocha-web-search、bocha-ai-search  |
| Exa        | Exa 协议    | exa-search、exa-contents           |

### 技能系统

提醒可绑定技能，每次触发时自动执行技能获取动态内容。

**内置技能：**

| 技能       | 说明                 |
|:---------|:-------------------|
| 🌤️ 天气查询 | 实时天气信息             |
| 💬 每日一言  | 励志名言 / 哲理金句 / 唯美句子 |
| ⏳ 倒计时    | 日期倒计时计算            |
| 💧 喝水提醒  | 按时间段推荐饮水量          |
| 📜 诗词推荐  | 古典诗词赏析             |
| 🏥 健康贴士  | 按时段健康建议（早/午/晚）     |
| 🏃 运动推荐  | 室内/户外/轻量运动推荐       |
| 📖 每日英语  | 英语词汇学习（含音标和例句）     |
| 😄 每日一笑  | 笑话 / 段子            |
| ⭐ 星座运势   | 每日星座运势             |
| 🌙 农历信息  | 农历日期展示             |
| 📋 工作汇报  | 工作总结提醒             |

**自定义技能类型：**

- **API 调用** — 调用外部 API 获取数据
- **AI 提示词** — 通过 AI 动态生成内容
- **搜索总结** — 联网搜索 + AI 总结

### 技能商店

内置社区技能商店，一键浏览、安装和更新社区技能，无需手动配置。

- **在线浏览** — 从 GitHub 社区仓库获取最新技能列表，支持分类筛选和关键词搜索
- **一键安装** — 点击安装即可自动下载技能配置，保留用户自定义设置
- **版本更新** — 自动检测已安装技能的版本差异，提示可更新的技能

### 多渠道通知

每个提醒可同时启用多个通知渠道，每个渠道均支持独立配置和发送测试。

| 渠道           | 说明                                                 |
|:-------------|:---------------------------------------------------|
| **桌面通知**     | 自定义浮窗（最多同时 3 条），支持提示音、自动消失、进度条动画                   |
| **邮件**       | SMTP 发送，支持 SSL/TLS，多收件人                            |
| **Telegram** | Bot API 推送，支持多 Chat ID，支持 HTTP 代理                  |
| **企业微信**     | 应用消息推送，支持 `@all` 或指定用户，自动刷新 access_token           |
| **企微群机器人**   | Webhook 群消息推送                                      |
| **测试公众号**    | 微信公众平台测试号消息推送，支持客服文本消息和模板消息                         |
| **Webhook**  | 自定义 HTTP 请求（GET/POST/PUT/PATCH），支持自定义 Header 和模板变量 |

### 数据安全

- **AES-256-GCM 加密** — 数据库文件可选加密，密钥独立存储
- **密钥分离** — 加密数据库（`remind.db.enc`）与密钥文件（`remind.key`）分开存放，拿到数据库文件无法直接读取
- **透明加解密** — 应用启动自动加载密钥，无需手动输入密码

### 系统功能

- 亮色 / 暗色 / 跟随系统 三种主题
- 开机自启动
- 关闭窗口最小化到系统托盘
- 可调节调度检查间隔（默认 60 秒）
- 通知日志记录，支持查看与清理
- **网络调试** — 主进程网络请求自动同步到 DevTools Network 面板，API Key 等敏感信息自动脱敏
- **Headless 模式** — 无界面纯后台运行，支持终端 REPL 交互
- **本地 HTTP API** — 供外部程序通过 REST 接口创建和管理提醒

<br />

## 技术栈

| 分类   | 技术                               |
|:-----|:---------------------------------|
| 桌面框架 | Electron 33                      |
| 前端   | Vue 3 + TypeScript               |
| 构建   | electron-vite + Vite             |
| UI   | Element Plus                     |
| 状态管理 | Pinia                            |
| 数据库  | sql.js（SQLite），支持 AES-256-GCM 加密 |
| 节假日  | chinese-days                     |
| 邮件   | Nodemailer                       |
| HTTP | Axios                            |
| 样式   | SCSS                             |
| 打包   | electron-builder                 |

<br />

## 快速开始

### 环境要求

- Node.js >= 22
- npm

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/coder-kingyifan/king-remind.git
cd king-remind

# 安装依赖（建议设置国内镜像源）
npm config set registry https://registry.npmmirror.com
npm install

# 启动开发模式（带界面）
npm run dev

# Windows 用户如遇控制台中文乱码，使用：
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

产物输出到 `dist/` 目录：

- `king-remind-{version}-setup.exe` — NSIS 安装程序
- `king-remind-{version}-portable.exe` — 免安装便携版

**macOS：**

```bash
# 编译
npm run build

# 打包 Mac 应用（需要在 macOS 上操作）
npx electron-builder --mac --config
```

产物：

- `.dmg` — macOS 磁盘镜像（标准分发格式）
- `.zip` — 压缩包

> **注意：** macOS 打包需要在 macOS 系统上操作。如需签名和公证，需配置 Apple Developer
> 证书。详见 [electron-builder macOS 文档](https://www.electron.build/mac)。

如需自定义 macOS 打包配置，在 `electron-builder.yml` 中添加：

```yaml
mac:
  icon: resources/icon.png
  target:
    - target: dmg
      arch:
        - x64
        - arm64
    - target: zip
      arch:
        - x64
        - arm64
  category: public.app-category.productivity
```

**Linux：**

```bash
npm run build
npx electron-builder --linux --config
```

<br />

## Docker 部署

适用于 Linux 服务器、NAS、云主机等无图形界面环境。以 Headless 模式运行，提供终端 REPL 交互和 HTTP API 服务。

### 环境要求

- Docker
- Docker Compose

### 快速启动

```bash
# 克隆项目
git clone https://github.com/coder-kingyifan/king-remind.git
cd king-remind

# 构建并启动（交互模式，进入终端 REPL）
docker compose run --rm king-remind

# 后台运行（仅 API 服务）
docker compose up -d --build
```

> **注意：** Docker 构建使用 Node.js 22 镜像，`package.json` 中的平台特定依赖（rollup）通过 `optionalDependencies`
> 自动适配。Windows 生成的 `package-lock.json` 不会复制到容器中，由 Docker 构建时重新解析。

### 终端 REPL 交互

Docker 交互模式下，提供完整的终端命令行界面：

```
================================================
  King 提醒助手 - 终端模式
================================================

  可用命令:
    /help          显示帮助
    /config        配置 AI 模型
    /chat          AI 对话模式
    /reminders     管理提醒
    /models        管理模型配置
    /status        系统状态
    /setup         初始设置
    /quit          退出

  提示: 直接输入文字即可与 AI 对话
================================================
```

| 命令                       | 说明                               |
|:-------------------------|:---------------------------------|
| `/config`                | 交互式配置 AI 模型（选服务商 → API Key → 模型） |
| `/config show`           | 查看当前模型配置                         |
| `/config test`           | 测试模型连接                           |
| `/chat`                  | 进入 AI 聊天模式（流式输出）                 |
| `/chat <消息>`             | 发送单条消息                           |
| `/models`                | 列出所有模型配置                         |
| `/models default <id>`   | 设置默认模型                           |
| `/reminders`             | 列出提醒                             |
| `/reminders toggle <id>` | 启用/禁用提醒                          |
| `/reminders delete <id>` | 删除提醒                             |
| `/status`                | 系统状态                             |
| `/setup`                 | 初始设置（昵称、API 端口等）                 |
| `/quit`                  | 退出应用                             |

> 直接输入文字（不带 `/` 前缀）自动发送给 AI 对话。

### 验证服务

```bash
curl http://localhost:33333/api/ping
# 返回: {"success":true,"data":{"message":"pong","version":"1.0.0"}}
```

### 常用命令

```bash
docker compose logs -f          # 查看实时日志
docker compose restart          # 重启服务
docker compose down             # 停止并移除容器
docker compose up -d --build    # 重新构建并启动
```

### 自定义端口

默认 API 端口为 `33333`，可通过环境变量修改：

```bash
API_PORT=30000 docker compose up -d
```

或创建 `.env` 文件：

```
API_PORT=30000
```

### 数据持久化

数据库文件存储在 Docker volume `remind-data` 中（挂载路径 `/app/data`），**停止或删除容器不会丢失数据**。

如需备份数据库：

```bash
docker cp king-remind:/app/data/remind.db ./remind.db.bak
```

### 环境变量

| 变量         | 默认值         | 说明                               |
|:-----------|:------------|:---------------------------------|
| `API_HOST` | `127.0.0.1` | API 监听地址，Docker 中自动设为 `0.0.0.0`  |
| `API_PORT` | `33333`     | 宿主机映射端口                          |
| `DB_DIR`   | 当前目录        | 数据库文件目录，Docker 中自动设为 `/app/data` |

<br />

## Headless 模式

不创建主窗口，仅运行后台服务（数据库、调度器、API Server）并提供终端 REPL 交互。

适用场景：

- 服务器 / Docker 无图形界面环境
- 开机静默启动，不弹出界面
- 仅通过 HTTP API 管理提醒
- 通过终端 REPL 交互配置和对话

```bash
# 桌面应用
King提醒助手.exe --headless

# Docker 交互模式
docker compose run --rm king-remind

# Docker 后台模式（无 REPL，仅 API）
docker compose up -d
```

<br />

## HTTP API

应用启动后在本地开启 REST API（默认端口 `33333`），支持可选 Bearer Token 认证。

```bash
# 健康检查
curl http://127.0.0.1:33333/api/ping

# 创建定时提醒
curl -X POST http://127.0.0.1:33333/api/reminders \
  -H "Content-Type: application/json" \
  -d '{"title":"喝水","remind_type":"scheduled","start_time":"2025-06-01T10:00:00","channels":["desktop"]}'

# 创建循环提醒（工作日 09:00-18:00 每 30 分钟）
curl -X POST http://127.0.0.1:33333/api/reminders \
  -H "Content-Type: application/json" \
  -d '{"title":"活动一下","remind_type":"interval","start_time":"2025-06-01T09:00:00","interval_value":30,"interval_unit":"minutes","workday_only":true,"active_hours_start":"09:00","active_hours_end":"18:00","channels":["desktop","webhook"]}'

# AI 对话
curl -X POST http://127.0.0.1:33333/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"明天下午3点提醒我开会"}'

# 获取所有激活的提醒
curl http://127.0.0.1:33333/api/reminders?is_active=1

# 获取模型配置列表
curl http://127.0.0.1:33333/api/models

# 删除提醒
curl -X DELETE http://127.0.0.1:33333/api/reminders/42
```

完整接口文档见 [API.md](./API.md)。

<br />

## 项目结构

```
king-remind/
├── electron/
│   ├── main/                  # 主进程
│   │   ├── index.ts           # 入口，窗口 / 托盘 / 调度器初始化
│   │   ├── repl.ts            # 终端 REPL 交互模式（Docker/Headless）
│   │   ├── tray.ts            # 系统托盘
│   │   ├── scheduler.ts       # 提醒调度器（含农历 / 工作日判定）
│   │   ├── ipc-handlers.ts    # IPC 通信处理
│   │   ├── api-server.ts      # 本地 HTTP API 服务
│   │   ├── llm.ts             # LLM 集成（多服务商 / 流式 / 工具调用 / 联网搜索）
│   │   ├── skill-store.ts     # 技能商店（远程清单 / 安装 / 更新 / 卸载）
│   │   ├── network-interceptor.ts  # 网络请求拦截器（DevTools 调试）
│   │   ├── db/                # 数据库层
│   │   │   ├── connection.ts  # SQLite 连接 / 加密
│   │   │   ├── migrations.ts  # 数据库迁移（v1-v19）
│   │   │   ├── reminders.ts   # 提醒 CRUD
│   │   │   ├── skills.ts      # 技能 CRUD
│   │   │   ├── skill-content.ts  # 技能内容数据（诗词/名言/英语等）
│   │   │   ├── chat-history.ts   # AI 对话会话与消息
│   │   │   ├── model-configs.ts  # 模型配置
│   │   │   └── ...            # 其他数据表
│   │   ├── notifications/     # 通知渠道（桌面 / 邮件 / TG / 企微 / 测试公众号 / Webhook）
│   │   └── skills/            # 技能执行器
│   └── preload/               # 预加载脚本（contextBridge）
├── src/
│   ├── pages/                 # 页面：AI 对话 / 仪表盘 / 提醒 / 技能 / 技能商店 / 通知 / 模型 / 设置
│   ├── components/            # 布局组件 / 提醒表单 / 聊天 / 设置向导
│   ├── stores/                # Pinia 状态管理
│   ├── types/                 # TypeScript 类型定义
│   ├── router/                # 路由配置
│   ├── network-proxy.ts       # 渲染进程网络代理（DevTools 调试）
│   └── assets/                # SCSS 样式 / 静态资源
├── resources/                 # 应用图标 / 提示音 / 截图
├── API.md                     # HTTP API 文档
├── Dockerfile                 # Docker 构建文件
├── docker-compose.yml         # Docker Compose 配置
├── electron.vite.config.ts
├── electron-builder.yml
└── package.json
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

在「通知渠道 → 邮件」中填写 SMTP 服务器信息：

| 邮箱     | SMTP 服务器       | 端口  | SSL |
|:-------|:---------------|:----|:----|
| QQ 邮箱  | smtp.qq.com    | 465 | 是   |
| 163 邮箱 | smtp.163.com   | 465 | 是   |
| Gmail  | smtp.gmail.com | 587 | 否   |

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
<summary><b>Webhook</b></summary>
<br />

在「通知渠道 → Webhook」中填写接收地址。支持自定义 HTTP 方法（GET/POST/PUT/PATCH）和请求头。

默认请求体：

```json
{
  "title": "提醒标题",
  "body": "提醒内容",
  "icon": "🔔",
  "reminderId": 42
}
```

也可自定义模板，使用 `{{title}}`、`{{body}}`、`{{reminder_id}}` 变量。

</details>

<details>
<summary><b>测试公众号（微信公众平台测试号）</b></summary>
<br />

1. 访问 [微信公众平台测试号](https://mp.weixin.qq.com/debug/cgi-bin/sandbox?t=sandbox/login) 扫码登录
2. 获取 **appID** 和 **appsecret**，填入应用配置
3. 关注页面上的测试号二维码，获取用户的 **OpenID**（多个用逗号分隔）
4. 选择消息格式：
   - **客服消息（文本）**：直接发送文本内容，支持自定义消息模板
   - **模板消息**：需先在测试号页面点击"新增测试模板"，模板标题填 `king提醒助手`，模板内容示例：

```
{{title.DATA}}
提醒内容：{{content.DATA}}
来源：{{app_name.DATA}}
时间：{{time.DATA}}
```

5. 在应用「通知渠道 → 测试公众号」中填写模板 ID，并配置模板字段（字段名对应模板中的变量名，字段值支持 `{{title}}`、`{{body}}`、`{{app_name}}`、`{{time}}` 等模板变量）

> **注意：** 测试号的模板消息仅对关注了测试号的用户生效。正式公众号需通过微信认证后才能使用模板消息。

</details>

<br />

## 许可证

[CC BY-NC-SA 4.0](LICENSE) — 署名-非商业性使用-相同方式共享

本项目采用 Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International 协议。你可以自由地分享和修改本作品，但必须遵守以下条件：

- **署名** — 须注明原作者
- **非商业性使用** — 不得用于商业目的，仅限个人学习和学校使用
- **相同方式共享** — 基于本作品的演绎作品须采用相同的协议

## 联系

**作者**：kingyifan
&nbsp;&middot;&nbsp;
[GitHub](https://github.com/coder-kingyifan)
&nbsp;&middot;&nbsp;
[Issues](https://github.com/coder-kingyifan/king-remind/issues)

## 打赏

觉得好用？请作者喝杯咖啡 ☕

<p align="center">
  <img src="./resources/alipay.jpg" width="180" alt="支付宝" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="./resources/wechatpay.jpg" width="180" alt="微信" />
</p>

---

## 特别鸣谢

[Linux.do](https://linux.do/)

<p align="center">
  如果这个项目对你有帮助，欢迎给一个 Star
</p>

<p align="center">
  <a href="https://www.star-history.com/#coder-kingyifan/king-remind&type=date&legend=top-left">
    <img src="https://api.star-history.com/svg?repos=coder-kingyifan/king-remind&type=date&legend=top-left" width="600" alt="Star History" />
  </a>
</p>
