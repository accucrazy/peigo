# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# 安裝依賴（先複製 package*.json 以利用 docker 快取）
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# 複製程式與靜態資源。來源檔可能是 600 權限，需讓 node 使用者可讀。
COPY --chown=node:node server.js ./
COPY --chown=node:node public ./public
RUN chmod -R a+rX /app

# Cloud Run 預設 PORT=8080
ENV PORT=8080
EXPOSE 8080

# 使用非 root 跑（Alpine 內建 node user）
USER node

CMD ["node", "server.js"]
