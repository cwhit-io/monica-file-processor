# Monica File Processor - Docker Setup

This directory contains Docker configuration files for containerizing the Monica File Processor application.

## Files Created

1. **Dockerfile** - Standard Docker build file for development/testing
2. **Dockerfile.production** - Optimized multi-stage build for production
3. **docker-compose.yml** - Docker Compose configuration for easy deployment
4. **.dockerignore** - Files to exclude from Docker build context
5. **docker-build.sh** - Helper script for building and managing containers

## Quick Start

### Option 1: Using Docker Compose (Recommended)

```bash
# Make sure your .env file is configured
docker-compose up -d
```

### Option 2: Using the Build Script

```bash
# Build and run the container
./docker-build.sh run

# View logs
./docker-build.sh logs

# Stop the container
./docker-build.sh stop
```

### Option 3: Manual Docker Commands

```bash
# Build the image
docker build -t monica-file-processor .

# Run the container
docker run -d \
  --name monica-file-processor \
  -p 3003:3003 \
  --env-file .env \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/outputs:/app/outputs \
  -v $(pwd)/server-folders:/app/server-folders \
  -v $(pwd)/data:/app/data \
  monica-file-processor
```

## Environment Variables

Make sure your `.env` file contains:

```
MONICA_API_KEY=your_api_key_here
MONICA_API_ENDPOINT=https://openapi.monica.im/v1/chat/completions
PORT=3003
DEFAULT_MODEL=gemini-2.0-flash-001
```

## Volume Mounts

The container uses the following volume mounts to persist data:

- `./uploads:/app/uploads` - Uploaded files
- `./outputs:/app/outputs` - Processed output files
- `./server-folders:/app/server-folders` - Server-side input folders
- `./data:/app/data` - Models and prompts configuration

## Production Deployment

For production, use the production Dockerfile:

```bash
docker build -f Dockerfile.production -t monica-file-processor:prod .
```

Or use the build script:

```bash
./docker-build.sh build production
```

## Health Checks

Both Docker configurations include health checks that verify the application is responding on port 3003.

## Security Features

- Runs as non-root user inside container
- Uses Alpine Linux base image for smaller attack surface
- Only installs production dependencies in production build
- Proper file permissions and ownership

## Troubleshooting

Check container logs:

```bash
docker logs monica-file-processor
# or
./docker-build.sh logs
```

Check container status:

```bash
docker ps -a
# or
./docker-build.sh status
```

## Build Script Commands

The `docker-build.sh` script supports these commands:

- `build [production]` - Build the Docker image
- `run` - Build and run a new container
- `start/stop/restart` - Control existing container
- `logs` - View container logs
- `clean` - Remove container and image
- `status` - Show container status
- `help` - Show help information
