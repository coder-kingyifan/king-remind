# ---- build stage ----
FROM node:22-bookworm AS builder
WORKDIR /app

# 先复制依赖描述文件，利用 Docker 缓存
COPY package.json ./
# 不复制 package-lock.json，在 Linux 容器中重新生成
# 因为 Windows 生成的 lock 文件包含平台特定的依赖
RUN npm install

COPY . .
RUN npm run build

# ---- runtime stage ----
FROM node:22-bookworm-slim
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends xvfb dbus-x11 atk libgtk-3-0 \
       libgbm1 libnss3 libxss1 libasound2 libx11-xcb1 && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/out ./out
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/resources ./resources

ENV API_HOST=0.0.0.0
ENV DB_DIR=/app/data
VOLUME /app/data

ENTRYPOINT ["xvfb-run", "--auto-servernum", "--server-args=-screen 0 1024x768x24"]
CMD ["node", "node_modules/electron/dist/electron", "out/main/index.js", "--headless"]
