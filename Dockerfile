FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create directories for test results
RUN mkdir -p /app/test-results /app/integration-test-results

# Run integration tests
CMD ["npm", "run", "test:integration"]