# Yno Libero Vino

[![CI](https://github.com/willysair/yno-libero-vino/workflows/CI/badge.svg)](https://github.com/willysair/yno-libero-vino/actions)
[![Deploy](https://github.com/willysair/yno-libero-vino/workflows/Deploy%20to%20Heroku/badge.svg)](https://github.com/willysair/yno-libero-vino/actions)
[![Security](https://github.com/willysair/yno-libero-vino/workflows/Security%20Scan/badge.svg)](https://github.com/willysair/yno-libero-vino/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A wine club and loyalty platform for Commerce7 and Shopify. Built with React Router v7, Supabase, and deployed on Heroku.

## Features

- **Wine Club Management**: Manage wine club memberships, shipments, and member benefits
- **Loyalty Programs**: Track customer loyalty points, rewards, and engagement
- **Multi-Platform Support**: Seamlessly integrate with Commerce7 and Shopify
- **Subdomain-Based Routing**: Separate platform access via dedicated subdomains (c7.* for Commerce7, shp.* for Shopify)
- **Real-time Webhook Integration**: Keep your data in sync across all platforms with instant updates
- **Member Data Management**: Centralized customer, order, and club membership management
- **Modern Tech Stack**: Built with React Router v7, TypeScript, and Tailwind CSS
- **Scalable Architecture**: Designed for wineries of all sizes

## Tech Stack

- **Frontend**: React Router v7, TypeScript, Tailwind CSS
- **Backend**: React Router v7 (Full-stack)
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Heroku
- **Platform Integrations**: Commerce7, Shopify

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Commerce7 account (for wine club integration)
- Shopify account (for e-commerce integration)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/yno-libero-vino.git
cd yno-libero-vino
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
```

4. Configure your environment variables in `.env`:
   - Set up Supabase credentials
   - Configure Commerce7 credentials (for wine club features)
   - Configure Shopify app credentials (for e-commerce integration)

5. Set up the database:
```bash
# Run Supabase migrations
npx supabase db push
```

6. Start the development server:
```bash
npm run dev
```

7. (Optional) Set up local subdomains for testing:
   - See [SUBDOMAIN_SETUP.md](SUBDOMAIN_SETUP.md) for detailed instructions
   - Edit `/etc/hosts` to add local subdomain entries

8. (Optional) Set up Ngrok for webhook testing:
   - See [NGROK_WEBHOOK_SETUP.md](NGROK_WEBHOOK_SETUP.md) for detailed instructions
   - Required for testing CRM webhooks during development

## Environment Variables

### Required
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

### Shopify (Optional)
- `SHOPIFY_API_KEY`: Your Shopify app API key
- `SHOPIFY_API_SECRET`: Your Shopify app API secret
- `SHOPIFY_APP_URL`: Your Shopify app URL
- `SCOPES`: Shopify app scopes

### Commerce7 (Optional)
- `COMMERCE7_KEY`: Your Commerce7 API key
- `COMMERCE7_USER`: Your Commerce7 username
- `COMMERCE7_PASSWORD`: Your Commerce7 password
- `COMMERCE7_TENANT`: Your Commerce7 tenant ID

### Domain Configuration (Optional)
- `BASE_DOMAIN`: Your production domain (e.g., yourdomain.com)
- `COMMERCE7_SUBDOMAIN`: Subdomain prefix for Commerce7 (default: c7)
- `SHOPIFY_SUBDOMAIN`: Subdomain prefix for Shopify (default: shp)

### Webhook Configuration (Optional)
- `NGROK_URL`: Your Ngrok domain for webhook testing (e.g., kindly-balanced-macaw.ngrok-free.app)
- `COMMERCE7_WEBHOOK_SECRET`: Secret for validating Commerce7 webhooks

## Deployment

### Heroku

1. Create a new Heroku app:
```bash
heroku create your-app-name
```

2. Set environment variables:
```bash
heroku config:set SUPABASE_URL=your_supabase_url
heroku config:set SUPABASE_ANON_KEY=your_supabase_anon_key
heroku config:set SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
# ... set other variables as needed
```

3. (Optional) Add custom domains for subdomain routing:
```bash
heroku domains:add c7.yourdomain.com
heroku domains:add shp.yourdomain.com
heroku domains:add www.yourdomain.com
heroku certs:auto:enable
```

4. Deploy:
```bash
git push heroku main
```

See [SUBDOMAIN_SETUP.md](SUBDOMAIN_SETUP.md) for detailed subdomain configuration.

### One-Click Deploy

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/your-username/yno-libero-vino)

## Architecture

### Subdomain-Based Routing

The application supports platform-specific subdomains:

- **c7.yourdomain.com** - Commerce7 wine club interface
- **shp.yourdomain.com** - Shopify e-commerce interface  
- **www.yourdomain.com** or **yourdomain.com** - Main landing page with all platforms

The subdomain routing is handled transparently by the `getSubdomainInfo()` utility which:
- Detects the subdomain from the request URL
- Maps subdomains to specific platforms
- Works seamlessly in both development and production environments

For detailed setup instructions, see [SUBDOMAIN_SETUP.md](SUBDOMAIN_SETUP.md).

### Platform Abstraction Layer

The application uses a provider pattern to abstract platform-specific operations:

```typescript
interface CrmProvider {
  name: CrmNames;
  slug: CrmSlugs;
  
  // Authentication
  authenticate(request: Request): Promise<any>;
  authorizeInstall(request: Request): boolean;
  
  // CRUD operations for customers, products, orders, discounts
  getCustomers(params?: any): Promise<CrmCustomer[]>;
  // ... other methods
}
```

### Supported Platforms

- **Commerce7**: Full integration for wine club management, member portal, and DTC sales
- **Shopify**: Full integration for e-commerce, product catalog, and order management
- **Extensible**: Easy to add new winery platform providers

### Webhook Testing

For local development and webhook testing:

1. Install and configure [Ngrok](https://ngrok.com/)
2. Set `NGROK_URL` in your `.env` file
3. Start Ngrok tunnel:
   ```bash
   ./scripts/start-ngrok.sh shp  # For Shopify
   ./scripts/start-ngrok.sh c7   # For Commerce7
   ```
4. Configure webhooks in your CRM to point to the Ngrok URL
5. Test webhooks using the provided script:
   ```bash
   ./scripts/webhook-test.sh shp
   ./scripts/webhook-test.sh c7
   ```

For detailed instructions, see [NGROK_WEBHOOK_SETUP.md](NGROK_WEBHOOK_SETUP.md).

## API Endpoints

### Authentication
- `GET /shp/auth` - Shopify authentication
- `GET /c7/auth` - Commerce7 authentication

### Data Operations
- `GET /api/customers` - Get wine club members and customers
- `GET /api/products` - Get wines and products from all platforms
- `GET /api/orders` - Get orders and shipments
- `GET /api/discounts` - Get club benefits and discounts

### Webhooks
- `POST /webhooks/shp` - Shopify webhook endpoint
- `POST /webhooks/c7` - Commerce7 webhook endpoint
- `GET /webhooks` - Webhook management UI

## Database Schema

The application uses Supabase with the following main tables:

- `platform_sessions` - Stores authentication sessions for each platform
- `club_members` - Wine club member data
- `customers` - Customer and guest data
- `wines` - Wine inventory and product data
- `orders` - Orders and club shipments
- `club_tiers` - Wine club tier definitions
- `loyalty_points` - Customer loyalty tracking

## Contributing

We welcome contributions! Please see our [Contributing Guide](. /github/CONTRIBUTING.md) for details.

### Quick Start

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-crm-provider`
3. Commit your changes: `git commit -am 'Add new CRM provider'`
4. Push to the branch: `git push origin feature/new-crm-provider`
5. Submit a pull request

### GitHub Integration

For setting up GitHub workflows, CI/CD, and automation, see [GITHUB_SETUP.md](GITHUB_SETUP.md).

## Adding New Platform Providers

To add a new winery platform provider:

1. Create a new provider class implementing `CrmProvider` interface
2. Add the provider to the `CrmManager` constructor
3. Create authentication routes for the new platform
4. Add webhook routes for the new platform
5. Add environment variables for the new platform
6. Update the database schema if needed

**Potential platforms**: VineSpring, WineDirect, Tock, etc.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@ynosoftware.com or create an issue in the GitHub repository.