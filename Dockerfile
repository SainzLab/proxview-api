# ─────────────────────────────────────────
# Stage 1 – Build frontend (Vite)
# ─────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies (termasuk devDependencies untuk Vite build)
COPY package.json package-lock.json ./
RUN npm ci

# Salin seluruh source lalu build
COPY . .
RUN npm run build

# ─────────────────────────────────────────
# Stage 2 – Production image
# ─────────────────────────────────────────
FROM node:22-alpine AS production

# iputils-ping diperlukan oleh package "ping"
RUN apk add --no-cache iputils

WORKDIR /app

# Install hanya production dependencies
# (bcrypt membutuhkan python3 & make saat native build di node_modules baru)
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Bersihkan build tools setelah npm ci selesai
RUN apk del python3 make g++

# Salin hasil build Vite dari stage builder
COPY --from=builder /app/public/dist ./public/dist

# Salin source backend & view
COPY src/backend ./src/backend
COPY src/frontend/main.js ./src/frontend/main.js

# Salin file pendukung lainnya
COPY index.html ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "src/backend/server.js"]
