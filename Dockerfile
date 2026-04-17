# ---- build stage (构建阶段) ----
FROM node:22-bookworm AS builder
WORKDIR /app

# 拷贝依赖描述文件
COPY package.json ./

# 【加速与修复】：配置 NPM 镜像、Electron 镜像，并使用 --force 强制重新解析依赖
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
ENV ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"

RUN npm config set registry ${NPM_REGISTRY} && \
    npm install --force

COPY . .
RUN npm run build


# ---- runtime stage (运行阶段) ----
FROM node:22-bookworm-slim
WORKDIR /app

# 【加速】：替换 Debian 为清华源，极速安装底层系统库
RUN sed -i 's/deb.debian.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
       xvfb xauth dbus-x11 libatk1.0-0 libgtk-3-0 \
       libgbm1 libnss3 libxss1 libasound2 libx11-xcb1 \
       libglib2.0-0 curl python3 && \
    rm -rf /var/lib/apt/lists/*

# 拷贝构建产物
COPY --from=builder /app/out ./out
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/resources ./resources

# 拷贝 REPL 客户端脚本
COPY king-repl /usr/local/bin/king-repl
RUN chmod +x /usr/local/bin/king-repl

# ========== 基础环境变量 ==========
ENV API_HOST=0.0.0.0
ENV DB_DIR=/app/data
ENV ELECTRON_ENABLE_LOGGING=true
ENV ELECTRON_DISABLE_GPU=1

# ========== king-remind 配置环境变量 ==========
# 通用设置
ENV KING_API_ENABLED=true
ENV KING_API_PORT=33333
ENV KING_API_TOKEN=
# 设为 true 可让环境变量覆盖数据库中已有的配置
ENV KING_CONFIG_OVERRIDE=false

# 邮件通知渠道
ENV KING_EMAIL_ENABLED=false
ENV KING_EMAIL_SMTP_HOST=
ENV KING_EMAIL_SMTP_PORT=587
ENV KING_EMAIL_SMTP_SECURE=false
ENV KING_EMAIL_SMTP_USER=
ENV KING_EMAIL_SMTP_PASS=
ENV KING_EMAIL_FROM=
ENV KING_EMAIL_TO=

# Telegram 通知渠道
ENV KING_TELEGRAM_ENABLED=false
ENV KING_TELEGRAM_BOT_TOKEN=
ENV KING_TELEGRAM_CHAT_ID=
ENV KING_TELEGRAM_PROXY_URL=

# 企业微信通知渠道
ENV KING_WECHAT_WORK_ENABLED=false
ENV KING_WECHAT_WORK_CORP_ID=
ENV KING_WECHAT_WORK_CORP_SECRET=
ENV KING_WECHAT_WORK_AGENT_ID=
ENV KING_WECHAT_WORK_TO_USER=@all

# 企微群消息推送 Webhook 渠道
ENV KING_WECHAT_WORK_WEBHOOK_ENABLED=false
ENV KING_WECHAT_WORK_WEBHOOK_URL=

# 微信测试公众号渠道
ENV KING_WECHAT_TEST_ENABLED=false
ENV KING_WECHAT_TEST_APP_ID=
ENV KING_WECHAT_TEST_APP_SECRET=
ENV KING_WECHAT_TEST_TO_OPENID=

# 微信机器人渠道（需扫码登录，启用后可通过 API 获取二维码）
ENV KING_WECHAT_BOT_ENABLED=false

# 钉钉群机器人渠道
ENV KING_DINGTALK_ENABLED=false
ENV KING_DINGTALK_WEBHOOK_URL=
ENV KING_DINGTALK_SECRET=

# 飞书群机器人渠道
ENV KING_FEISHU_ENABLED=false
ENV KING_FEISHU_WEBHOOK_URL=

# Bark (iOS 推送) 渠道
ENV KING_BARK_ENABLED=false
ENV KING_BARK_SERVER_URL=
ENV KING_BARK_KEY=

# Discord Webhook 渠道
ENV KING_DISCORD_ENABLED=false
ENV KING_DISCORD_WEBHOOK_URL=

# 自定义 Webhook 渠道
ENV KING_WEBHOOK_ENABLED=false
ENV KING_WEBHOOK_URL=

VOLUME /app/data

# 设置虚拟显示器环境变量
ENV DISPLAY=:99

# 健康检查：每 30 秒检查 API 是否响应
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -sf http://localhost:${KING_API_PORT:-33333}/api/ping || exit 1

# 使用原生 Xvfb 挂后台，并通过 exec 直接拉起 node 进程，完美透传 REPL 交互界面
CMD ["sh", "-c", "Xvfb :99 -screen 0 1024x768x24 -ac -nolisten tcp & exec node_modules/electron/dist/electron out/main/index.js --headless --no-sandbox --disable-dev-shm-usage"]
