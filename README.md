# Yno Libero Vino

[![CI](https://github.com/willysair/yno-libero-vino/workflows/CI/badge.svg)](https://github.com/willysair/yno-libero-vino/actions)
[![Deploy](https://github.com/willysair/yno-libero-vino/workflows/Deploy%20to%20Heroku/badge.svg)](https://github.com/willysair/yno-libero-vino/actions)
[![Security](https://github.com/willysair/yno-libero-vino/workflows/Security%20Scan/badge.svg)](https://github.com/willysair/yno-libero-vino/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A wine club and loyalty platform for Commerce7 and Shopify. Built with React Router v7, Supabase, and deployed on Heroku.

## ⚡ Recent Architecture Update (October 2025)

**LiberoVino has moved to a club-based architecture!** We've replaced the tag and coupon approach with Commerce7's native Clubs, Promotions, and Loyalty features.

**What's New:**
- ✅ **Auto-applying Promotions** - Discounts apply automatically at checkout (no more manual coupons!)
- ✅ **Tier-Based Loyalty** - Loyalty benefits tied to membership tier (not longevity)
- ✅ **Flexible Tier Structures** - Support for loyalty-only tiers, discount+loyalty, and premium tiers
- ✅ **Native C7 Integration** - Uses Commerce7's club functionality for better long-term support

**📚 New Documentation:**
- **[CLUB_ARCHITECTURE_INDEX.md](docs/CLUB_ARCHITECTURE_INDEX.md)** - Start here for complete overview
- [ARCHITECTURE_CHANGE.md](docs/ARCHITECTURE_CHANGE.md) - Why and what changed
- [CLUB_CREATION_FLOW.md](docs/CLUB_CREATION_FLOW.md) - How clubs are created
- [C7_CLUB_ENDPOINTS.md](docs/C7_CLUB_ENDPOINTS.md) - Commerce7 API reference
- [TIER_BASED_LOYALTY.md](docs/TIER_BASED_LOYALTY.md) - New loyalty model
- [DATABASE_SCHEMA_UPDATES.md](docs/DATABASE_SCHEMA_UPDATES.md) - Schema changes

## Features

- **Wine Club Management**: Manage wine club memberships with Commerce7 clubs, automatic promotions, and tiered benefits.
- **Auto-Applying Promotions**: Discounts automatically apply at checkout - no manual coupon codes needed.
- **Tier-Based Loyalty**: Loyalty earning rates tied to membership tier (e.g., Bronze: 1 pt/$, Gold: 5 pts/$).
- **Flexible Tier Structures**: Support loyalty-only tiers, discount tiers, or combined discount + loyalty tiers.
- **Multi-Platform Support**: Seamlessly integrate with Commerce7 and Shopify.
- **Subdomain-Based Routing**: Separate platform access via dedicated subdomains (c7.* for Commerce7, shp.* for Shopify).
- **Real-time Webhook Integration**: Keep your data in sync across all platforms with instant updates.
- **Member Data Management**: Centralized customer, order, and club membership management.
- **Modern Tech Stack**: Built with React Router v7, TypeScript, and Tailwind CSS.
- **Scalable Architecture**: Designed for wineries of all sizes.

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
   - See [SUBDOMAIN_SETUP.md](docs/SUBDOMAIN_SETUP.md) for detailed instructions
   - Edit `/etc/hosts` to add local subdomain entries

8. (Optional) Set up Ngrok for webhook testing:
   - See [NGROK_WEBHOOK_SETUP.md](docs/NGROK_WEBHOOK_SETUP.md) for detailed instructions
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
- **Note**: Tenant ID comes dynamically from the auth flow (like shop for Shopify)

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

For detailed setup instructions, see [SUBDOMAIN_SETUP.md](docs/SUBDOMAIN_SETUP.md).

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

For detailed instructions, see [NGROK_WEBHOOK_SETUP.md](docs/NGROK_WEBHOOK_SETUP.md).

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

### Core Tables
- `clients` - Paid customers (wineries) with tenant_shop, org info
- `platform_sessions` - Authentication sessions linked to clients
- `customers` - Wine club members and customers (linked to clients)
- `products` - Wine inventory and products (linked to clients)
- `orders` - Orders and club shipments (linked to clients)

### Club Architecture Tables
- `club_programs` - Wine club programs (one per client)
- `club_stages` - Membership tiers (Bronze, Silver, Gold, etc.)
- `club_promotions` - **NEW:** Commerce7 promotions (auto-applying discounts)
- `tier_loyalty_config` - **NEW:** Tier-specific loyalty point earning rules
- `club_enrollments` - Customer membership in tiers
- `loyalty_rewards` - Redemption catalog

All data is properly isolated per client using foreign keys.

For complete schema documentation, see [DATABASE_SCHEMA_UPDATES.md](docs/DATABASE_SCHEMA_UPDATES.md).

## Contributing

We welcome contributions! Please see our [Contributing Guide](.github/CONTRIBUTING.md) for details.

### Quick Start

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-crm-provider`
3. Commit your changes: `git commit -am 'Add new CRM provider'`
4. Push to the branch: `git push origin feature/new-crm-provider`
5. Submit a pull request

### GitHub Integration

For setting up GitHub workflows, CI/CD, and automation, see [GITHUB_SETUP.md](docs/GITHUB_SETUP.md).

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

## Documentation

### Quick Links
- **[CLUB_ARCHITECTURE_INDEX.md](docs/CLUB_ARCHITECTURE_INDEX.md)** - 📚 Complete documentation index (START HERE)
- [ARCHITECTURE_CHANGE.md](docs/ARCHITECTURE_CHANGE.md) - Overview of the club architecture
- [CLUB_CREATION_FLOW.md](docs/CLUB_CREATION_FLOW.md) - Detailed club creation process
- [TIER_BASED_LOYALTY.md](docs/TIER_BASED_LOYALTY.md) - Loyalty model and examples
- [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) - Database schema reference
- [CRM_PROVIDER_PATTERN.md](docs/CRM_PROVIDER_PATTERN.md) - Platform abstraction pattern

### Setup Guides
- [ENVIRONMENT_SETUP.md](docs/ENVIRONMENT_SETUP.md) - Local development setup
- [SUBDOMAIN_SETUP.md](docs/SUBDOMAIN_SETUP.md) - Subdomain configuration
- [NGROK_WEBHOOK_SETUP.md](docs/NGROK_WEBHOOK_SETUP.md) - Webhook testing with Ngrok
- [GITHUB_SETUP.md](docs/GITHUB_SETUP.md) - GitHub CI/CD setup

### Commerce7 Integration
- [C7_CLUB_ENDPOINTS.md](docs/C7_CLUB_ENDPOINTS.md) - Commerce7 API reference
- [C7_AUTHORIZATION.md](docs/C7_AUTHORIZATION.md) - Commerce7 authentication
- [C7_INSTALL_FLOW.md](docs/C7_INSTALL_FLOW.md) - Installation process

## Support

For support, email support@ynosoftware.com or create an issue in the GitHub repository.