#!/bin/bash

# Script to test webhook endpoints locally
# Usage: ./scripts/webhook-test.sh [shp|c7]

CRM="${1:-shp}"
NGROK_BASE="${NGROK_URL:-kindly-balanced-macaw.ngrok-free.app}"

if [ "$CRM" = "shp" ]; then
  SUBDOMAIN="shp"
  ENDPOINT="https://${SUBDOMAIN}-${NGROK_BASE}/webhooks/shp"
  TOPIC="customers/create"
  
  echo "Testing Shopify webhook endpoint..."
  echo "Endpoint: $ENDPOINT"
  echo ""
  
  curl -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "X-Shopify-Topic: $TOPIC" \
    -H "X-Shopify-Shop-Domain: test-shop.myshopify.com" \
    -H "X-Shopify-Hmac-SHA256: test-signature" \
    -d '{
      "id": 12345,
      "email": "test@example.com",
      "first_name": "Test",
      "last_name": "User",
      "created_at": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
    }' \
    -v

elif [ "$CRM" = "c7" ]; then
  SUBDOMAIN="c7"
  ENDPOINT="https://${SUBDOMAIN}-${NGROK_BASE}/webhooks/c7"
  TOPIC="customers/create"
  
  echo "Testing Commerce7 webhook endpoint..."
  echo "Endpoint: $ENDPOINT"
  echo ""
  
  curl -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "X-Commerce7-Event: $TOPIC" \
    -H "X-Commerce7-Tenant: test-tenant-id" \
    -H "X-Commerce7-Signature: test-signature" \
    -d '{
      "event": "'$TOPIC'",
      "tenantId": "test-tenant-id",
      "data": {
        "id": "12345",
        "email": "test@example.com",
        "firstName": "Test",
        "lastName": "User",
        "createdAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
      }
    }' \
    -v

else
  echo "Usage: ./scripts/webhook-test.sh [shp|c7]"
  exit 1
fi

echo ""
echo ""
echo "Check your server logs for webhook processing output"

