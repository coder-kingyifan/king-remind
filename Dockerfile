# ---- build stage (构建阶段) ----
FROM node:22-bookworm AS builder
WORKDIR /app

COPY package.json ./

# 【加速技巧 1 & 2】：配置 NPM 淘宝源，并强制 Electron 二进制文件走国内镜像
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
ENV ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"

RUN npm config set registry ${NPM_REGISTRY} && \
    npm install

COPY . .
RUN npm run build


# ---- runtime stage (运行阶段) ----
FROM node:22-bookworm-slim
WORKDIR /app

# 【加速技巧 3】：替换 Debian Bookworm 默认的 apt 源为清华大学开源软件镜像站
# 注意：Debian 12 (Bookworm) 默认使用 debian.sources 格式
RUN sed -i 's/deb.debian.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
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

# 优化入口：捕获 xvfb 错误
ENTRYPOINT ["xvfb-run", "--auto-servernum", "--server-args=-screen 0 1024x768x24 -ac -nolisten tcp"]

# 启动核心：注入 --no-sandbox 解决无头环境下的沙盒权限死锁问题
CMD ["node", "node_modules/electron/dist/electron", "out/main/index.js", "--headless", "--no-sandbox", "--disable-dev-shm-usage"]