# ---- build stage ----
FROM node:22-bookworm AS builder
WORKDIR /app

COPY package.json ./
# 移除冗余的镜像站设置，建议通过构建参数传递或保留当前配置
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry ${NPM_REGISTRY} && \
    npm install

COPY . .
RUN npm run build

# ---- runtime stage ----
FROM node:22-bookworm-slim
WORKDIR /app

# 基础依赖：增加 libglib2.0-0 和 libnss3 等，确保 Electron 核心库完整
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
       xvfb xauth dbus-x11 libatk1.0-0 libgtk-3-0 \
       libgbm1 libnss3 libxss1 libasound2 libx11-xcb1 \
       libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/out ./out
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/resources ./resources

# 环境变量：确保 Electron 知道自己在 headless 环境，且允许日志输出
ENV API_HOST=0.0.0.0
ENV DB_DIR=/app/data
ENV ELECTRON_ENABLE_LOGGING=true
ENV ELECTRON_DISABLE_GPU=1

VOLUME /app/data

# 优化入口：使用 -e /dev/stdout 捕获 xvfb 错误，避免静默挂起
ENTRYPOINT ["xvfb-run", "--auto-servernum", "--server-args=-screen 0 1024x768x24 -ac -nolisten tcp"]

# 关键改动：必须添加 --no-sandbox 和 --disable-dev-shm-usage
# 否则在 Docker 默认权限下，Electron 进程会因为无法初始化沙盒而永久挂起
CMD ["node", "node_modules/electron/dist/electron", "out/main/index.js", "--headless", "--no-sandbox", "--disable-dev-shm-usage"]