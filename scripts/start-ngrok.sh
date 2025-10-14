#!/bin/bash

# Script to help start Ngrok for webhook testing
# Usage: ./scripts/start-ngrok.sh [subdomain]
# Examples:
#   ./scripts/start-ngrok.sh          # Start main tunnel
#   ./scripts/start-ngrok.sh shp      # Start Shopify tunnel
#   ./scripts/start-ngrok.sh c7       # Start Commerce7 tunnel

# Load environment variables
if [ -f .env.development.local ]; then
  export $(cat .env.development.local | grep -v '^#' | xargs)
elif [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Default Ngrok URL
NGROK_BASE="${NGROK_URL:-kindly-balanced-macaw.ngrok-free.app}"
PORT="${PORT:-3000}"

# Check if subdomain argument is provided
SUBDOMAIN="$1"

if [ -z "$SUBDOMAIN" ]; then
  # No subdomain - start main tunnel
  DOMAIN="$NGROK_BASE"
  echo "Starting Ngrok tunnel for main app..."
  echo "Domain: https://$DOMAIN"
else
  # With subdomain - start CRM-specific tunnel
  DOMAIN="${SUBDOMAIN}-${NGROK_BASE}"
  echo "Starting Ngrok tunnel for $SUBDOMAIN subdomain..."
  echo "Domain: https://$DOMAIN"
fi

echo ""
echo "Webhook endpoint will be:"
if [ "$SUBDOMAIN" = "shp" ]; then
  echo "  https://$DOMAIN/webhooks/shopify"
elif [ "$SUBDOMAIN" = "c7" ]; then
  echo "  https://$DOMAIN/webhooks/commerce7"
else
  echo "  https://$DOMAIN/webhooks/[crm]"
fi

echo ""
echo "Ngrok Inspector UI: http://127.0.0.1:4040"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start Ngrok
ngrok http "$PORT" --domain="$DOMAIN"

