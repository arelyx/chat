FROM node:24-slim AS frontend
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
COPY --from=frontend /fe/dist ./public
EXPOSE 3000
CMD ["node", "app.js"]
