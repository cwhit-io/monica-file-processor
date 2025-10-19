# Multi-stage build for Monica File Processor
FROM node:18-alpine as builder

# Install git for cloning
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Clone repository (supports branch/tag via build arg)
ARG GITHUB_BRANCH=main
RUN git clone -b ${GITHUB_BRANCH} --depth 1 https://github.com/cwhit-io/monica-file-processor.git . && \
    rm -rf .git

# Install all dependencies (including dev dependencies for potential build steps)
RUN npm ci

# Production stage
FROM node:18-alpine as production

# Install curl for health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy application code from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app .

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Create data directory structure for persistent storage
RUN mkdir -p /app/data/{uploads,server-folders,outputs,config}

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Set proper ownership
RUN chown -R appuser:nodejs /app

# Switch to non-root user
USER appuser

# Environment variables
ENV NODE_ENV=production
ENV PORT=3003
ENV DATA_DIR=/app/data

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3003/health || exit 1

# Start application
CMD ["npm", "start"]