#!/bin/bash

# Monica File Processor Docker Build and Run Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="monica-file-processor"
CONTAINER_NAME="monica-file-processor"
PORT="3003"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Function to build the Docker image
build_image() {
    local build_type="$1"
    local branch="${2:-main}"
    
    print_status "Building Docker image: $IMAGE_NAME"
    print_status "Using branch/tag: $branch"
    
    case "$build_type" in
        "production")
            docker build -f Dockerfile.github-prod --build-arg BRANCH=$branch -t $IMAGE_NAME:latest .
            ;;
        "github")
            docker build -f Dockerfile.github --build-arg BRANCH=$branch -t $IMAGE_NAME:latest .
            ;;
        *)
            docker build -f Dockerfile.github --build-arg BRANCH=$branch -t $IMAGE_NAME:latest .
            ;;
    esac
    
    if [ $? -eq 0 ]; then
        print_success "Docker image built successfully from branch: $branch"
    else
        print_error "Failed to build Docker image"
        exit 1
    fi
}

# Function to stop and remove existing container
cleanup_container() {
    if docker ps -a --format 'table {{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
        print_status "Stopping and removing existing container: $CONTAINER_NAME"
        docker stop $CONTAINER_NAME >/dev/null 2>&1 || true
        docker rm $CONTAINER_NAME >/dev/null 2>&1 || true
        print_success "Existing container removed"
    fi
}

# Function to run the container
run_container() {
    print_status "Starting container: $CONTAINER_NAME"
    
    # Check if .env file exists
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Make sure to set environment variables."
    fi
    
    # Create necessary directories if they don't exist
    mkdir -p uploads outputs server-folders data
    
    # Run the container
    docker run -d \
        --name $CONTAINER_NAME \
        -p $PORT:3003 \
        --env-file .env \
        -v "$(pwd)/uploads:/app/uploads" \
        -v "$(pwd)/outputs:/app/outputs" \
        -v "$(pwd)/server-folders:/app/server-folders" \
        -v "$(pwd)/data:/app/data" \
        --restart unless-stopped \
        $IMAGE_NAME:latest
    
    if [ $? -eq 0 ]; then
        print_success "Container started successfully"
        print_status "Application will be available at: http://localhost:$PORT"
        print_status "Use 'docker logs $CONTAINER_NAME' to view logs"
    else
        print_error "Failed to start container"
        exit 1
    fi
}

# Function to show container logs
show_logs() {
    print_status "Showing container logs (press Ctrl+C to exit):"
    docker logs -f $CONTAINER_NAME
}

# Function to show help
show_help() {
    echo "Monica File Processor Docker Management Script"
    echo ""
    echo "Usage: $0 [COMMAND] [TYPE] [BRANCH]"
    echo ""
    echo "Commands:"
    echo "  build [github|production] [branch]  Build the Docker image from GitHub"
    echo "  run [branch]                        Stop existing container and run a new one"
    echo "  start               Start the existing container"
    echo "  stop                Stop the running container"
    echo "  restart             Restart the container"
    echo "  logs                Show container logs"
    echo "  clean               Remove container and image"
    echo "  status              Show container status"
    echo "  help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 build                    # Build from main branch"
    echo "  $0 build github v1.0.0      # Build from v1.0.0 tag"
    echo "  $0 build production main    # Build production image from main"
    echo "  $0 run                      # Build and run from main branch"
    echo "  $0 run develop              # Build and run from develop branch"
    echo "  $0 logs                     # Show container logs"
}

# Main script logic
case "$1" in
    "build")
        check_docker
        build_image $2 $3
        ;;
    "run")
        check_docker
        build_image "github" $2
        cleanup_container
        run_container
        ;;
    "start")
        check_docker
        docker start $CONTAINER_NAME
        print_success "Container started"
        ;;
    "stop")
        check_docker
        docker stop $CONTAINER_NAME
        print_success "Container stopped"
        ;;
    "restart")
        check_docker
        docker restart $CONTAINER_NAME
        print_success "Container restarted"
        ;;
    "logs")
        check_docker
        show_logs
        ;;
    "clean")
        check_docker
        cleanup_container
        docker rmi $IMAGE_NAME:latest >/dev/null 2>&1 || true
        print_success "Container and image removed"
        ;;
    "status")
        check_docker
        docker ps -a --filter name=$CONTAINER_NAME --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        ;;
    "help"|"--help"|"-h")
        show_help
        ;;
    "")
        print_warning "No command specified. Use 'help' for usage information."
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac