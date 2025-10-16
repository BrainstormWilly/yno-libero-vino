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
  getCustomer(id: string): Promise<CrmCustomer>;
  createCustomer(customer: Partial<CrmCustomer>): Promise<CrmCustomer>;
  updateCustomer(id: string, customer: Partial<CrmCustomer>): Promise<CrmCustomer>;
  upsertCustomer(customer: Partial<CrmCustomer>): Promise<CrmCustomer>;
  findCustomerByEmail(email: string): Promise<CrmCustomer | null>;
  
  // Product operations
  getProducts(params?: any): Promise<CrmProduct[]>;
  getProduct(id: string): Promise<CrmProduct>;
  
  // Order operations
  getOrders(params?: any): Promise<CrmOrder[]>;
  getOrder(id: string): Promise<CrmOrder>;
  
  // Discount operations
  getDiscounts(params?: any): Promise<CrmDiscount[]>;
  getDiscount(id: string): Promise<CrmDiscount>;
  createDiscount(discount: Partial<CrmDiscount>): Promise<CrmDiscount>;
  updateDiscount(id: string, discount: Partial<CrmDiscount>): Promise<CrmDiscount>;
  deleteDiscount(id: string): Promise<boolean>;
  
  // Webhook operations
  validateWebhook(request: Request): Promise<boolean>;
  processWebhook(payload: WebhookPayload): Promise<void>;
  registerWebhook(topic: WebhookTopic, address: string): Promise<WebhookRegistration>;
  listWebhooks(): Promise<WebhookRegistration[]>;
  deleteWebhook(id: string): Promise<boolean>;
  
  // Customer-specific discount management (for club stages)
  addCustomerToDiscount(discountId: string, customerId: string): Promise<void>;
  removeCustomerFromDiscount(discountId: string, customerId: string): Promise<void>;
  getDiscountCustomers(discountId: string): Promise<string[]>;
}
