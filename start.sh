#!/bin/bash

# Real-Time EVM Block Explorer - Quick Start Script
# Usage: ./start.sh

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "📦 Real-Time EVM Block Explorer"
echo "================================"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose found"
echo ""

# Check if .env exists
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "❌ .env file not found!"
    exit 1
fi

echo "🚀 Starting services..."
cd "$PROJECT_DIR"

# Start services
docker-compose up -d

echo ""
echo "⏳ Waiting for services to initialize..."
sleep 15

# Check service health
echo ""
echo "🩺 Checking service health..."
echo ""

SERVICES=("block-listener:3100" "indexer:3101" "api:3000")

for service in "${SERVICES[@]}"; do
    IFS=':' read -r name port <<< "$service"
    if curl -s -f "http://localhost:$port/health" > /dev/null 2>&1; then
        echo "✅ $name is healthy"
    else
        echo "⚠️  $name is starting up..."
    fi
done

echo ""
echo "================================"
echo "🎉 Deployment Complete!"
echo "================================"
echo ""
echo "📊 Applications:"
echo "  • Frontend:   http://localhost:3001"
echo "  • API:        http://localhost:3000"
echo "  • Prometheus: http://localhost:9090"
echo ""
echo "📚 Documentation:"
echo "  • README:           ./README.md"
echo "  • API Reference:    ./docs/API.md"
echo "  • Deployment Guide: ./docs/DEPLOYMENT.md"
echo ""
echo "📋 Useful Commands:"
echo "  • View logs:     docker-compose logs -f"
echo "  • Service status: docker-compose ps"
echo "  • Stop services: docker-compose stop"
echo "  • Restart:       docker-compose restart"
echo ""
echo "Next: Open http://localhost:3001 in your browser!"
echo ""
