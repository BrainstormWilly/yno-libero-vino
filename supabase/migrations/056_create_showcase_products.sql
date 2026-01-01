-- Create showcase_products table
-- Stores products curated by clients for email marketing campaigns
-- Products are searchable from Commerce7 and can include specific variants

CREATE TABLE showcase_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  crm_product_id VARCHAR(255), -- C7 product ID (nullable for manual entries)
  crm_variant_id VARCHAR(255), -- C7 variant ID (nullable, for products with multiple variants)
  title VARCHAR(500) NOT NULL, -- Product title + variant (e.g., "2014 Spectra Cabernet Sauvignon - 750ml")
  image_url TEXT NOT NULL,
  price DECIMAL(10,2), -- Nullable for products without fixed prices
  product_url TEXT NOT NULL, -- Link to product on client's storefront
  display_order INTEGER NOT NULL DEFAULT 0, -- For manual ordering
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(client_id, crm_product_id, crm_variant_id) -- Prevent duplicate product+variant combinations per client
);

-- Add indexes for common queries
CREATE INDEX idx_showcase_products_client_id ON showcase_products(client_id);
CREATE INDEX idx_showcase_products_display_order ON showcase_products(client_id, display_order);

-- Add comments for documentation
COMMENT ON TABLE showcase_products IS 'Products curated by clients for email marketing. Each entry represents a product (or variant) to showcase in marketing emails.';
COMMENT ON COLUMN showcase_products.crm_variant_id IS 'Commerce7 variant ID. Allows clients to showcase specific variants (e.g., 750ml vs 1.5L) as separate entries.';
COMMENT ON COLUMN showcase_products.display_order IS 'Order in which products appear in emails. Lower numbers appear first.';
COMMENT ON COLUMN showcase_products.is_active IS 'Whether this product should be included in marketing emails. Allows clients to temporarily hide products without deleting them.';

