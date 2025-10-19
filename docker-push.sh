#!/bin/bash
# Docker Hub Push Script for Monica File Processor

echo "🐳 Pushing Monica File Processor to Docker Hub..."

# Push all tags
echo "📤 Pushing latest tag..."
podman push cwhitio/monica-file-processor:latest

echo "📤 Pushing v1.0.0 tag..."
podman push cwhitio/monica-file-processor:v1.0.0

echo "📤 Pushing v1.0 tag..."
podman push cwhitio/monica-file-processor:v1.0

echo "📤 Pushing v1 tag..."
podman push cwhitio/monica-file-processor:v1

echo "✅ All images pushed successfully!"
echo ""
echo "🎉 Users can now deploy with:"
echo "   docker run -d -p 3003:3003 -e MONICA_API_KEY=your_key cwhitio/monica-file-processor:latest"
echo "   # or"
echo "   docker-compose up -d  # (using your docker-compose.yml)"