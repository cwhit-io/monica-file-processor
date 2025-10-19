# Docker Deployment Guide

This guide shows how to deploy Monica File Processor using Docker, with full support for custom environment variables.

## Quick Start

### 1. Clone and Configure

```bash
git clone https://github.com/cwhit-io/monica-file-processor.git
cd monica-file-processor

# Copy and configure environment file
cp .env.template .env
```

### 2. Edit Environment Variables

Edit `.env` with your configuration:

```env
# Monica.im API Configuration (REQUIRED)
MONICA_API_KEY=your_monica_api_key_here
MONICA_API_ENDPOINT=https://openapi.monica.im/v1/chat/completions

# Server Configuration
PORT=3003

# AI Model Configuration - Choose your preferred model
DEFAULT_MODEL=gemini-2.0-flash-001
# Other options: gpt-4o, claude-3-5-sonnet, llama-3.1-70b, etc.
```

### 3. Deploy with Docker Compose

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Configuration Options

### Environment Variables

| Variable                 | Description            | Default                                         | Required |
| ------------------------ | ---------------------- | ----------------------------------------------- | -------- |
| `MONICA_API_KEY`         | Your Monica.im API key | -                                               | ✅ Yes   |
| `MONICA_API_ENDPOINT`    | Monica API endpoint    | `https://openapi.monica.im/v1/chat/completions` | No       |
| `PORT`                   | Server port            | `3003`                                          | No       |
| `DEFAULT_MODEL`          | Default AI model       | `gemini-2.0-flash-001`                          | No       |
| `DATA_DIR`               | Data directory path    | `/app/data`                                     | No       |
| `CLEANUP_INTERVAL_HOURS` | Cleanup frequency      | `6`                                             | No       |
| `UPLOADS_MAX_AGE_HOURS`  | Upload file retention  | `200`                                           | No       |
| `OUTPUTS_MAX_AGE_HOURS`  | Output file retention  | `400`                                           | No       |

### Available Models

Popular models you can use in `DEFAULT_MODEL`:

- **Google Gemini**: `gemini-2.0-flash-001`, `gemini-1.5-pro`
- **OpenAI GPT**: `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`
- **Anthropic Claude**: `claude-3-5-sonnet`, `claude-3-haiku`
- **Meta Llama**: `llama-3.1-70b`, `llama-3.1-8b`
- **And many more...**

Check Monica.im dashboard for the latest available models.

## Deployment Methods

### Method 1: Docker Compose (Recommended)

```bash
# With custom branch/tag
GITHUB_BRANCH=v1.0.0 docker-compose up -d

# With custom environment file
docker-compose --env-file .env.production up -d
```

### Method 2: Docker Run

```bash
# Build image
docker build -t monica-file-processor .

# Run with environment file
docker run -d \
  --name monica-file-processor \
  -p 3003:3003 \
  --env-file .env \
  -v monica_data:/app/data \
  monica-file-processor
```

### Method 3: Docker Run with Inline Environment Variables

```bash
docker run -d \
  --name monica-file-processor \
  -p 3003:3003 \
  -e MONICA_API_KEY=your_key_here \
  -e DEFAULT_MODEL=gpt-4o \
  -e PORT=3003 \
  -v monica_data:/app/data \
  monica-file-processor
```

## Data Persistence

All user data is stored in `/app/data` within the container:

```
/app/data/
├── config/         # Models and prompts configuration
├── uploads/        # Uploaded files (temporary)
├── server-folders/ # Server directory files
└── outputs/        # Processed results
```

The Docker setup automatically creates a persistent volume `monica_data` that preserves your data across container restarts.

## Updating

### Update to Latest Version

```bash
# Pull latest changes
docker-compose pull

# Rebuild and restart
docker-compose up -d --build
```

### Update to Specific Version

```bash
# Update to specific branch/tag
GITHUB_BRANCH=v2.0.0 docker-compose up -d --build
```

## Troubleshooting

### Check Container Status

```bash
# View running containers
docker-compose ps

# Check health status
docker-compose logs monica-file-processor
```

### Common Issues

1. **Invalid API Key**: Check your `MONICA_API_KEY` in `.env`
2. **Port Conflicts**: Change `PORT` in `.env` or update port mapping
3. **Permission Issues**: Ensure Docker has access to your directories

### Debug Mode

```bash
# Run with debug logs
docker-compose logs -f monica-file-processor

# Access container shell
docker-compose exec monica-file-processor sh

# Check environment variables
docker-compose exec monica-file-processor env | grep MONICA
```

## Security Notes

- Keep your `.env` file secure and never commit it to version control
- The `.env.template` file is safe to share and commit
- Use strong API keys and rotate them regularly
- Consider using Docker secrets for production deployments

## Example Production Setup

Create a production environment file:

```bash
cp .env.template .env.production
```

Edit `.env.production`:

```env
MONICA_API_KEY=your_production_api_key
DEFAULT_MODEL=gpt-4o
PORT=3003
CLEANUP_INTERVAL_HOURS=12
UPLOADS_MAX_AGE_HOURS=48
OUTPUTS_MAX_AGE_HOURS=168
```

Deploy:

```bash
docker-compose --env-file .env.production up -d
```

## Support

For issues and questions:

- GitHub Issues: https://github.com/cwhit-io/monica-file-processor/issues
- Documentation: Check README.md for additional details
