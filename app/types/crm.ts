export enum CrmNames {
  SHOPIFY = 'Shopify',
  COMMERCE7 = 'Commerce7'
}

export enum CrmSlugs {
  SHOPIFY = 'shopify',
  COMMERCE7 = 'commerce7'
}

export type Crm = {
  name: CrmNames;
  slug: CrmSlugs;
};

export type CrmTypes = 'commerce7' | 'shopify';

export type SerializedCrm = {
  name: string,
  slug: string
}

export const crmSlugs = (): string[] => {
  return Object.values(CrmSlugs);
};

export const parseCrm = (json: SerializedCrm): Crm => ({
  name: json.name as CrmNames,
  slug: json.slug as CrmSlugs,
});

// Common CRM entity interfaces
export interface CrmCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
  ltv?: number; // Lifetime value in currency (not cents)
}

export interface CrmProduct {
  id: string;
  title: string;
  sku: string;
  price: number;
  image?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmCollection {
  id: string;
  title: string;
  image?: string;
  description?: string;
}

export interface CrmOrder {
  id: string;
  customerId: string;
  total: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmDiscount {
  id: string;
  code: string;
  type: 'percentage' | 'fixed_amount';
  value: number;
  startsAt?: string;
  endsAt?: string;
  usageLimit?: number;
  usageCount: number;
  isActive: boolean;
}

// Webhook types
export type WebhookTopic = 
  | 'customers/create'
  | 'customers/update'
  | 'customers/delete'
  | 'orders/create'
  | 'orders/update'
  | 'orders/cancelled'
  | 'products/create'
  | 'products/update'
  | 'products/delete';

export interface WebhookPayload {
  topic: WebhookTopic;
  shop?: string; // For Shopify
  tenant?: string; // For Commerce7
  data: any;
  timestamp: string;
}

export interface WebhookRegistration {
  id?: string;
  topic: WebhookTopic;
  address: string;
  createdAt?: string;
}

// CRM Provider Interface
export interface CrmProvider {
  name: CrmNames;
  slug: CrmSlugs;
  
  // Authentication
  authenticate(request: Request): Promise<any>;
  authorizeInstall(request: Request): boolean;
  
  // Customer operations
  getCustomers(params?: any): Promise<CrmCustomer[]>;
  getCustomersWithLTV(params?: any): Promise<CrmCustomer[]>; // Get customers with LTV calculated
  getCustomer(id: string): Promise<CrmCustomer>;
  getCustomerWithLTV(id: string): Promise<CrmCustomer>; // Get single customer with LTV calculated
  createCustomer(customer: Partial<CrmCustomer>): Promise<CrmCustomer>;
  updateCustomer(id: string, customer: Partial<CrmCustomer>): Promise<CrmCustomer>;
  upsertCustomer(customer: Partial<CrmCustomer>): Promise<CrmCustomer>;
  findCustomerByEmail(email: string): Promise<CrmCustomer | null>;
  
  // Customer address operations
  getCustomerAddresses(customerId: string): Promise<any[]>;
  createCustomerAddress(customerId: string, address: any): Promise<any>;
  
  // Customer payment operations
  getCustomerCreditCards(customerId: string): Promise<any[]>;
  createCustomerCreditCard(customerId: string, card: any): Promise<any>;
  
  // Product operations
  getProducts(params?: any): Promise<CrmProduct[]>;
  getProduct(id: string): Promise<CrmProduct>;
  
  // Collection operations
  getCollections(params?: any): Promise<CrmCollection[]>;
  getCollection(id: string): Promise<CrmCollection>;
  
  // Order operations
  getOrders(params?: any): Promise<CrmOrder[]>;
  getOrder(id: string): Promise<CrmOrder>;
  
  // Coupon operations (manual discount codes)
  getCoupons(params?: any): Promise<CrmDiscount[]>;
  getCoupon(id: string): Promise<CrmDiscount>;
  createCoupon(discount: Partial<CrmDiscount>): Promise<CrmDiscount>;
  updateCoupon(id: string, discount: Partial<CrmDiscount>): Promise<CrmDiscount>;
  deleteCoupon(id: string): Promise<boolean>;
  
  // Webhook operations
  validateWebhook(request: Request): Promise<boolean>;
  processWebhook(payload: WebhookPayload): Promise<void>;
  registerWebhook(topic: WebhookTopic, address: string): Promise<WebhookRegistration>;
  listWebhooks(): Promise<WebhookRegistration[]>;
  deleteWebhook(id: string): Promise<boolean>;
  
  // Customer-specific coupon management (for club stages)
  addCustomerToDiscount(discountId: string, customerId: string): Promise<void>;
  removeCustomerFromDiscount(discountId: string, customerId: string): Promise<void>;
  getCouponCustomers(couponId: string): Promise<string[]>;
  
  // Club/Tier operations (idempotent)
  upsertClub(tier: { id: string; name: string; c7ClubId?: string | null }): Promise<{ crmClubId: string }>;
  
  // Customer operations with address (atomic creation)
  createCustomerWithAddress(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address: any;
  }): Promise<{ customer: any; billingAddressId: string }>;
  
  // Club membership operations
  createClubMembership(data: {
    customerId: string;
    clubId: string;
    billingAddressId: string;
    shippingAddressId: string;
    paymentMethodId: string;
    startDate: string;
  }): Promise<{ id: string; status: string }>;
  
  // Loyalty tier operations (optional feature)
  createLoyaltyTier(data: any): Promise<any>;
  deleteLoyaltyTier(loyaltyTierId: string): Promise<void>;
}
