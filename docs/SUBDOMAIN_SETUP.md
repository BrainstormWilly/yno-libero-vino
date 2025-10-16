# Subdomain-Based CRM Routing Setup

This document explains how the subdomain-based routing works for accessing different CRM systems in the Yno Libero Vino application.

## Overview

The application supports accessing different CRM systems through dedicated subdomains:

- **c7.yourdomain.com** - Commerce7 CRM access
- **shp.yourdomain.com** - Shopify CRM access
- **www.yourdomain.com** or **yourdomain.com** - Main landing page with all CRMs

## How It Works

### 1. Subdomain Detection

The application uses the `getSubdomainInfo()` utility function to detect which subdomain is being accessed. This function:

- Extracts the subdomain from the request URL
- Maps the subdomain to the appropriate CRM type
- Works in both development (localhost) and production environments

### 2. Route Behavior

#### Main Index Route (`/`)

- **On c7.yourdomain.com**: Shows only Commerce7 connection options
- **On shp.yourdomain.com**: Shows only Shopify connection options
- **On www or no subdomain**: Shows all available CRM options

#### Auth Routes

- `/commerce7/auth` - Commerce7 authentication page
- `/shopify/auth` - Shopify authentication page

Both auth routes will display a warning banner if accessed from the wrong subdomain but will still function.

## Development Setup

### Local Development with Subdomains

To test subdomain routing locally, you need to configure your `/etc/hosts` file:

1. Open your hosts file:
   ```bash
   sudo nano /etc/hosts
   ```

2. Add the following entries:
   ```
   127.0.0.1   c7.localhost
   127.0.0.1   shp.localhost
   127.0.0.1   www.localhost
   ```

3. Start your development server:
   ```bash
   npm run dev
   ```

4. Access your app at:
   - `http://c7.localhost:3000` - Commerce7 subdomain
   - `http://shp.localhost:3000` - Shopify subdomain
   - `http://www.localhost:3000` - Main landing page

## Production Setup

### DNS Configuration

Configure your DNS provider to point your subdomains to your Heroku app:

1. Add CNAME records for each subdomain:
   ```
   c7.yourdomain.com   CNAME   your-app.herokuapp.com
   shp.yourdomain.com  CNAME   your-app.herokuapp.com
   www.yourdomain.com  CNAME   your-app.herokuapp.com
   ```

### Heroku Setup

1. Add custom domains to your Heroku app:
   ```bash
   heroku domains:add c7.yourdomain.com
   heroku domains:add shp.yourdomain.com
   heroku domains:add www.yourdomain.com
   heroku domains:add yourdomain.com
   ```

2. Configure SSL for your domains:
   ```bash
   heroku certs:auto:enable
   ```

3. Wait for DNS propagation (can take up to 48 hours)

## Code Structure

### Key Files

- **`app/util/subdomain.ts`** - Subdomain detection and utility functions
- **`app/routes/_index.tsx`** - Main index route with subdomain logic
- **`app/routes/commerce7.auth.tsx`** - Commerce7 authentication route
- **`app/routes/shopify.auth.tsx`** - Shopify authentication route

### Utility Functions

#### `getSubdomainInfo(request: Request): SubdomainInfo`

Returns information about the current subdomain:

```typescript
{
  subdomain: 'c7' | 'shp' | 'www' | null,
  crmType: 'commerce7' | 'shopify' | null,
  isValid: boolean
}
```

#### `validateSubdomainForCrm(request: Request, expectedCrmType: string): boolean`

Validates if the current subdomain matches the expected CRM type.

#### `getCrmUrl(currentUrl: string, crmType: string, path: string): string`

Generates a URL for a specific CRM subdomain.

## Testing

### Testing Different Subdomains

1. **Test c7 subdomain**:
   ```bash
   curl http://c7.localhost:3000
   ```

2. **Test shp subdomain**:
   ```bash
   curl http://shp.localhost:3000
   ```

3. **Test main domain**:
   ```bash
   curl http://www.localhost:3000
   ```

### Expected Behavior

- Each subdomain should show appropriate CRM-specific branding
- Auth routes should display warnings when accessed from wrong subdomain
- Main domain should show all CRM options

## Troubleshooting

### Subdomains Not Working Locally

1. Verify `/etc/hosts` file is properly configured
2. Clear browser cache and cookies
3. Try accessing with explicit port: `http://c7.localhost:3000`

### Subdomains Not Working in Production

1. Verify DNS records are properly configured
2. Check that domains are added to Heroku app
3. Ensure SSL certificates are active
4. Wait for DNS propagation (up to 48 hours)

### Wrong CRM Showing

1. Clear browser cache
2. Verify subdomain detection in browser dev tools
3. Check that URL is typed correctly

## Future Enhancements

Potential improvements to the subdomain routing system:

1. **Strict Subdomain Enforcement**: Redirect users to the correct subdomain if they access a route from the wrong subdomain
2. **Session Isolation**: Keep sessions separate between subdomains
3. **Custom Branding**: Allow different themes/branding per subdomain
4. **Analytics**: Track usage per subdomain
5. **Multi-tenant Support**: Support multiple Commerce7/Shopify instances with different subdomains

## Related Documentation

- [React Router Documentation](https://reactrouter.com/)
- [Heroku Custom Domains](https://devcenter.heroku.com/articles/custom-domains)
- [DNS Configuration Guide](https://www.cloudflare.com/learning/dns/dns-records/dns-cname-record/)

