#!/bin/bash

# Deploy webhook script that runs on the server to trigger Coolify deployment
# This bypasses Cloudflare by calling Coolify directly from inside the network

SERVICE_UUID="${1:-wcskg4c0gksc8cgsok8ooggw}"
TOKEN="${2:-2|mGkfvXa95Js7AmouZzLvJPPW2HD6vRpTmUyteb5ic2b43cff}"
FORCE="${3:-false}"

echo "🚀 Triggering deployment for service: $SERVICE_UUID"

# First, try calling the API from inside the Docker network
# Coolify runs on the host, so we can use localhost or the internal Docker IP
COOLIFY_INTERNAL_URL="http://localhost:8000"

# Method 1: Try direct API call from inside the server (bypassing Cloudflare)
echo "Attempting direct API call to Coolify..."
RESPONSE=$(curl -s -X POST "$COOLIFY_INTERNAL_URL/api/v1/deploy" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{\"uuid\": \"$SERVICE_UUID\", \"force\": $FORCE}" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ] || [ "$HTTP_STATUS" = "202" ]; then
  echo "✅ Deployment triggered successfully!"
  echo "Response: $BODY"
  exit 0
fi

echo "❌ Direct API call failed with status: $HTTP_STATUS"
echo "Response: $BODY"

# Method 2: Try using Docker exec to trigger deployment via Coolify's internal commands
echo "Attempting to trigger via Docker exec..."

# Check if there's a queue command we can use
docker exec coolify php artisan check:deployment-queue

# Since there's no direct deploy command, we need to use the API
# But we can try from inside the Coolify container itself
echo "Attempting API call from inside Coolify container..."
docker exec coolify curl -X POST "http://localhost/api/v1/deploy" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{\"uuid\": \"$SERVICE_UUID\", \"force\": $FORCE}"

exit $?