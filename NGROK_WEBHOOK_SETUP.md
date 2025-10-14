# Ngrok Webhook Setup Guide

This guide explains how to set up Ngrok for testing CRM webhooks with Yno Libero Vino.

## Overview

Ngrok creates a secure tunnel to your local development server, allowing external services (like Shopify and Commerce7) to send webhooks to your local machine during development.

## Prerequisites

1. Install Ngrok: https://ngrok.com/download
2. Sign up for a free Ngrok account
3. Authenticate Ngrok with your authtoken

## Quick Setup

### 1. Install and Configure Ngrok

```bash
# Download and install Ngrok from https://ngrok.com/download

# Authenticate (get your token from https://dashboard.ngrok.com/get-started/your-authtoken)
ngrok authtoken YOUR_AUTH_TOKEN
```

### 2. Configure Environment Variables

Copy the `.env.example` to `.env` and update these values:

```bash
# Development configuration
NODE_ENV=development
PORT=3000

# Ngrok Configuration
NGROK_URL=kindly-balanced-macaw.ngrok-free.app

# Shopify Configuration (for webhook validation)
SHOPIFY_API_SECRET=your_shopify_api_secret

# Commerce7 Configuration (for webhook validation)
COMMERCE7_WEBHOOK_SECRET=your_commerce7_webhook_secret
```

### 3. Start Your Development Server

```bash
npm run dev
```

Your app will be running on `http://localhost:3000`

### 4. Start Ngrok Tunnel

In a new terminal window, start Ngrok:

```bash
# For the main app (no subdomain)
ngrok http 3000 --domain=kindly-balanced-macaw.ngrok-free.app
```

For testing CRM-specific subdomains, you'll need to start multiple Ngrok tunnels:

```bash
# For Shopify (shp subdomain)
ngrok http 3000 --domain=shp-kindly-balanced-macaw.ngrok-free.app

# For Commerce7 (c7 subdomain)  
ngrok http 3000 --domain=c7-kindly-balanced-macaw.ngrok-free.app
```

**Note:** Free Ngrok accounts get one static domain. For multiple subdomains, you'll need a paid plan or use the dynamic URLs that Ngrok generates.

## Webhook Endpoints

Once Ngrok is running, your webhook endpoints will be:

### Shopify Webhooks
```
https://shp-kindly-balanced-macaw.ngrok-free.app/webhooks/shp
```

### Commerce7 Webhooks
```
https://c7-kindly-balanced-macaw.ngrok-free.app/webhooks/c7
```

## Testing Webhooks

### Using the Webhook Management UI

1. Start your development server and Ngrok
2. Navigate to `http://localhost:3000/webhooks` in your browser
3. Select your CRM (Shopify or Commerce7)
4. Copy the webhook endpoint URL
5. Configure your CRM to send webhooks to this URL

### Manual Testing with curl

You can test webhook endpoints manually:

```bash
# Test Shopify webhook endpoint
curl -X POST https://shp-kindly-balanced-macaw.ngrok-free.app/webhooks/shp \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: customers/create" \
  -H "X-Shopify-Hmac-SHA256: your-hmac-signature" \
  -H "X-Shopify-Shop-Domain: your-shop.myshopify.com" \
  -d '{"id": "12345", "email": "test@example.com"}'

# Test Commerce7 webhook endpoint
curl -X POST https://c7-kindly-balanced-macaw.ngrok-free.app/webhooks/c7 \
  -H "Content-Type: application/json" \
  -H "X-Commerce7-Event: customers/create" \
  -H "X-Commerce7-Tenant: your-tenant-id" \
  -H "X-Commerce7-Signature: your-signature" \
  -d '{"id": "12345", "email": "test@example.com"}'
```

## Configuring Webhooks in Your CRM

### Shopify

1. Go to your Shopify Admin: `https://your-store.myshopify.com/admin`
2. Navigate to **Settings → Notifications → Webhooks**
3. Click **Create webhook**
4. Select the event (e.g., "Customer creation")
5. Set **Format** to JSON
6. Enter the webhook URL: `https://shp-kindly-balanced-macaw.ngrok-free.app/webhooks/shp`
7. Click **Save**

### Commerce7

Use the webhook management UI or register webhooks programmatically:

```typescript
import { crmManager } from '~/lib/crm';

const commerce7Provider = crmManager.getProvider('commerce7');

await commerce7Provider.registerWebhook(
  'customers/create',
  'https://c7-kindly-balanced-macaw.ngrok-free.app/webhooks/c7'
);
```

## Troubleshooting

### Webhook Validation Failing

**Problem:** Webhooks are being rejected with 401 Unauthorized

**Solution:**
- Verify your API secrets are correctly set in `.env`
- For Shopify: Check `SHOPIFY_API_SECRET`
- For Commerce7: Check `COMMERCE7_WEBHOOK_SECRET`
- Ensure the webhook signature is being sent by your CRM

### Ngrok Connection Issues

**Problem:** Ngrok tunnel not starting or disconnecting

**Solution:**
- Check your Ngrok authtoken is configured: `ngrok authtoken YOUR_TOKEN`
- Verify your internet connection
- Check Ngrok status page: https://status.ngrok.com/
- Free accounts have connection limits; consider upgrading

### Subdomain Routing Not Working

**Problem:** App doesn't recognize the CRM subdomain

**Solution:**
- Verify `NGROK_URL` in `.env` matches your Ngrok domain
- Ensure you're using the correct subdomain prefix (shp- or c7-)
- Check the subdomain utility logic in `app/util/subdomain.ts`

### Webhooks Not Processing

**Problem:** Webhooks arrive but aren't being processed

**Solution:**
- Check server logs for errors
- Verify the webhook topic is supported (see `app/types/crm.ts`)
- Ensure your CRM provider implementation handles the webhook type
- Check that the webhook payload structure matches expectations

## Monitoring Webhooks

### Ngrok Inspector

Ngrok provides a web interface to inspect all HTTP traffic:

1. Open http://127.0.0.1:4040 in your browser
2. View all incoming webhook requests
3. Inspect headers, body, and responses
4. Replay requests for testing

### Application Logs

Monitor your application logs for webhook processing:

```bash
# Terminal running your dev server will show:
Processing Shopify webhook: customers/create { id: '12345', ... }
New customer created: 12345
```

## Production Deployment

When deploying to production:

1. Remove or change `NODE_ENV` to `production` in `.env`
2. Set `BASE_DOMAIN` to your production domain
3. Update CRM webhook URLs to use your production domain:
   - Shopify: `https://shp.yourdomain.com/webhooks/shp`
   - Commerce7: `https://c7.yourdomain.com/webhooks/c7`

## Additional Resources

- [Ngrok Documentation](https://ngrok.com/docs)
- [Shopify Webhooks](https://shopify.dev/docs/api/admin-rest/latest/resources/webhook)
- [Commerce7 API Documentation](https://commerce7.docs.apiary.io/)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review application logs
3. Inspect webhook requests in Ngrok Inspector
4. Consult CRM documentation for webhook specifications

