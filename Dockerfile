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
       libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

# 拷贝构建产物
COPY --from=builder /app/out ./out
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/resources ./resources

# 环境变量配置
ENV API_HOST=0.0.0.0
ENV DB_DIR=/app/data
ENV ELECTRON_ENABLE_LOGGING=true
ENV ELECTRON_DISABLE_GPU=1

VOLUME /app/data

# 虚拟显示配置：-ac -nolisten tcp 提升启动速度与兼容性
ENTRYPOINT ["xvfb-run", "--auto-servernum", "--server-args=-screen 0 1024x768x24 -ac -nolisten tcp"]

# 启动命令：必须包含 --no-sandbox 以适配 Docker 环境
CMD ["node", "node_modules/electron/dist/electron", "out/main/index.js", "--headless", "--no-sandbox", "--disable-dev-shm-usage"]