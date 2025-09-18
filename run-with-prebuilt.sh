#!/bin/bash

# Integration test runner using pre-built Docker images
# This script pulls images from the registry instead of building locally

set -e

echo "========================================"
echo "Integration Tests with Pre-built Images"
echo "========================================"

# Configuration
REGISTRY=${REGISTRY:-ghcr.io}
REGISTRY_ORG=${REGISTRY_ORG:-rpgoldberg}
BACKEND_TAG=${BACKEND_TAG:-develop}
FRONTEND_TAG=${FRONTEND_TAG:-develop}
SCRAPER_TAG=${SCRAPER_TAG:-develop}
VERSION_TAG=${VERSION_TAG:-develop}

# Export for docker-compose
export REGISTRY REGISTRY_ORG BACKEND_TAG FRONTEND_TAG SCRAPER_TAG VERSION_TAG

# Function to cleanup on exit
cleanup() {
    echo "Cleaning up containers..."
    docker compose -f docker-compose.prebuilt.yml down -v
    exit $1
}

# Trap exit signals
trap 'cleanup $?' EXIT INT TERM

# Login to registry if credentials provided
if [ -n "$REGISTRY_USERNAME" ] && [ -n "$REGISTRY_PASSWORD" ]; then
    echo "Logging into registry..."
    echo "$REGISTRY_PASSWORD" | docker login $REGISTRY -u "$REGISTRY_USERNAME" --password-stdin
fi

# Pull latest images
echo "Pulling latest images..."
docker compose -f docker-compose.prebuilt.yml pull

# Start services
echo "Starting services..."
docker compose -f docker-compose.prebuilt.yml up -d mongodb-test version-manager-test scraper-test

# Wait for dependencies
echo "Waiting for services to be healthy..."
timeout 120 bash -c 'until docker compose -f docker-compose.prebuilt.yml ps | grep -E "(healthy|running)" | grep -q mongodb-test; do sleep 2; done'
timeout 120 bash -c 'until docker compose -f docker-compose.prebuilt.yml ps | grep -E "(healthy|running)" | grep -q version-manager-test; do sleep 2; done'
timeout 120 bash -c 'until docker compose -f docker-compose.prebuilt.yml ps | grep -E "(healthy|running)" | grep -q scraper-test; do sleep 2; done'

# Start backend and frontend
docker compose -f docker-compose.prebuilt.yml up -d backend-test frontend-test

# Wait for backend and frontend
timeout 120 bash -c 'until docker compose -f docker-compose.prebuilt.yml ps | grep -E "(healthy|running)" | grep -q backend-test; do sleep 2; done'
timeout 120 bash -c 'until docker compose -f docker-compose.prebuilt.yml ps | grep -E "(healthy|running)" | grep -q frontend-test; do sleep 2; done'

# Run integration tests
echo "Running integration tests..."
docker compose -f docker-compose.prebuilt.yml up --exit-code-from integration-tests integration-tests

# Check exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Integration tests passed!"
else
    echo "❌ Integration tests failed!"
    docker compose -f docker-compose.prebuilt.yml logs
fi

exit $EXIT_CODE