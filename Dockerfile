# ---- build stage ----
FROM node:20-bookworm AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# ---- runtime stage ----
FROM node:20-bookworm-slim
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
