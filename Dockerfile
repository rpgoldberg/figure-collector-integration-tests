# Build stage - install dependencies
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts

# Test stage - minimal image for running tests
FROM node:22-alpine
WORKDIR /app

# Update Alpine packages for security
RUN apk update && apk upgrade && rm -rf /var/cache/apk/*

# Create non-root user first
RUN addgroup -g 1001 -S nodejs && \
    adduser -S integration -u 1001

# Copy node_modules from builder (as root for now)
COPY --from=builder /app/node_modules ./node_modules

# Copy application code and test files (as root for now)
COPY package*.json ./
COPY tsconfig.test.json ./
COPY jest.integration.config.js ./
COPY setup.ts ./
COPY *.test.ts ./
COPY docker-compose*.yml ./
COPY init-db.js ./

# Create directories for test results
RUN mkdir -p /app/test-results /app/integration-test-results

# Change ownership of everything to integration user
RUN chown -R integration:nodejs /app

# Switch to non-root user
USER integration

# Run integration tests
CMD ["npm", "run", "test:integration"]