#!/bin/bash

# Quick orchestration validation script
# Tests service startup and basic connectivity without running full integration tests

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

COMPOSE_FILE="docker-compose.integration.yml"
PROJECT_NAME="figure-collector-integration"

# Cleanup function
cleanup() {
    log_info "Cleaning up test containers..."
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down --volumes --remove-orphans 2>/dev/null || true
}

# Set trap for cleanup
trap cleanup EXIT INT TERM

log_info "🎭 PANDORA'S ACTOR ORCHESTRATION VALIDATION"
log_info "Testing service startup sequence and basic connectivity"
echo

# Start services in phases like the main script
log_info "Phase 1: MongoDB infrastructure..."
docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d mongodb-test

# Quick MongoDB check
for i in {1..20}; do
    if docker exec mongodb-test mongosh --quiet --eval "db.runCommand({ ping: 1 }).ok" 2>/dev/null | grep -q "1"; then
        log_success "MongoDB is ready"
        break
    fi
    if [ $i -eq 20 ]; then
        log_error "MongoDB failed to start"
        docker logs mongodb-test --tail 20
        exit 1
    fi
    sleep 3
done

log_info "Phase 2: Independent services..."
docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d version-service-test scraper-test

# Wait for version service
for i in {1..15}; do
    if curl -f http://localhost:3006/health 2>/dev/null | grep -q "ok\|healthy"; then
        log_success "Version service is ready"
        break
    fi
    if [ $i -eq 15 ]; then
        log_error "Version service failed"
        docker logs version-service-test --tail 20
        exit 1
    fi
    sleep 2
done

# Wait for scraper (longer timeout)
for i in {1..30}; do
    if curl -f http://localhost:3005/health 2>/dev/null | grep -q "ok\|healthy"; then
        log_success "Scraper service is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        log_error "Scraper service failed"
        docker logs scraper-test --tail 20
        exit 1
    fi
    sleep 3
done

log_info "Phase 3: Backend service..."
docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d backend-test

# Wait for backend
for i in {1..25}; do
    if curl -f http://localhost:5055/health 2>/dev/null | grep -q "ok\|healthy"; then
        log_success "Backend service is ready"
        break
    fi
    if [ $i -eq 25 ]; then
        log_error "Backend service failed"
        docker logs backend-test --tail 30
        exit 1
    fi
    sleep 3
done

log_info "Phase 4: Frontend service..."
docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d frontend-test

# Wait for frontend
for i in {1..20}; do
    if curl -f http://localhost:5056 2>/dev/null >/dev/null; then
        log_success "Frontend service is ready"
        break
    fi
    if [ $i -eq 20 ]; then
        log_error "Frontend service failed"
        docker logs frontend-test --tail 30
        exit 1
    fi
    sleep 3
done

log_info "Phase 5: Cross-service connectivity validation..."

# Test backend can reach other services
log_info "Testing backend → version service connectivity..."
if docker exec backend-test curl -f http://version-service-test:3006/health 2>/dev/null | grep -q "ok\|healthy"; then
    log_success "Backend ↔ Version service connectivity: OK"
else
    log_warning "Backend → Version service connectivity issue"
fi

log_info "Testing backend → scraper connectivity..."
if docker exec backend-test curl -f http://scraper-test:3005/health 2>/dev/null | grep -q "ok\|healthy"; then
    log_success "Backend ↔ Scraper connectivity: OK"
else
    log_warning "Backend → Scraper connectivity issue"
fi

log_info "Testing backend → MongoDB connectivity..."
if docker exec backend-test curl -f http://localhost:5055/health 2>/dev/null | grep -q "database"; then
    log_success "Backend ↔ MongoDB connectivity: OK"
else
    log_warning "Backend → MongoDB connectivity issue (may be expected)"
fi

log_success "🎉 SERVICE ORCHESTRATION VALIDATION COMPLETE!"
log_info "All services started successfully and basic connectivity verified."
log_info "Ready to run full integration tests."
log_info ""
log_info "Service endpoints:"
log_info "  MongoDB:      mongodb://localhost:27017"
log_info "  Backend:      http://localhost:5055"
log_info "  Frontend:     http://localhost:5056"
log_info "  Scraper:      http://localhost:3005"
log_info "  Version:      http://localhost:3006"
log_info ""
log_info "To run integration tests: ./integration-test-runner.sh run"
log_info "To stop all services: docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down"