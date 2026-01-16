# Combined Dashboard Dockerfile
# Serves frontend static files and backend API in a single container
# Build: docker build --build-arg VERSION=1.0.0 -t ops-dashboard .
ARG VERSION=0.0.0

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# Stage 2: Build backend
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine

# Add version label
ARG VERSION
LABEL version="${VERSION}"
LABEL maintainer="ops-dashboard"

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# Copy backend
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/package.json ./

# Copy frontend static files
COPY --from=frontend-builder /app/frontend/dist ./public

# Create necessary directories
RUN mkdir -p /tmp && chown appuser:appgroup /tmp

# Switch to non-root user
USER appuser

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV STATIC_FILES_PATH=/app/public

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run application
CMD ["node", "dist/index.js"]
