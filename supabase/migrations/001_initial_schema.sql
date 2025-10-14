-- Create CRM sessions table
CREATE TABLE IF NOT EXISTS crm_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  crm_type VARCHAR(20) NOT NULL CHECK (crm_type IN ('shopify', 'commerce7')),
  shop VARCHAR(255), -- For Shopify
  tenant VARCHAR(255), -- For Commerce7
  access_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_crm_sessions_crm_type ON crm_sessions(crm_type);
CREATE INDEX IF NOT EXISTS idx_crm_sessions_shop ON crm_sessions(shop);
CREATE INDEX IF NOT EXISTS idx_crm_sessions_tenant ON crm_sessions(tenant);
CREATE INDEX IF NOT EXISTS idx_crm_sessions_expires_at ON crm_sessions(expires_at);

-- Create customers table for unified customer data
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  crm_type VARCHAR(20) NOT NULL CHECK (crm_type IN ('shopify', 'commerce7')),
  crm_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  phone VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(crm_type, crm_id)
);

-- Create products table for unified product data
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  crm_type VARCHAR(20) NOT NULL CHECK (crm_type IN ('shopify', 'commerce7')),
  crm_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  sku VARCHAR(255),
  price DECIMAL(10,2),
  image_url TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(crm_type, crm_id)
);

-- Create orders table for unified order data
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  crm_type VARCHAR(20) NOT NULL CHECK (crm_type IN ('shopify', 'commerce7')),
  crm_id VARCHAR(255) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(crm_type, crm_id)
);

-- Create discounts table for unified discount data
CREATE TABLE IF NOT EXISTS discounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  crm_type VARCHAR(20) NOT NULL CHECK (crm_type IN ('shopify', 'commerce7')),
  crm_id VARCHAR(255) NOT NULL,
  code VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed_amount')),
  value DECIMAL(10,2) NOT NULL,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(crm_type, crm_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_crm_type ON customers(crm_type);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_products_crm_type ON products(crm_type);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_orders_crm_type ON orders(crm_type);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_discounts_crm_type ON discounts(crm_type);
CREATE INDEX IF NOT EXISTS idx_discounts_code ON discounts(code);
CREATE INDEX IF NOT EXISTS idx_discounts_is_active ON discounts(is_active);

-- Enable Row Level Security (RLS)
ALTER TABLE crm_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (adjust based on your security requirements)
CREATE POLICY "Allow all operations for service role" ON crm_sessions FOR ALL USING (true);
CREATE POLICY "Allow all operations for service role" ON customers FOR ALL USING (true);
CREATE POLICY "Allow all operations for service role" ON products FOR ALL USING (true);
CREATE POLICY "Allow all operations for service role" ON orders FOR ALL USING (true);
CREATE POLICY "Allow all operations for service role" ON discounts FOR ALL USING (true);
