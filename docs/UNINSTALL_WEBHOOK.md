# Uninstall Webhook Documentation

## Overview

The uninstall webhook endpoint handles app uninstallation for both Commerce7 and Shopify. When a winery uninstalls the app, this webhook will be called to clean up all data associated with that client.

## Endpoint

- **URL**: `/uninstall`
- **Method**: `POST`
- **Subdomains**: 
  - Commerce7: `https://c7.yourdomain.com/uninstall`
  - Shopify: `https://shp.yourdomain.com/uninstall`

## Data Cleanup

When the uninstall webhook is triggered, it will **permanently delete**:

1. **Client record** - The main client/winery record
2. **Platform sessions** - Authentication tokens and session data
3. **Customers** - All customer records and associated data:
   - Club enrollments and membership history
   - Loyalty points and transactions
   - Communication preferences
4. **Orders** - All order records
5. **Products** - All product records
6. **Discounts** - All discount codes
7. **Club Programs** - Club programs and stages
8. **Loyalty Rewards** - Reward catalog and redemptions
9. **Communication data** - Templates, configs, and communication logs
10. **CRM Sync Queue** - Pending sync operations

All deletions happen automatically via PostgreSQL CASCADE constraints defined in the database schema.

## Commerce7 Configuration

### Webhook Setup in Commerce7 App Registry

1. Log into Commerce7 Developer Portal
2. Navigate to your app settings
3. Configure the uninstall webhook:

```
Uninstall URL: https://c7.yourdomain.com/uninstall
```

### Authentication

Commerce7 uses **Basic Authentication** for uninstall webhooks:

- **Username**: Set in `COMMERCE7_USER` environment variable
- **Password**: Set in `COMMERCE7_PASSWORD` environment variable

These credentials are validated when the webhook is received.

### Request Format

Commerce7 sends the following payload:

```json
{
  "tenantId": "abc123-tenant-id",
  "user": {
    "id": "user-id",
    "email": "admin@winery.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

### Response Format

Success response (200):
```json
{
  "success": true,
  "message": "Client and all related data deleted successfully",
  "clientId": "uuid-of-client",
  "tenantId": "abc123-tenant-id"
}
```

Error response (4xx/5xx):
```json
{
  "success": false,
  "error": "Error description",
  "details": "Additional error details"
}
```

## Shopify Configuration

### Webhook Setup in Shopify Partner Dashboard

1. Log into Shopify Partner Dashboard
2. Navigate to your app settings
3. Under "Webhooks", add a new webhook:
   - **Event**: `app/uninstalled`
   - **URL**: `https://shp.yourdomain.com/uninstall`
   - **Format**: `JSON`

### Authentication

Shopify uses **HMAC-SHA256** signature validation:

- Secret key: `SHOPIFY_API_SECRET` environment variable
- Header: `x-shopify-hmac-sha256`

The signature is automatically validated when the webhook is received.

### Request Format

Shopify sends the following headers and payload:

**Headers:**
```
x-shopify-topic: app/uninstalled
x-shopify-shop-domain: wineryshop.myshopify.com
x-shopify-hmac-sha256: <signature>
```

**Payload:**
```json
{
  "id": 123456789,
  "name": "Winery Shop",
  "email": "admin@winery.com",
  "domain": "wineryshop.myshopify.com",
  "myshopify_domain": "wineryshop.myshopify.com"
}
```

### Response Format

Success response (200):
```json
{
  "success": true,
  "message": "Client and all related data deleted successfully",
  "clientId": "uuid-of-client",
  "shop": "wineryshop.myshopify.com"
}
```

## Development Testing

### Testing with Ngrok

For development testing, use ngrok tunnels with subdomain prefixes:

```bash
# Commerce7
ngrok http 3000 --subdomain=c7-your-unique-name

# Shopify  
ngrok http 3000 --subdomain=shp-your-unique-name
```

Update the webhook URLs in the respective platforms:
- Commerce7: `https://c7-your-unique-name.ngrok-free.app/uninstall`
- Shopify: `https://shp-your-unique-name.ngrok-free.app/uninstall`

### Manual Testing with cURL

#### Commerce7

```bash
curl -X POST https://c7.localhost:3000/uninstall \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'your-username:your-password' | base64)" \
  -d '{
    "tenantId": "test-tenant-123"
  }'
```

#### Shopify

```bash
# First, calculate the HMAC signature
PAYLOAD='{"domain":"test-shop.myshopify.com","myshopify_domain":"test-shop.myshopify.com"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "your-shopify-secret" -binary | base64)

curl -X POST https://shp.localhost:3000/uninstall \
  -H "Content-Type: application/json" \
  -H "x-shopify-hmac-sha256: $SIGNATURE" \
  -H "x-shopify-shop-domain: test-shop.myshopify.com" \
  -H "x-shopify-topic: app/uninstalled" \
  -d "$PAYLOAD"
```

## Environment Variables Required

```bash
# Commerce7
COMMERCE7_USER=your-username
COMMERCE7_PASSWORD=your-password

# Shopify
SHOPIFY_API_SECRET=your-shopify-api-secret

# Database
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Security Considerations

1. **Authentication Required**: Both CRM types validate the webhook sender
2. **Idempotent**: Safe to call multiple times - returns success if client already deleted
3. **Complete Deletion**: All data is permanently removed via CASCADE constraints
4. **No Recovery**: Once deleted, data cannot be recovered
5. **Audit Logging**: All uninstall operations are logged to console with timestamps

## Error Handling

The endpoint handles various error scenarios:

- **401 Unauthorized**: Invalid authentication credentials
- **400 Bad Request**: Missing required fields (tenantId/shop domain)
- **404/200**: Client not found (returns success for idempotency)
- **500 Internal Server Error**: Database or server errors

## Production Checklist

- [ ] Environment variables configured
- [ ] Webhook URL registered in Commerce7 Developer Portal
- [ ] Webhook URL registered in Shopify Partner Dashboard
- [ ] SSL certificate valid for production domain
- [ ] Test uninstall/reinstall flow in staging
- [ ] Verify CASCADE deletions working correctly
- [ ] Monitor logs for uninstall operations
- [ ] Database backup strategy in place

## Related Documentation

- [C7_INSTALL_FLOW.md](./C7_INSTALL_FLOW.md) - Installation webhook documentation
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Database schema with CASCADE constraints
- [SUBDOMAIN_SETUP.md](./SUBDOMAIN_SETUP.md) - Subdomain routing configuration
- [NGROK_WEBHOOK_SETUP.md](./NGROK_WEBHOOK_SETUP.md) - Development webhook setup

