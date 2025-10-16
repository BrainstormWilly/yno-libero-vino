# Database Schema Documentation

## Overview

The Yno Libero Vino platform uses a multi-tenant architecture where each winery is a separate client. All data is properly isolated per client using foreign key relationships.

## Core Concept

- **tenant_shop**: Unique identifier for each winery
  - For Commerce7: This is the `tenant` from the auth flow
  - For Shopify: This is the `shop` domain (e.g., `your-winery.myshopify.com`)
- **client_id**: Foreign key that links all data to a specific winery

## Tables

### 1. `clients` (Paid Customers - Wineries)

The central table for each winery customer.

```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  tenant_shop VARCHAR(255) UNIQUE NOT NULL,  -- tenant (C7) or shop (Shopify)
  crm_type VARCHAR(20) NOT NULL,             -- 'commerce7' or 'shopify'
  org_name VARCHAR(255) NOT NULL,            -- Winery name
  org_contact VARCHAR(255),                  -- Primary contact email/name
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

**Key Points:**
- One row per winery
- `tenant_shop` is unique across all clients
- Used to identify which winery data belongs to

### 2. `platform_sessions` (Authentication)

Stores OAuth tokens for platform integrations.

```sql
CREATE TABLE platform_sessions (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  scope TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

**Key Points:**
- Linked to specific client
- Stores OAuth credentials
- Manages token expiration

### 3. `customers` (Wine Club Members & Customers)

End customers of the wineries - wine club members and purchasers.

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  crm_id VARCHAR(255) NOT NULL,              -- ID from Commerce7/Shopify
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  phone VARCHAR(50),
  is_club_member BOOLEAN DEFAULT false,
  loyalty_points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(client_id, crm_id)
);
```

**Key Points:**
- Each customer belongs to one winery (client)
- `crm_id` is the ID from the source platform
- Wine club status tracked with `is_club_member` boolean
- Loyalty points for rewards programs

### 4. `products` (Wines & Products)

Product catalog for each winery.

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  crm_id VARCHAR(255) NOT NULL,              -- ID from Commerce7/Shopify
  title VARCHAR(500) NOT NULL,
  sku VARCHAR(255),
  price DECIMAL(10,2),
  image_url TEXT,
  description TEXT,
  wine_type VARCHAR(50),                     -- Red, White, Rosé, Sparkling
  vintage INTEGER,                           -- Year
  varietal VARCHAR(255),                     -- Cabernet, Chardonnay, etc.
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(client_id, crm_id)
);
```

**Key Points:**
- Wine-specific fields (type, vintage, varietal)
- Each product belongs to one winery
- Synced from Commerce7 or Shopify

### 5. `orders` (Orders & Club Shipments)

All orders including wine club shipments.

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  crm_id VARCHAR(255) NOT NULL,              -- ID from Commerce7/Shopify
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(100),
  is_club_shipment BOOLEAN DEFAULT false,
  shipment_date DATE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(client_id, crm_id)
);
```

**Key Points:**
- Distinguishes regular orders from club shipments
- Linked to both client and customer
- Tracks shipment dates for wine club

### 6. `discounts` (Promotional Discounts)

Discount codes and promotional offers.

```sql
CREATE TABLE discounts (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  crm_id VARCHAR(255) NOT NULL,              -- ID from Commerce7/Shopify
  code VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL,                 -- 'percentage' or 'fixed_amount'
  value DECIMAL(10,2) NOT NULL,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(client_id, crm_id)
);
```

**Key Points:**
- Promotional discount codes
- Time-bound offers
- Tracks usage limits and counts

## Data Flow

### 1. New Winery Onboarding

```
1. Winery authenticates with Commerce7/Shopify
2. Create `clients` record with tenant/shop
3. Create `platform_sessions` record with tokens
4. Begin syncing data via webhooks
```

### 2. Webhook Data Sync

```
Webhook arrives → Identify client by tenant/shop → 
  Update/create records with client_id → 
    All data isolated per client
```

### 3. Customer Lookup

```
Query customers WHERE client_id = <winery_id>
  → Only see that winery's customers
```

## Indexes

All tables have appropriate indexes for:
- Foreign key lookups (client_id)
- Common queries (email, SKU, status)
- Performance (is_active, is_club_member)

## Security

### Row Level Security (RLS)

All tables have RLS enabled with service role policies. Future policies can be added to:
- Restrict access by client_id
- Allow wineries to only see their own data
- Implement user roles (admin, manager, viewer)

### Data Isolation

- Every record (except clients) has a `client_id`
- ON DELETE CASCADE ensures clean removal
- UNIQUE constraints prevent duplicates per client

## Migration

The schema is defined in: `supabase/migrations/001_initial_schema.sql`

To apply:
```bash
npx supabase db push
```

## Future Enhancements

Potential additions:
- `shipment_preferences` - Customer shipping preferences
- `tasting_notes` - Wine tasting notes and ratings
- `events` - Winery events and RSVP tracking
- `inventory` - Physical inventory management
- `allocations` - Wine allocation management
- `invoices` - Detailed invoicing
- `club_tiers` - If needed, define wine club membership levels

## Example Queries

### Get all club members for a winery

```sql
SELECT * FROM customers 
WHERE client_id = '<winery-uuid>' 
  AND is_club_member = true;
```

### Get upcoming club shipments

```sql
SELECT o.*, c.email, c.first_name, c.last_name
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.client_id = '<winery-uuid>'
  AND o.is_club_shipment = true
  AND o.shipment_date >= CURRENT_DATE
ORDER BY o.shipment_date;
```

### Get all wines by type

```sql
SELECT * FROM products
WHERE client_id = '<winery-uuid>'
  AND wine_type = 'Red'
ORDER BY vintage DESC;
```

## Notes

- **tenant_shop is the key identifier**: Always use this to identify which winery's data you're working with
- **No COMMERCE7_TENANT env var**: The tenant comes dynamically from the auth flow
- **Multi-tenant architecture**: All data is properly isolated per client
- **Webhook processing**: Use tenant/shop from webhook payload to look up client_id

