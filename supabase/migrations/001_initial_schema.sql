-- Create clients table for paid customers (wineries)
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_shop VARCHAR(255) NOT NULL UNIQUE, -- tenant for Commerce7, shop for Shopify
  crm_type VARCHAR(20) NOT NULL CHECK (crm_type IN ('shopify', 'commerce7')),
  org_name VARCHAR(255) NOT NULL,
  org_contact VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for clients
CREATE INDEX IF NOT EXISTS idx_clients_tenant_shop ON clients(tenant_shop);
CREATE INDEX IF NOT EXISTS idx_clients_crm_type ON clients(crm_type);

-- Create sessions table (for authentication tokens)
CREATE TABLE IF NOT EXISTS platform_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  scope TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for sessions
CREATE INDEX IF NOT EXISTS idx_platform_sessions_client_id ON platform_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_platform_sessions_expires_at ON platform_sessions(expires_at);

-- Create customers table (wine club members and customers)
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  crm_id VARCHAR(255), -- ID from Commerce7 or Shopify (nullable until synced)
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  phone VARCHAR(50),
  
  -- Club membership
  is_club_member BOOLEAN DEFAULT false,
  
  -- Loyalty points
  loyalty_points_balance INTEGER NOT NULL DEFAULT 0,
  loyalty_points_lifetime INTEGER NOT NULL DEFAULT 0,
  cumulative_membership_days INTEGER NOT NULL DEFAULT 0,
  loyalty_earning_active BOOLEAN NOT NULL DEFAULT false,
  loyalty_eligible_since TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(client_id, crm_id)
);

-- Unique index for email per client
CREATE UNIQUE INDEX idx_customers_client_email ON customers(client_id, email);

-- Unique index for crm_id per client (when set)
CREATE UNIQUE INDEX idx_customers_client_crm_id ON customers(client_id, crm_id)
  WHERE crm_id IS NOT NULL;

-- Create products table (wines and products)
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  crm_id VARCHAR(255) NOT NULL, -- ID from Commerce7 or Shopify
  title VARCHAR(500) NOT NULL,
  sku VARCHAR(255),
  price DECIMAL(10,2),
  image_url TEXT,
  description TEXT,
  wine_type VARCHAR(50), -- Red, White, Rosé, Sparkling, etc.
  vintage INTEGER,
  varietal VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, crm_id)
);

-- Create orders table (orders and club shipments)
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  crm_id VARCHAR(255) NOT NULL, -- ID from Commerce7 or Shopify
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(100),
  is_club_shipment BOOLEAN DEFAULT false,
  shipment_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, crm_id)
);

-- Create discounts table (promotional discounts)
CREATE TABLE IF NOT EXISTS discounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  crm_id VARCHAR(255) NOT NULL, -- ID from Commerce7 or Shopify
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
  UNIQUE(client_id, crm_id)
);

-- Create club_programs table (one per client)
CREATE TABLE IF NOT EXISTS club_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create club_stages table (multiple per program)
CREATE TABLE IF NOT EXISTS club_stages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_program_id UUID NOT NULL REFERENCES club_programs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  discount_percentage DECIMAL(5,2) NOT NULL,
  discount_code VARCHAR(255),
  duration_months INTEGER NOT NULL,
  min_purchase_amount DECIMAL(10,2) NOT NULL,
  stage_order INTEGER NOT NULL,
  
  -- CRM sync tracking
  crm_discount_id VARCHAR(255),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status VARCHAR(20) CHECK (sync_status IN ('synced', 'pending', 'error')),
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(club_program_id, stage_order)
);

-- Create club_enrollments table (customer membership)
CREATE TABLE IF NOT EXISTS club_enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  club_stage_id UUID NOT NULL REFERENCES club_stages(id) ON DELETE CASCADE,
  
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  qualifying_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'expired', 'upgraded')
  ),
  
  -- CRM sync tracking
  synced_to_crm BOOLEAN DEFAULT false,
  crm_sync_at TIMESTAMP WITH TIME ZONE,
  crm_sync_error TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create club_extensions table (enrollment history)
CREATE TABLE IF NOT EXISTS club_extensions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES club_enrollments(id) ON DELETE CASCADE,
  extended_from_stage_id UUID REFERENCES club_stages(id) ON DELETE SET NULL,
  extended_to_stage_id UUID NOT NULL REFERENCES club_stages(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  
  extension_type VARCHAR(20) NOT NULL CHECK (
    extension_type IN ('renewal', 'upgrade')
  ),
  
  extended_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  new_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create loyalty_point_rules table (per client configuration)
CREATE TABLE IF NOT EXISTS loyalty_point_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
  
  points_per_dollar DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  bonus_points_percentage DECIMAL(5,2) DEFAULT 0,
  min_membership_days INTEGER NOT NULL DEFAULT 365,
  point_dollar_value DECIMAL(10,4) NOT NULL DEFAULT 0.01,
  min_points_for_redemption INTEGER DEFAULT 100,
  max_points_per_order INTEGER,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create loyalty_rewards table (redemption catalog)
-- Must be created BEFORE point_transactions (which references it)
CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  reward_type VARCHAR(20) NOT NULL CHECK (
    reward_type IN ('merchandise', 'event', 'tasting', 'wine_point_sale', 'other')
  ),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  points_required INTEGER NOT NULL,
  
  -- Wine point sale details
  wine_crm_id VARCHAR(255),
  wine_sku VARCHAR(255),
  wine_title VARCHAR(500),
  regular_price DECIMAL(10,2),
  
  -- Inventory
  quantity_available INTEGER,
  quantity_redeemed INTEGER DEFAULT 0,
  
  -- Availability
  is_active BOOLEAN DEFAULT true,
  available_from TIMESTAMP WITH TIME ZONE,
  available_until TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create point_transactions table (complete history)
CREATE TABLE IF NOT EXISTS point_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  transaction_type VARCHAR(20) NOT NULL CHECK (
    transaction_type IN ('earned', 'redeemed', 'bonus', 'adjusted', 'expired')
  ),
  points INTEGER NOT NULL,
  
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  reward_id UUID REFERENCES loyalty_rewards(id) ON DELETE SET NULL,
  description TEXT,
  balance_after INTEGER NOT NULL,
  created_by VARCHAR(100),
  
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reward_redemptions table (redemption history)
CREATE TABLE IF NOT EXISTS reward_redemptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES loyalty_rewards(id) ON DELETE CASCADE,
  point_transaction_id UUID NOT NULL REFERENCES point_transactions(id) ON DELETE CASCADE,
  
  points_spent INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'fulfilled', 'cancelled', 'refunded')
  ),
  
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  fulfilled_by VARCHAR(100),
  notes TEXT,
  
  redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create communication_configs table (per client settings)
CREATE TABLE IF NOT EXISTS communication_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
  
  -- Email provider
  email_provider VARCHAR(50) CHECK (email_provider IN ('mailchimp', 'klaviyo', 'sendgrid')),
  email_api_key TEXT,
  email_from_address VARCHAR(255),
  email_from_name VARCHAR(255),
  email_list_id VARCHAR(255),
  
  -- SMS provider
  sms_provider VARCHAR(50) CHECK (sms_provider IN ('mailchimp', 'twilio', 'klaviyo')),
  sms_api_key TEXT,
  sms_from_number VARCHAR(50),
  
  -- Settings
  send_monthly_status BOOLEAN DEFAULT true,
  send_expiration_warnings BOOLEAN DEFAULT true,
  warning_days_before INTEGER DEFAULT 7,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create communication_templates table (winery-specific templates)
CREATE TABLE IF NOT EXISTS communication_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  template_type VARCHAR(50) NOT NULL CHECK (
    template_type IN (
      'monthly_status',
      'expiration_warning',
      'upgrade_available',
      'points_earned',
      'reward_available',
      'welcome',
      'renewal_reminder'
    )
  ),
  channel VARCHAR(10) NOT NULL CHECK (channel IN ('email', 'sms')),
  
  subject VARCHAR(500),
  html_body TEXT,
  text_body TEXT,
  
  provider_template_id VARCHAR(255),
  available_variables JSONB,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(client_id, template_type, channel)
);

-- Create communication_log table (audit trail)
CREATE TABLE IF NOT EXISTS communication_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  template_type VARCHAR(50) NOT NULL,
  channel VARCHAR(10) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  to_address VARCHAR(255) NOT NULL,
  
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked')
  ),
  
  provider_message_id VARCHAR(255),
  error_message TEXT,
  
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create communication_preferences table (customer opt-in/out)
CREATE TABLE IF NOT EXISTS communication_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
  
  email_monthly_status BOOLEAN DEFAULT true,
  email_expiration_warnings BOOLEAN DEFAULT true,
  email_promotions BOOLEAN DEFAULT true,
  
  sms_monthly_status BOOLEAN DEFAULT false,
  sms_expiration_warnings BOOLEAN DEFAULT true,
  sms_promotions BOOLEAN DEFAULT false,
  
  unsubscribed_all BOOLEAN DEFAULT false,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create crm_sync_queue table (retry queue for CRM sync)
CREATE TABLE IF NOT EXISTS crm_sync_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES club_enrollments(id) ON DELETE CASCADE,
  
  action_type VARCHAR(50) NOT NULL CHECK (
    action_type IN ('add_customer', 'remove_customer', 'upgrade_customer')
  ),
  
  stage_id UUID REFERENCES club_stages(id) ON DELETE CASCADE,
  old_stage_id UUID REFERENCES club_stages(id) ON DELETE SET NULL,
  customer_crm_id VARCHAR(255) NOT NULL,
  
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  status VARCHAR(20) DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  ),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_client_id ON customers(client_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_is_club_member ON customers(is_club_member);
CREATE INDEX IF NOT EXISTS idx_customers_loyalty_eligible ON customers(loyalty_eligible_since);
CREATE INDEX IF NOT EXISTS idx_customers_points_balance ON customers(loyalty_points_balance);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_client_id ON products(client_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_wine_type ON products(wine_type);

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_is_club_shipment ON orders(is_club_shipment);

-- Discounts
CREATE INDEX IF NOT EXISTS idx_discounts_client_id ON discounts(client_id);
CREATE INDEX IF NOT EXISTS idx_discounts_code ON discounts(code);
CREATE INDEX IF NOT EXISTS idx_discounts_is_active ON discounts(is_active);

-- Club programs
CREATE INDEX IF NOT EXISTS idx_club_programs_client_id ON club_programs(client_id);
CREATE INDEX IF NOT EXISTS idx_club_programs_is_active ON club_programs(is_active);

-- Club stages
CREATE INDEX IF NOT EXISTS idx_club_stages_program_id ON club_stages(club_program_id);
CREATE INDEX IF NOT EXISTS idx_club_stages_order ON club_stages(stage_order);
CREATE INDEX IF NOT EXISTS idx_club_stages_is_active ON club_stages(is_active);

-- Club enrollments
CREATE INDEX IF NOT EXISTS idx_club_enrollments_customer_id ON club_enrollments(customer_id);
CREATE INDEX IF NOT EXISTS idx_club_enrollments_stage_id ON club_enrollments(club_stage_id);
CREATE INDEX IF NOT EXISTS idx_club_enrollments_status ON club_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_club_enrollments_expires_at ON club_enrollments(expires_at);
CREATE INDEX IF NOT EXISTS idx_club_enrollments_synced ON club_enrollments(synced_to_crm);

-- Club extensions
CREATE INDEX IF NOT EXISTS idx_club_extensions_enrollment_id ON club_extensions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_club_extensions_order_id ON club_extensions(order_id);

-- Loyalty point rules
CREATE INDEX IF NOT EXISTS idx_loyalty_point_rules_client_id ON loyalty_point_rules(client_id);

-- Point transactions
CREATE INDEX IF NOT EXISTS idx_point_transactions_customer_id ON point_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON point_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_point_transactions_date ON point_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_point_transactions_order_id ON point_transactions(order_id);

-- Loyalty rewards
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_client_id ON loyalty_rewards(client_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_type ON loyalty_rewards(reward_type);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_is_active ON loyalty_rewards(is_active);

-- Reward redemptions
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_customer_id ON reward_redemptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_reward_id ON reward_redemptions(reward_id);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_status ON reward_redemptions(status);

-- Communication log
CREATE INDEX IF NOT EXISTS idx_comm_log_customer_id ON communication_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_comm_log_client_id ON communication_log(client_id);
CREATE INDEX IF NOT EXISTS idx_comm_log_status ON communication_log(status);
CREATE INDEX IF NOT EXISTS idx_comm_log_template_type ON communication_log(template_type);
CREATE INDEX IF NOT EXISTS idx_comm_log_sent_at ON communication_log(sent_at);

-- Communication preferences
CREATE INDEX IF NOT EXISTS idx_comm_prefs_customer_id ON communication_preferences(customer_id);

-- CRM sync queue
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON crm_sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_next_retry ON crm_sync_queue(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_sync_queue_client_id ON crm_sync_queue(client_id);

-- Enable Row Level Security (RLS)
-- Note: All access is server-side via service role, so RLS is for defense-in-depth only
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_point_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_sync_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (service role has full access)
-- Security is enforced at OAuth/session level with client_id filtering
CREATE POLICY "Service role full access" ON clients FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON platform_sessions FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON customers FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON products FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON orders FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON discounts FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON club_programs FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON club_stages FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON club_enrollments FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON club_extensions FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON loyalty_point_rules FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON point_transactions FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON loyalty_rewards FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON reward_redemptions FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON communication_configs FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON communication_templates FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON communication_log FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON communication_preferences FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON crm_sync_queue FOR ALL TO service_role USING (true);
