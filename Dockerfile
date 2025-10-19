# Use the official Node.js runtime as base image
FROM node:18-alpine

# Install git and curl for cloning and health checks
RUN apk add --no-cache git curl

# Set the working directory in the container
WORKDIR /app

# Clone the latest source code from GitHub
RUN git clone https://github.com/cwhit-io/monica-file-processor.git . && \
    rm -rf .git

# Create necessary directories
RUN mkdir -p /app/uploads /app/outputs /app/server-folders /app/data

# Install dependencies
RUN npm ci --only=production

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Change ownership of app directory to the nodejs user
RUN chown -R nextjs:nodejs /app

# Switch to the non-root user
USER nextjs

# Expose the port the app runs on
EXPOSE 3003

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3003/ || exit 1

# Start the application
CMD ["npm", "start"]