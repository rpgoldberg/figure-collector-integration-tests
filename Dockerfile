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

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code and test files
COPY package*.json ./
COPY tsconfig.test.json ./
COPY jest.integration.config.js ./
COPY setup.ts ./
COPY *.test.ts ./
COPY init-db.js ./

# Create non-root user first
RUN addgroup -g 1001 -S nodejs && \
    adduser -S integration -u 1001

# Create directories for test results and set ownership
RUN mkdir -p /app/test-results /app/integration-test-results && \
    chown -R integration:nodejs /app && \
    chmod -R 755 /app/test-results /app/integration-test-results
USER integration

# Run integration tests
CMD ["npm", "run", "test:integration"]