#!/bin/bash

# Integration Test Runner Script
# Manages complete lifecycle of inter-service integration testing

set -e

# Configuration
COMPOSE_FILE="docker-compose.integration.yml"
PROJECT_NAME="figure-collector-integration"
TIMEOUT=600  # 10 minutes total timeout
HEALTH_CHECK_INTERVAL=10
MAX_RETRIES=60
SERVICE_STARTUP_TIMEOUT=180  # 3 minutes per service

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Cleanup function for graceful shutdown
cleanup() {
    log_info "Cleaning up containers and networks..."
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down --volumes --remove-orphans
    
    # Remove any dangling containers
    docker container prune -f
    
    # Remove integration test network if it exists
    docker network rm ${PROJECT_NAME}_integration-network 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# Set trap for cleanup on script exit
trap cleanup EXIT INT TERM

# Function to wait for service health
wait_for_service() {
    local service_name=$1
    local health_endpoint=$2
    local max_attempts=$3
    local attempt=1
    
    log_info "Waiting for $service_name to be healthy..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$health_endpoint" > /dev/null 2>&1; then
            log_success "$service_name is healthy"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts: $service_name not ready, waiting ${HEALTH_CHECK_INTERVAL}s..."
        sleep $HEALTH_CHECK_INTERVAL
        ((attempt++))
    done
    
    log_error "$service_name failed to become healthy within timeout"
    return 1
}

# Function to check container health status
check_container_health() {
    local container_name=$1
    local status=$(docker inspect --format='{{.State.Health.Status}}' $container_name 2>/dev/null || echo "not-found")
    echo $status
}

# Function to wait for container to be healthy
wait_for_container_health() {
    local container_name=$1
    local max_attempts=$2
    local attempt=1
    
    log_info "Waiting for container $container_name to be healthy..."
    
    while [ $attempt -le $max_attempts ]; do
        local health_status=$(check_container_health $container_name)
        
        case $health_status in
            "healthy")
                log_success "Container $container_name is healthy"
                return 0
                ;;
            "unhealthy")
                log_warning "Container $container_name is unhealthy, continuing to wait..."
                ;;
            "starting")
                log_info "Attempt $attempt/$max_attempts: Container $container_name is starting..."
                ;;
            "not-found")
                log_warning "Container $container_name not found"
                return 1
                ;;
            *)
                log_info "Attempt $attempt/$max_attempts: Container $container_name health status: $health_status"
                ;;
        esac
        
        sleep $HEALTH_CHECK_INTERVAL
        ((attempt++))
    done
    
    log_error "Container $container_name failed to become healthy within timeout"
    log_info "Final health status: $(check_container_health $container_name)"
    return 1
}

# Function to display service status
show_service_status() {
    log_info "Current service status:"
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME ps
    echo
}

# Function to show service logs for debugging
show_service_logs() {
    local service_name=$1
    local lines=${2:-50}
    
    log_info "Last $lines lines from $service_name logs:"
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME logs --tail=$lines $service_name
    echo
}

# Function to validate environment
validate_environment() {
    log_info "Validating environment..."
    
    # Check Docker is running
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running"
        exit 1
    fi
    
    # Check docker-compose is available
    if ! command -v docker-compose &> /dev/null; then
        log_error "docker-compose is not installed"
        exit 1
    fi
    
    # Check compose file exists
    if [ ! -f $COMPOSE_FILE ]; then
        log_error "Compose file $COMPOSE_FILE not found"
        exit 1
    fi
    
    # Validate disk space (need at least 2GB free)
    local available_space=$(df . | tail -1 | awk '{print $4}')
    if [ $available_space -lt 2097152 ]; then  # 2GB in KB
        log_warning "Low disk space detected. Integration tests may fail."
    fi
    
    log_success "Environment validation passed"
}

# Main test execution function
run_integration_tests() {
    log_info "Starting Figure Collector Integration Tests"
    log_info "================================================"
    
    # Validate environment first
    validate_environment
    
    # Create results directory before starting containers
    log_info "Creating results directory..."
    mkdir -p ./integration-test-results
    log_success "Results directory created at ./integration-test-results"
    
    # Clean any existing containers
    log_info "Cleaning up any existing test environment..."
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down --volumes --remove-orphans 2>/dev/null || true
    
    # Phase 1: Start infrastructure services (MongoDB)
    log_info "Phase 1: Starting database infrastructure..."
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d mongodb-test
    
    # Wait for MongoDB with extended timeout
    log_info "Waiting for MongoDB to initialize (this may take up to 3 minutes)..."
    if ! wait_for_container_health "mongodb-test" $MAX_RETRIES; then
        log_error "MongoDB failed to start within timeout"
        show_service_logs "mongodb-test" 100
        exit 1
    fi
    
    # Phase 2: Start independent services (version-service and page-scraper)
    log_info "Phase 2: Starting independent services..."
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d version-manager-test scraper-test
    
    # Wait for version service
    log_info "Waiting for version service (lightweight, should be quick)..."
    if ! wait_for_container_health "version-manager-test" 60; then
        log_error "Version service failed to start"
        show_service_logs "version-manager-test" 100
        exit 1
    fi
    
    # Wait for page scraper (needs time for Puppeteer/Chrome)
    log_info "Waiting for page scraper (includes Chrome setup, may take 2+ minutes)..."
    if ! wait_for_container_health "scraper-test" $MAX_RETRIES; then
        log_error "Page scraper failed to start"
        show_service_logs "scraper-test" 100
        exit 1
    fi
    
    # Phase 3: Start backend service (depends on database and other services)
    log_info "Phase 3: Starting backend service..."
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d backend-test
    
    log_info "Waiting for backend service (needs database connection and service discovery)..."
    if ! wait_for_container_health "backend-test" $MAX_RETRIES; then
        log_error "Backend service failed to start"
        show_service_logs "backend-test" 100
        exit 1
    fi
    
    # Phase 4: Start frontend service (depends on backend)
    log_info "Phase 4: Starting frontend service..."
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d frontend-test
    
    log_info "Waiting for frontend service (React build and backend connectivity)..."
    if ! wait_for_container_health "frontend-test" 40; then
        log_error "Frontend service failed to start"
        show_service_logs "frontend-test" 100
        exit 1
    fi
    
    # Verify all services are communicating
    log_info "Verifying inter-service connectivity..."
    
    # Check frontend can reach backend
    if ! wait_for_service "frontend-to-backend" "http://localhost:5056/api/health" 10; then
        log_warning "Frontend to backend connectivity issue"
    fi
    
    # Show final service status
    show_service_status
    
    # Phase 5: Run integration tests
    log_info "All services are healthy. Starting integration test execution..."
    log_info "This will run comprehensive cross-service integration tests (estimated 5-10 minutes)..."
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up --no-deps --abort-on-container-exit integration-tests
    
    # Check test results by examining the container exit code
    local container_exit_code=$(docker inspect --format='{{.State.ExitCode}}' "integration-tests" 2>/dev/null || echo "1")
    if [ $container_exit_code -eq 0 ]; then
        log_success "Integration tests passed successfully!"
        log_info "Test execution completed. Results available in ./integration-test-results/"
    else
        log_error "Integration tests failed with exit code $container_exit_code"
        log_info "Showing last 100 lines of test output for debugging:"
        show_service_logs "integration-tests" 100
    fi
    
    # Collect coverage from all services
    log_info "Collecting coverage from all services..."
    # TODO: Implement coverage-collector service
    # docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up --no-deps coverage-collector
    
    # Extract test results and coverage
    log_info "Extracting test results and coverage reports..."
    
    # Create results directory if it doesn't exist
    mkdir -p ./integration-test-results
    
    # Copy results from containers
    log_info "Extracting test results from containers..."
    docker cp integration-tests:/app/test-results/ ./integration-test-results/ 2>/dev/null || log_warning "No test results to copy from integration-tests container"
    docker cp integration-tests:/app/integration-test-results/ ./integration-test-results/ 2>/dev/null || log_warning "No integration test results to copy"
    
    # Also try to copy from individual service containers if they have coverage
    docker cp backend-test:/app/coverage/ ./integration-test-results/backend-coverage/ 2>/dev/null || log_info "No backend coverage to extract"
    docker cp scraper-test:/app/coverage/ ./integration-test-results/scraper-coverage/ 2>/dev/null || log_info "No scraper coverage to extract"
    docker cp version-manager-test:/app/coverage/ ./integration-test-results/version-coverage/ 2>/dev/null || log_info "No version service coverage to extract"
    
    log_info "Integration test execution completed"
    return $container_exit_code
}

# Function to run specific test suite
run_specific_tests() {
    local test_pattern=$1
    log_info "Running specific test pattern: $test_pattern"
    
    # Override the integration-tests command
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME run --rm integration-tests \
        bash -c "npm run test:integration -- --testNamePattern='$test_pattern'"
}

# Function to run debugging mode (keeps containers running)
run_debug_mode() {
    log_info "Starting services in debug mode (containers will remain running)"
    
    validate_environment
    
    # Create results directory
    log_info "Creating results directory..."
    mkdir -p ./integration-test-results
    log_success "Results directory created at ./integration-test-results"
    
    # Start all services
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d \
        mongodb-test version-manager-test scraper-test backend-test frontend-test
    
    # Wait for all services with proper container names
    wait_for_container_health "mongodb-test" $MAX_RETRIES
    wait_for_container_health "version-manager-test" $MAX_RETRIES
    wait_for_container_health "scraper-test" $MAX_RETRIES
    wait_for_container_health "backend-test" $MAX_RETRIES
    wait_for_container_health "frontend-test" $MAX_RETRIES
    
    show_service_status
    
    log_success "All services running. Access:"
    log_info "  Frontend: http://localhost:5056"
    log_info "  Backend API: http://localhost:5055"
    log_info "  Scraper Service: http://localhost:3005"
    log_info "  Version Service: http://localhost:3006"
    log_info "  MongoDB: mongodb://localhost:27017"
    log_info ""
    log_info "Run 'docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f [service]' to view logs"
    log_info "Run 'docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down' to stop all services"
    
    # Don't cleanup automatically in debug mode
    trap - EXIT INT TERM
}

# Parse command line arguments
case "${1:-run}" in
    "run")
        run_integration_tests
        ;;
    "debug")
        run_debug_mode
        ;;
    "test")
        if [ -z "$2" ]; then
            log_error "Test pattern required for 'test' command"
            log_info "Usage: $0 test 'test-pattern'"
            exit 1
        fi
        run_specific_tests "$2"
        ;;
    "clean")
        cleanup
        ;;
    "status")
        show_service_status
        ;;
    "logs")
        if [ -z "$2" ]; then
            log_error "Service name required for 'logs' command"
            log_info "Available services: mongodb-test, version-service, page-scraper, backend, frontend, integration-tests"
            exit 1
        fi
        show_service_logs "$2" "${3:-100}"
        ;;
    "help"|"-h"|"--help")
        echo "Figure Collector Integration Test Runner"
        echo ""
        echo "Usage: $0 [command] [options]"
        echo ""
        echo "Commands:"
        echo "  run     - Run full integration test suite (default)"
        echo "  debug   - Start services without running tests (for manual testing)"
        echo "  test    - Run specific test pattern"
        echo "  clean   - Clean up containers and networks"
        echo "  status  - Show current service status"
        echo "  logs    - Show logs for a specific service"
        echo "  help    - Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 run                              # Run all integration tests"
        echo "  $0 debug                           # Start services for manual testing"
        echo "  $0 test 'Backend.*Scraper'         # Run tests matching pattern"
        echo "  $0 logs backend 50                 # Show last 50 lines of backend logs"
        echo "  $0 clean                           # Clean up everything"
        ;;
    *)
        log_error "Unknown command: $1"
        log_info "Run '$0 help' for usage information"
        exit 1
        ;;
esac