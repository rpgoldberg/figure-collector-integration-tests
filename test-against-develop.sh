#!/bin/bash

# Integration Test Runner - Test local code against develop-tagged images
# Usage: ./test-against-develop.sh [options]
#
# Options:
#   --pull          Pull latest develop images before starting
#   --no-cleanup    Keep containers running after tests
#   --health-only   Only check service health, don't run tests
#   --verbose       Show detailed output

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
PULL_IMAGES=false
CLEANUP=true
HEALTH_ONLY=false
VERBOSE=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --pull)
      PULL_IMAGES=true
      shift
      ;;
    --no-cleanup)
      CLEANUP=false
      shift
      ;;
    --health-only)
      HEALTH_ONLY=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $arg${NC}"
      echo "Usage: $0 [--pull] [--no-cleanup] [--health-only] [--verbose]"
      exit 1
      ;;
  esac
done

# Function to print status messages
print_status() {
  echo -e "${BLUE}==>${NC} $1"
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}!${NC} $1"
}

# Function to check if a service is healthy
check_service_health() {
  local service=$1
  local url=$2
  local max_attempts=30
  local attempt=0

  print_status "Checking $service health at $url..."

  while [ $attempt -lt $max_attempts ]; do
    if curl -sf "$url" > /dev/null 2>&1; then
      print_success "$service is healthy"
      return 0
    fi
    attempt=$((attempt + 1))
    if [ $VERBOSE = true ]; then
      echo "  Attempt $attempt/$max_attempts..."
    fi
    sleep 2
  done

  print_error "$service failed health check"
  return 1
}

# Cleanup function
cleanup() {
  if [ $CLEANUP = true ]; then
    print_status "Cleaning up containers..."
    docker-compose -f docker-compose.prebuilt.yml down
    print_success "Cleanup complete"
  else
    print_warning "Containers left running (--no-cleanup specified)"
    echo "To stop manually, run: docker-compose -f docker-compose.prebuilt.yml down"
  fi
}

# Trap errors and interrupts
trap cleanup EXIT INT TERM

# Main execution
print_status "Integration Test Runner"
echo "Testing local code against develop-tagged images"
echo ""

# Step 1: Pull images if requested
if [ $PULL_IMAGES = true ]; then
  print_status "Pulling latest develop images from registry..."

  docker pull ghcr.io/rpgoldberg/figure-collector-backend:develop
  docker pull ghcr.io/rpgoldberg/figure-collector-frontend:develop
  docker pull ghcr.io/rpgoldberg/page-scraper:develop
  docker pull ghcr.io/rpgoldberg/version-manager:develop

  print_success "Images pulled successfully"
  echo ""
fi

# Step 2: Stop any existing containers
print_status "Stopping any existing test containers..."
docker-compose -f docker-compose.prebuilt.yml down 2>/dev/null || true
echo ""

# Step 3: Start services (without integration-tests runner)
print_status "Starting services with develop-tagged images..."
docker-compose -f docker-compose.prebuilt.yml up -d \
  mongodb-test \
  backend-test \
  frontend-test \
  scraper-test \
  version-manager-test

echo ""
print_status "Waiting for services to be healthy (this may take 60-90 seconds)..."
echo ""

# Step 4: Wait for each service to be healthy
sleep 10  # Give containers a moment to start

check_service_health "MongoDB" "http://localhost:27018" || exit 1
check_service_health "Version Manager" "http://localhost:3006/health" || exit 1
check_service_health "Scraper" "http://localhost:3005/health" || exit 1
check_service_health "Backend" "http://localhost:5055/health" || exit 1
check_service_health "Frontend" "http://localhost:5056" || exit 1

echo ""
print_success "All services are healthy!"
echo ""

# Step 5: Show container status
print_status "Container status:"
docker-compose -f docker-compose.prebuilt.yml ps
echo ""

# Step 6: Run tests or exit if health-only
if [ $HEALTH_ONLY = true ]; then
  print_success "Health check complete! Containers are running."
  echo ""
  echo "Services available at:"
  echo "  Backend:         http://localhost:5055"
  echo "  Frontend:        http://localhost:5056"
  echo "  Scraper:         http://localhost:3005"
  echo "  Version Manager: http://localhost:3006"
  echo "  MongoDB:         mongodb://testuser:testpass@localhost:27018"
  echo ""
  echo "To run tests manually:"
  echo "  npm run test:integration"
  echo ""
  echo "To stop containers:"
  echo "  docker-compose -f docker-compose.prebuilt.yml down"

  # Disable cleanup trap since user wants containers running
  trap - EXIT INT TERM
  exit 0
fi

# Step 7: Run integration tests
print_status "Running integration tests..."
echo ""

if npm run test:integration; then
  print_success "Integration tests passed!"
  TEST_EXIT_CODE=0
else
  print_error "Integration tests failed!"
  TEST_EXIT_CODE=1
fi

echo ""

# Step 8: Collect coverage if tests ran
if [ -f "package.json" ] && grep -q "collect:coverage" package.json; then
  print_status "Collecting coverage reports..."
  npm run collect:coverage 2>/dev/null || print_warning "Coverage collection not available"
  echo ""
fi

# Step 9: Display results if available
if [ -f "test-results/integration-test-results.xml" ]; then
  print_status "Test results summary:"
  cat test-results/integration-test-results.xml | grep -E "testsuite|testcase" | head -20 || true
  echo ""
fi

# Step 10: Show logs if tests failed
if [ $TEST_EXIT_CODE -ne 0 ] && [ $VERBOSE = true ]; then
  print_warning "Service logs (last 50 lines each):"
  echo ""
  echo "=== Backend Logs ==="
  docker-compose -f docker-compose.prebuilt.yml logs --tail=50 backend-test
  echo ""
  echo "=== Scraper Logs ==="
  docker-compose -f docker-compose.prebuilt.yml logs --tail=50 scraper-test
  echo ""
  echo "=== Version Manager Logs ==="
  docker-compose -f docker-compose.prebuilt.yml logs --tail=50 version-manager-test
fi

exit $TEST_EXIT_CODE
