# Quick Start: Webhook Testing with Ngrok

This quick start guide will get you up and running with webhook testing in under 5 minutes.

## Prerequisites

- [x] Node.js and npm installed
- [x] Project dependencies installed (`npm install`)
- [x] Ngrok account (free tier works fine)

## Step 1: Install Ngrok

```bash
# macOS (using Homebrew)
brew install ngrok/ngrok/ngrok

# Or download from https://ngrok.com/download
```

## Step 2: Authenticate Ngrok

```bash
# Get your auth token from https://dashboard.ngrok.com/get-started/your-authtoken
ngrok authtoken YOUR_AUTH_TOKEN
```

## Step 3: Configure Environment

Create or update your `.env` file:

```bash
# Copy the example file
cp env.example .env

# Edit .env and set:
NODE_ENV=development
PORT=3000
NGROK_URL=kindly-balanced-macaw.ngrok-free.app

# For webhook validation (important!)
SHOPIFY_API_SECRET=your_shopify_api_secret
COMMERCE7_WEBHOOK_SECRET=your_commerce7_webhook_secret
```

**Note:** Replace `kindly-balanced-macaw.ngrok-free.app` with your actual Ngrok domain if different.

## Step 4: Start Your Development Server

```bash
npm run dev
```

Your app will be running on `http://localhost:3000`

## Step 5: Start Ngrok

Open a **new terminal window** and run:

### For Shopify webhooks:
```bash
./scripts/start-ngrok.sh shp
```

### For Commerce7 webhooks:
```bash
./scripts/start-ngrok.sh c7
```

### For main app (no CRM-specific):
```bash
./scripts/start-ngrok.sh
```

You'll see output like:
```
Starting Ngrok tunnel for shp subdomain...
Domain: https://shp-kindly-balanced-macaw.ngrok-free.app

Webhook endpoint will be:
  https://shp-kindly-balanced-macaw.ngrok-free.app/webhooks/shp

Ngrok Inspector UI: http://127.0.0.1:4040
```

## Step 6: Configure Webhooks in Your CRM

### Shopify:
1. Go to your Shopify Admin → Settings → Notifications → Webhooks
2. Click "Create webhook"
3. Select event (e.g., "Customer creation")
4. Set format to JSON
5. Enter URL: `https://shp-kindly-balanced-macaw.ngrok-free.app/webhooks/shp`
6. Click Save

### Commerce7:
1. Go to `http://localhost:3000/webhooks` in your browser
2. Select "Commerce7" from the dropdown
3. Choose a webhook topic
4. Click "Register Webhook"

## Step 7: Test Your Webhooks

### Option A: Wait for real events
Perform an action in your CRM (e.g., create a customer) and watch the webhook arrive in your server logs.

### Option B: Use the test script
```bash
./scripts/webhook-test.sh shp
# or
./scripts/webhook-test.sh c7
```

### Option C: Use Ngrok Inspector
1. Open http://127.0.0.1:4040 in your browser
2. View all incoming requests
3. Replay requests for testing

## Troubleshooting

### "Command not found: ./scripts/start-ngrok.sh"

Make sure the scripts are executable:
```bash
chmod +x ./scripts/start-ngrok.sh ./scripts/webhook-test.sh
```

### "Webhook validation failed"

1. Check that your API secrets are correctly set in `.env`
2. For Shopify: Verify `SHOPIFY_API_SECRET` matches your Shopify app secret
3. For Commerce7: Set `COMMERCE7_WEBHOOK_SECRET` if required by your setup

### "Ngrok tunnel won't start"

1. Verify you've authenticated: `ngrok authtoken YOUR_TOKEN`
2. Check if another Ngrok process is running: `pkill ngrok`
3. Free accounts are limited to one tunnel at a time

### "Can't access webhook management UI"

1. Make sure your dev server is running on port 3000
2. Navigate to http://localhost:3000/webhooks
3. Check server logs for any errors

## What's Next?

- ✅ Webhooks are now configured for local testing
- 📖 Read [NGROK_WEBHOOK_SETUP.md](./NGROK_WEBHOOK_SETUP.md) for detailed documentation
- 🎯 Implement webhook processing logic in `app/lib/crm/*.server.ts`
- 💾 Set up Supabase tables to store webhook data
- 🚀 Deploy to production when ready (no Ngrok needed!)

## Monitoring Webhooks

### Server Logs
Watch your terminal for webhook processing messages:
```
Processing Shopify webhook: customers/create { id: '12345', ... }
New customer created: 12345
```

### Ngrok Inspector
Open http://127.0.0.1:4040 to see:
- All HTTP requests and responses
- Request headers and body
- Response status and timing
- Ability to replay requests

## Quick Reference

| CRM | Subdomain | Webhook URL |
|-----|-----------|-------------|
| Shopify | shp | `https://shp-{ngrok-domain}/webhooks/shp` |
| Commerce7 | c7 | `https://c7-{ngrok-domain}/webhooks/c7` |

| Script | Purpose |
|--------|---------|
| `./scripts/start-ngrok.sh [subdomain]` | Start Ngrok tunnel |
| `./scripts/webhook-test.sh [crm]` | Test webhook endpoint |
| `npm run dev` | Start development server |

## Support

- 📝 Full documentation: [NGROK_WEBHOOK_SETUP.md](./NGROK_WEBHOOK_SETUP.md)
- 🐛 Issues: Create an issue on GitHub
- 💬 Questions: Email support@ynosoftware.com

