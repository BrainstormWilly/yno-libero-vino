import type {
  CrmProvider,
  CrmCustomer,
  CrmProduct,
  CrmCollection,
  CrmOrder,
  CrmDiscount,
  WebhookPayload,
  WebhookTopic,
  WebhookRegistration,
} from "~/types/crm";
import { CrmNames, CrmSlugs } from "~/types/crm";
import { redirect } from "react-router";
import crypto from "crypto";
import type { C7CouponPayload } from "~/types/discount-commerce7";
import type { C7Tag } from "~/types/tag";
import { C7TagObjectType } from "~/types/tag";
import type {
  C7ClubCreateRequest,
  C7Club,
  C7PromotionCreateRequest,
  C7Promotion,
  C7PromotionSetCreateRequest,
  C7PromotionSet,
  C7LoyaltyTierCreateRequest,
  C7LoyaltyTier,
  C7LoyaltyTransactionCreateRequest,
  C7LoyaltyTransaction,
} from "~/types/commerce7";
import {
  fromC7Customer,
  fromC7Address,
  fromC7Payment,
  toC7Address,
  calculateC7LTV,
  type C7CustomerResponse,
  type C7AddressResponse,
  type C7CreditCardResponse,
} from "~/types/customer-commerce7";
import { toC7ClubMembership } from "~/types/member-commerce7";
import type { Customer, CustomerAddress, CustomerPayment } from "~/types/customer";

const API_URL = "https://api.commerce7.com/v1";
const APP_NAME = "yno-liberovino-wine-club-and-loyalty";

// Helper to get API auth (lazy evaluation)
function getApiAuth(): string {
  const API_KEY = process.env.COMMERCE7_KEY;
  if (!API_KEY) {
    throw new Error("Commerce7 Error. Missing API key");
  }
  return "Basic " + Buffer.from(`${APP_NAME}:${API_KEY}`).toString("base64");
}

/**
 * Helper to check and handle Commerce7 API errors
 * C7 has two error patterns:
 * 1. HTTP error status (non-200) - error in { statusCode, type, message }
 * 2. Success status (200) but operation failed - errors in { errors: [] }
 */
function handleC7ApiError(data: any, operation: string): void {
  if(!data) return;
  
  // Check for status code errors
  const errorMessages = data.errors
  ? data.errors.map((e: any) => 
      typeof e === 'string' ? e : (e.message || JSON.stringify(e))
    ).join(', ')
  : 'Unknown error';

  if (data.statusCode && data.statusCode !== 200) {
    console.error('############# Commerce7 API error:', data);
    throw new Error(
      `Commerce7 ${operation} error (${data.statusCode}): ${errorMessages}`
    );
  }
  
  // Check for errors array (success status but operation failed)
  if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
    throw new Error(`Commerce7 ${operation} error: ${errorMessages}`);
  }
}

export class Commerce7Provider implements CrmProvider {
  name = CrmNames.COMMERCE7;
  slug = CrmSlugs.COMMERCE7;
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async authenticate(request: Request) {
    const searchParams = new URL(request.url).searchParams;
    const tenantId = searchParams.get("tenantId");
    const account = searchParams.get("account");

    if (!tenantId || !account) {
      throw new Error("Missing Commerce7 authentication parameters");
    }

    // Verify the account token
    const userResponse = await fetch(`${API_URL}/account/user`, {
      headers: {
        Authorization: account,
        tenant: tenantId,
      },
    }).then((res) => res.json());

    if (userResponse?.statusCode === 401) {
      throw new Error("Commerce7 Error. Invalid authentication");
    }

    return {
      tenantId,
      account,
      user: userResponse,
    };
  }

  authorizeInstall(request: Request): boolean {
    const auth = request.headers.get("Authorization");
    if (!auth) {
      return false;
    }

    const base64 = auth.replace("Basic ", "");
    const [username, password] = Buffer.from(base64, "base64")
      .toString()
      .split(":");

    return (
      username === process.env.COMMERCE7_USER &&
      password === process.env.COMMERCE7_PASSWORD
    );
  }

  /**
   * Authorizes user access for embedded app usage
   * Verifies the account token with Commerce7 API
   */
  async authorizeUse(
    request: Request
  ): Promise<{ tenantId: string; user: any; adminUITheme?: string } | null> {
    const searchParams = new URL(request.url).searchParams;
    const tenantId = searchParams.get("tenantId");
    const account = searchParams.get("account");
    const adminUITheme = searchParams.get("adminUITheme");

    if (!tenantId || !account) {
      return null;
    }

    try {
      // Verify the account token with Commerce7 API
      const userResponse = await fetch(`${API_URL}/account/user`, {
        headers: {
          Authorization: account,
          tenant: tenantId,
        },
      });

      const userData = await userResponse.json();

      if (userData?.statusCode === 401) {
        console.error("Commerce7 authorization failed: Invalid account token");
        return null;
      }

      return {
        tenantId,
        user: userData,
        ...(adminUITheme && { adminUITheme }),
      };
    } catch (error) {
      console.error("Error authorizing Commerce7 user:", error);
      return null;
    }
  }

  async getCustomers(params?: any): Promise<CrmCustomer[]> {
    const { q = "", limit = 50 } = params || {};

    const response = await fetch(`${API_URL}/customer?q=${q}&limit=${limit}`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();
    handleC7ApiError(data, 'Get Customers');

    return data.customers.map((customer: C7CustomerResponse) => fromC7Customer(customer));
  }

  async getCustomersWithLTV(params?: any): Promise<CrmCustomer[]> {
    const customers = await this.getCustomers(params);
    
    // Calculate LTV for each customer using conversion function
    const customersWithLtv = await Promise.all(
      customers.map(async (customer) => {
        try {
          const orders = await this.getOrders({ customerId: customer.id });
          const ltv = calculateC7LTV(orders); // Uses conversion helper
          return { ...customer, ltv };
        } catch {
          return { ...customer, ltv: 0 };
        }
      })
    );
    
    return customersWithLtv;
  }

  async getCustomerWithLTV(id: string): Promise<CrmCustomer> {
    const customer = await this.getCustomer(id);
    
    try {
      const orders = await this.getOrders({ customerId: id });
      const ltv = calculateC7LTV(orders); // Uses conversion helper
      return { ...customer, ltv };
    } catch {
      return { ...customer, ltv: 0 };
    }
  }

  async getCustomer(id: string): Promise<CrmCustomer> {
    const response = await fetch(`${API_URL}/customer/${id}`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(
        `Error fetching Commerce7 customer: ${data.errors[0]?.message}`
      );
    }

    // Use the conversion function to properly handle C7 response
    const customer = fromC7Customer(data);
    
    return {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }

  async createCustomer(customer: Partial<CrmCustomer>): Promise<CrmCustomer> {
    const response = await fetch(`${API_URL}/customer/`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
      body: JSON.stringify(customer),
    });

    const data = await response.json();
    handleC7ApiError(data, 'Create Customer');

    return fromC7Customer(data);
  }

  /**
   * Create customer with billing address (Commerce7-specific)
   * Uses /customer-address endpoint which creates both in one atomic call
   */
  async createCustomerWithAddress(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address: CustomerAddress;
  }): Promise<{ customer: Customer; billingAddressId: string }> {
    const response = await fetch(`${API_URL}/customer-address`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
      body: JSON.stringify({
        firstName: data.firstName,
        lastName: data.lastName,
        address: data.address.address1,
        address2: data.address.address2,
        city: data.address.city,
        stateCode: data.address.state,
        zipCode: data.address.zip,
        countryCode: data.address.country || 'US',
        emails: [{ email: data.email }],
        phones: data.phone ? [{ phone: data.phone }] : [],
        orderInformation: {
          acquisitionChannel: "Inbound"
        }
      }),
    });

    const customerData = await response.json();
    handleC7ApiError(customerData, 'Create Customer with Address');

    return {
      customer: fromC7Customer(customerData),
      billingAddressId: customerData.id, // Per docs: first address ID = customer ID
    };
  }

  async updateCustomer(
    id: string,
    customer: Partial<CrmCustomer>
  ): Promise<CrmCustomer> {
    const response = await fetch(`${API_URL}/customer/${id}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
      body: JSON.stringify(customer),
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(
        `Error updating Commerce7 customer: ${data.errors[0]?.message}`
      );
    }

    return {
      id: data.id,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  async upsertCustomer(customer: Partial<CrmCustomer>): Promise<CrmCustomer> {
    // Try to find by email first
    if (customer.email) {
      const existing = await this.findCustomerByEmail(customer.email);
      if (existing) {
        return this.updateCustomer(existing.id, customer);
      }
    }
    
    // Otherwise create new
    return this.createCustomer(customer);
  }

  async findCustomerByEmail(email: string): Promise<CrmCustomer | null> {
    const response = await fetch(`${API_URL}/customer?q=${encodeURIComponent(email)}&limit=1`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();

    if (data.errors || !data.customers || data.customers.length === 0) {
      return null;
    }

    const customer = data.customers[0];
    return {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }

  async getProducts(params?: any): Promise<CrmProduct[]> {
    const { q = "", limit = 50 } = params || {};

    const response = await fetch(`${API_URL}/product?q=${q}&limit=${limit}`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(
        `Error fetching Commerce7 products: ${data.errors[0]?.message}`
      );
    }

    return data.products.map((product: any) => ({
      id: product.id,
      title: product.title,
      sku: product.sku,
      price: product.price,
      image: product.image,
      description: product.description,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }));
  }

  async getCollections(params?: any): Promise<CrmCollection[]> {
    const { q = "", limit = 50 } = params || {};

    const response = await fetch(`${API_URL}/collection?q=${q}&limit=${limit}`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();
  
    if (data.errors) {
      throw new Error(
        `Error fetching Commerce7 collections: ${data.errors[0]?.message}`
      );
    }

    return data.collections.map((collection: any) => ({
      id: collection.id,
      title: collection.title,
      image: collection.featuredImage,
      description: collection.content,
    }));
  }

  async getCollection(id: string): Promise<CrmCollection> {
    const response = await fetch(`${API_URL}/collection/${id}`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(
        `Error fetching Commerce7 collection: ${data.errors[0]?.message}`
      );
    }

    // C7 can return collection wrapped or directly
    const collection = data.collection || data;

    return {
      id: collection.id,
      title: collection.title,
      image: collection.featuredImage,
      description: collection.content,
    };
  }

  async getProduct(id: string): Promise<CrmProduct> {
    const response = await fetch(`${API_URL}/product/${id}`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(
        `Error fetching Commerce7 product: ${data.errors[0]?.message}`
      );
    }

    return {
      id: data.id,
      title: data.title,
      sku: data.sku,
      price: data.price,
      image: data.image,
      description: data.description,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  async getOrders(params?: any): Promise<CrmOrder[]> {
    const { q = "", limit = 50 } = params || {};

    const response = await fetch(`${API_URL}/order?q=${q}&limit=${limit}`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(
        `Error fetching Commerce7 orders: ${data.errors[0]?.message}`
      );
    }

    return data.orders.map((order: any) => ({
      id: order.id,
      customerId: order.customerId,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));
  }

  async getOrder(id: string): Promise<CrmOrder> {
    const response = await fetch(`${API_URL}/order/${id}`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(
        `Error fetching Commerce7 order: ${data.errors[0]?.message}`
      );
    }

    return {
      id: data.id,
      customerId: data.customerId,
      total: data.total,
      status: data.status,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  async getCoupons(params?: any): Promise<CrmDiscount[]> {
    const { q = "", limit = 50 } = params || {};

    const response = await fetch(`${API_URL}/coupon?q=${q}&limit=${limit}`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(
        `Error fetching Commerce7 discounts: ${data.errors[0]?.message}`
      );
    }

    return data.coupons.map((coupon: any) => ({
      id: coupon.id,
      code: coupon.code,
      type: coupon.type === "percentage" ? "percentage" : "fixed_amount",
      value: coupon.value,
      startsAt: coupon.startsAt,
      endsAt: coupon.endsAt,
      usageLimit: coupon.usageLimit,
      usageCount: coupon.usageCount,
      isActive: coupon.isActive,
    }));
  }

  async getCoupon(id: string): Promise<CrmDiscount> {
    const response = await fetch(`${API_URL}/coupon/${id}`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(
        `Error fetching Commerce7 discount: ${data.errors[0]?.message}`
      );
    }

    return {
      id: data.id,
      code: data.code,
      type: data.type === "percentage" ? "percentage" : "fixed_amount",
      value: data.value,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      usageLimit: data.usageLimit,
      usageCount: data.usageCount,
      isActive: data.isActive,
    };
  }

  /**
   * Get full C7 coupon data (for editing/loading into forms)
   * Returns the complete coupon payload with all fields
   */
  async getC7CouponFull(id: string): Promise<any> {
    const response = await fetch(`${API_URL}/coupon/${id}`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();
    handleC7ApiError(data, 'fetching coupon');

    // C7 wraps the coupon in a 'coupon' property or returns it directly
    return data.coupon || data;
  }

  async createCoupon(discount: Partial<CrmDiscount>): Promise<CrmDiscount> {
    throw new Error("Use createC7Coupon() method for creating Commerce7 coupons");
  }

  /**
   * Create a Commerce7 coupon with full control over all fields
   * Use this instead of createDiscount() for C7-specific coupon creation
   */
  async createC7Coupon(couponPayload: C7CouponPayload): Promise<{ id: string; code: string; title: string }> {
    const response = await fetch(`${API_URL}/coupon/`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
      body: JSON.stringify(couponPayload),
    });

    const data = await response.json();
    handleC7ApiError(data, 'creating coupon');

    // Return minimal response with the created coupon info
    return {
      id: data.coupon?.id || data.id,
      code: data.coupon?.code || data.code,
      title: data.coupon?.title || data.title,
    };
  }

  /**
   * Update an existing Commerce7 coupon
   * Note: You cannot change the code of an existing coupon
   */
  async updateC7Coupon(couponId: string, couponPayload: Partial<C7CouponPayload>): Promise<{ id: string; code: string; title: string }> {
    const response = await fetch(`${API_URL}/coupon/${couponId}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
      body: JSON.stringify(couponPayload),
    });

    const data = await response.json();
    handleC7ApiError(data, 'updating coupon');

    return {
      id: data.coupon?.id || data.id,
      code: data.coupon?.code || data.code,
      title: data.coupon?.title || data.title,
    };
  }

  /**
   * Delete a Commerce7 coupon
   */
  async deleteC7Coupon(couponId: string): Promise<boolean> {
    const response = await fetch(`${API_URL}/coupon/${couponId}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    if (response.status === 204) {
      console.info('Coupon deleted successfully');
      return true;
    }

    const data = await response.json();
    handleC7ApiError(data, 'deleting coupon');

    return true;
  }

  async updateCoupon(
    id: string,
    discount: Partial<CrmDiscount>
  ): Promise<CrmDiscount> {
    const response = await fetch(`${API_URL}/coupon/${id}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
      body: JSON.stringify(discount),
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(
        `Error updating Commerce7 discount: ${data.errors[0]?.message}`
      );
    }

    return {
      id: data.id,
      code: data.code,
      type: data.type === "percentage" ? "percentage" : "fixed_amount",
      value: data.value,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      usageLimit: data.usageLimit,
      usageCount: data.usageCount,
      isActive: data.isActive,
    };
  }

  async deleteCoupon(id: string): Promise<boolean> {
    const response = await fetch(`${API_URL}/coupon/${id}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    if (response.status === 204) {
      return true;
    }

    if (!response.ok) {
      throw new Error(
        `Error deleting Commerce7 discount: ${response.statusText}`
      );
    }

    return true;
  }

  // Webhook operations
  async validateWebhook(request: Request): Promise<boolean> {
    // Commerce7 webhook validation
    // Check if request is from Commerce7 using signature or IP whitelist
    const signature = request.headers.get("x-commerce7-signature");
    const tenantId = request.headers.get("x-commerce7-tenant");

    if (!signature || !tenantId) {
      console.warn("Commerce7 webhook missing required headers");
      return false;
    }

    // TODO: Implement signature validation if Commerce7 provides one
    // For now, we'll validate the basic headers are present

    const secret = process.env.COMMERCE7_WEBHOOK_SECRET;
    if (secret) {
      try {
        const body = await request.text();
        const expectedSignature = crypto
          .createHmac("sha256", secret)
          .update(body, "utf8")
          .digest("hex");

        return signature === expectedSignature;
      } catch (error) {
        console.error("Commerce7 webhook validation error:", error);
        return false;
      }
    }

    // If no secret is configured, just validate headers are present
    return true;
  }

  async processWebhook(payload: WebhookPayload): Promise<void> {
    console.log(`Processing Commerce7 webhook: ${payload.topic}`, payload.data);

    // TODO: Implement webhook processing logic based on topic
    // This is where you would sync data to your database

    switch (payload.topic) {
      case "customers/create":
        console.log("New customer created:", payload.data.id);
        // TODO: Store customer in Supabase
        break;

      case "customers/update":
        console.log("Customer updated:", payload.data.id);
        // TODO: Update customer in Supabase
        break;

      case "orders/create":
        console.log("New order created:", payload.data.id);
        // TODO: Store order in Supabase
        break;

      case "orders/update":
        console.log("Order updated:", payload.data.id);
        // TODO: Update order in Supabase
        break;

      case "products/create":
        console.log("New product created:", payload.data.id);
        // TODO: Store product in Supabase
        break;

      case "products/update":
        console.log("Product updated:", payload.data.id);
        // TODO: Update product in Supabase
        break;

      default:
        console.log("Unhandled webhook topic:", payload.topic);
    }
  }

  async registerWebhook(
    topic: WebhookTopic,
    address: string
  ): Promise<WebhookRegistration> {
    // Commerce7 webhook registration
    const response = await fetch(`${API_URL}/webhook`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
      body: JSON.stringify({
        topic,
        url: address,
        isActive: true,
      }),
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(
        `Error registering Commerce7 webhook: ${data.errors[0]?.message}`
      );
    }

    return {
      id: data.id,
      topic,
      address,
      createdAt: data.createdAt,
    };
  }

  async listWebhooks(): Promise<WebhookRegistration[]> {
    const response = await fetch(`${API_URL}/webhook`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(
        `Error listing Commerce7 webhooks: ${data.errors[0]?.message}`
      );
    }

    return (data.webhooks || []).map((webhook: any) => ({
      id: webhook.id,
      topic: webhook.topic as WebhookTopic,
      address: webhook.url,
      createdAt: webhook.createdAt,
    }));
  }

  async deleteWebhook(id: string): Promise<boolean> {
    const response = await fetch(`${API_URL}/webhook/${id}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    if (response.status === 204) {
      return true;
    }

    if (!response.ok) {
      throw new Error(
        `Error deleting Commerce7 webhook: ${response.statusText}`
      );
    }

    return true;
  }

  // Tier membership management
  async addTierMembership(stageId: string, clubId: string | null, customerId: string): Promise<void> {
    // TODO: Implement Commerce7 tier membership assignment
    // This adds a customer to a Commerce7 club (membership is created via createClubMembership in enrollment flow)
    // For sync queue retries, we may need to recreate membership if it was lost
    if (!clubId) {
      throw new Error("Commerce7 clubId is required for addTierMembership");
    }
    throw new Error("addTierMembership not implemented yet for Commerce7");
  }

  async cancelTierMembership(stageId: string, clubId: string | null, customerId: string, membershipId?: string | null): Promise<void> {
    // Cancel Commerce7 club membership by setting cancelDate
    // This sets the membership status to 'Cancelled' and disables promotions
    
    let targetMembershipId: string;
    
    // If membershipId is provided, use it directly
    if (membershipId) {
      targetMembershipId = membershipId;
    } else if (clubId) {
      // Look up membership by customer and club
      const memberships = await this.getCustomerClubMemberships(customerId);
      const membership = memberships.find((m: any) => m.clubId === clubId);
      
      if (!membership || !membership.id) {
        throw new Error(`No active membership found for customer ${customerId} in club ${clubId}`);
      }
      
      targetMembershipId = membership.id;
    } else {
      throw new Error("Commerce7 clubId or membershipId is required for cancelTierMembership");
    }
    
    // Update membership to set cancelDate (cancels membership)
    const response = await fetch(`${API_URL}/club-membership/${targetMembershipId}`, {
      method: 'PUT',
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
      body: JSON.stringify({
        cancelDate: new Date().toISOString(),
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      handleC7ApiError(errorData, 'Cancel Club Membership');
      throw new Error(`Failed to cancel membership: ${response.statusText}`);
    }
    
    // Membership cancelled successfully
    // Status will be set to 'Cancelled' and promotions will be disabled automatically
  }

  async getCouponCustomers(couponId: string): Promise<string[]> {
    // TODO: Implement Commerce7 coupon customer list
    throw new Error("getCouponCustomers not implemented yet for Commerce7");
  }

  // Tag operations
  /**
   * Search for customer tags in Commerce7
   * Used for segmenting customers in coupons
   */
  /**
   * @deprecated Tags are being replaced by C7 Clubs for tier membership.
   * Use createClub() and ClubMembership instead.
   * This method will be removed in a future version.
   */
  async searchCustomerTags(params?: { q?: string; limit?: number }): Promise<C7Tag[]> {
    const { q = "", limit = 50 } = params || {};

    const queryParams = new URLSearchParams();
    if (q) queryParams.append("q", q);
    queryParams.append("limit", limit.toString());

    const response = await fetch(`${API_URL}/tag/customer?${queryParams.toString()}`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();
    handleC7ApiError(data, 'searching customer tags');

    return (data.tags || []).map((tag: any) => ({
      id: tag.id,
      title: tag.title,
      type: tag.type,
      objectType: tag.objectType,
    }));
  }

  /**
   * Get a specific tag by ID
   */
  /**
   * @deprecated Tags are being replaced by C7 Clubs for tier membership.
   * Use getClub() instead.
   * This method will be removed in a future version.
   */
  async getTag(id: string): Promise<C7Tag> {
    const response = await fetch(`${API_URL}/tag/${id}`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();
    handleC7ApiError(data, 'fetching tag');

    return {
      id: data.id,
      title: data.title,
      type: data.type,
      objectType: data.objectType,
    };
  }

  /**
   * Create a new customer tag
   * @param title - The name of the tag
   * @param type - "Manual" or "Dynamic"
   */
  /**
   * @deprecated Tags are being replaced by C7 Clubs for tier membership.
   * Use createClub() to create a tier, then use ClubMembership to assign customers.
   * This method will be removed in a future version.
   */
  async createCustomerTag(title: string, type: "Manual" | "Dynamic" = "Manual"): Promise<C7Tag> {
    const response = await fetch(`${API_URL}/tag/customer`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
      body: JSON.stringify({
        title,
        type,
      }),
    });

    const data = await response.json();
    handleC7ApiError(data, 'creating customer tag');

    return {
      id: data.id,
      title: data.title,
      type: data.type,
      objectType: C7TagObjectType.CUSTOMER,
    };
  }

  /**
   * Delete a tag
   * @param tagId - The tag's ID
   */
  /**
   * @deprecated Tags are being replaced by C7 Clubs for tier membership.
   * Use deleteClub() instead.
   * This method will be removed in a future version.
   */
  async deleteTag(tagId: string): Promise<void> {
    const response = await fetch(`${API_URL}/tag/${tagId}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    if (response.status === 204) {
      console.info('Tag deleted successfully');
      return;
    }

    const data = await response.json();
    handleC7ApiError(data, 'deleting tag');
  }

  /**
   * Add a tag to a customer
   * @param customerId - The customer's ID
   * @param tagId - The tag's ID
   */
  async tagCustomer(customerId: string, tagId: string): Promise<void> {
    const response = await fetch(`${API_URL}/customer/${customerId}/tag/${tagId}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();
    handleC7ApiError(data, 'tagging customer');
  }

  /**
   * Remove a tag from a customer
   * @param customerId - The customer's ID
   * @param tagId - The tag's ID
   */
  async untagCustomer(customerId: string, tagId: string): Promise<void> {
    const response = await fetch(`${API_URL}/customer/${customerId}/tag/${tagId}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();
    handleC7ApiError(data, 'removing tag from customer');
  }

  /**
   * Get all tags for a customer
   * @param customerId - The customer's ID
   */
  /**
   * @deprecated Tags are being replaced by C7 Clubs for tier membership.
   * Use customer.clubs array from getCustomer() to see which clubs a customer belongs to.
   * This method will be removed in a future version.
   */
  async getCustomerTags(customerId: string): Promise<C7Tag[]> {
    const response = await fetch(`${API_URL}/customer/${customerId}/tag`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();
    handleC7ApiError(data, 'fetching customer tags');

    return (data.tags || []).map((tag: any) => ({
      id: tag.id,
      title: tag.title,
      type: tag.type,
      objectType: tag.objectType,
    }));
  }

  // ============================================
  // CLUB (TIER) METHODS
  // ============================================
  // C7 Clubs represent LiberoVino tiers
  // Each tier (Bronze, Silver, Gold) gets its own C7 Club

  /**
   * Create a club (tier) on Commerce7
   * @param data - Club creation data
   */
  async createClub(data: C7ClubCreateRequest): Promise<C7Club> {
    const response = await fetch(`${API_URL}/club`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    handleC7ApiError(result, 'creating club');

    return result;
  }

  /**
   * Get a club by ID
   * @param clubId - The club's ID
   */
  async getClub(clubId: string): Promise<C7Club> {
    const response = await fetch(`${API_URL}/club/${clubId}`, {
      headers: {
        Accept: "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const result = await response.json();
    handleC7ApiError(result, 'fetching club');

    return result;
  }

  /**
   * Update a club
   * @param clubId - The club's ID
   * @param data - Club update data
   */
  async updateClub(
    clubId: string, 
    data: Partial<C7ClubCreateRequest>
  ): Promise<C7Club> {
    const response = await fetch(`${API_URL}/club/${clubId}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    handleC7ApiError(result, 'updating club');

    return result;
  }

  /**
   * Idempotent upsert club (create or update)
   * Implements CrmProvider interface - abstraction for tier/club sync
   * @param tier - Tier data with optional c7ClubId
   * @returns The CRM club ID
   */
  async upsertClub(tier: { 
    id: string; 
    name: string; 
    c7ClubId?: string | null 
  }): Promise<{ crmClubId: string }> {
    if (tier.c7ClubId) {
      // Update existing club (type field is immutable, exclude it)
      await this.updateClub(tier.c7ClubId, {
        title: tier.name,
        slug: tier.name.toLowerCase().replace(/\s+/g, '-'),
        seo: { title: tier.name },
        webStatus: "Not Available" as const,
        adminStatus: "Not Available" as const,
      });
      return { crmClubId: tier.c7ClubId };
    } else {
      // Create new club (type is required for creation)
      const club = await this.createClub({
        title: tier.name,
        slug: tier.name.toLowerCase().replace(/\s+/g, '-'),
        type: "Traditional" as const,
        seo: { title: tier.name },
        webStatus: "Not Available" as const,
        adminStatus: "Not Available" as const,
      });
      return { crmClubId: club.id };
    }
  }

  /**
   * Delete a club
   * @param clubId - The club's ID
   */
  async deleteClub(clubId: string): Promise<void> {
    const response = await fetch(`${API_URL}/club/${clubId}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    if (response.status === 204) {
      console.info('Club deleted successfully');
      return;
    }

    const result = await response.json();
    handleC7ApiError(result, 'deleting club');
  }

  /**
   * List all clubs
   */
  async listClubs(): Promise<C7Club[]> {
    const response = await fetch(`${API_URL}/club`, {
      headers: {
        Accept: "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const result = await response.json();
    handleC7ApiError(result, 'listing clubs');

    return result.data || [];
  }

  // ============================================
  // PROMOTION METHODS
  // ============================================
  // Promotions auto-apply discounts (unlike coupons)
  // Linked to clubs for tier-specific discounts

  /**
   * Create a promotion
   * @param data - Promotion creation data
   */
  async createPromotion(
    data: C7PromotionCreateRequest
  ): Promise<C7Promotion> {
    console.log('############# createPromotion', data);
    const response = await fetch(`${API_URL}/promotion`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    handleC7ApiError(result, 'creating promotion');

    return result;
  }

  /**
   * Get a promotion by ID
   * @param promotionId - The promotion's ID
   */
  async getPromotion(promotionId: string): Promise<C7Promotion> {
    const response = await fetch(`${API_URL}/promotion/${promotionId}`, {
      headers: {
        Accept: "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const result = await response.json();
    handleC7ApiError(result, 'fetching promotion');

    return result;
  }

  /**
   * Update a promotion
   * @param promotionId - The promotion's ID
   * @param data - Promotion update data
   */
  async updatePromotion(
    promotionId: string,
    data: Partial<C7PromotionCreateRequest>
  ): Promise<C7Promotion> {
    const response = await fetch(`${API_URL}/promotion/${promotionId}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    handleC7ApiError(result, 'updating promotion');

    return result;
  }

  /**
   * Delete a promotion
   * @param promotionId - The promotion's ID
   */
  async deletePromotion(promotionId: string): Promise<void> {
    const response = await fetch(`${API_URL}/promotion/${promotionId}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    if(response.status === 204) {
      console.info('Promotion deleted successfully');
      return;
    }

    const result = await response.json();
    handleC7ApiError(result, 'deleting promotion');
  }

  /**
   * List all promotions
   */
  async listPromotions(): Promise<C7Promotion[]> {
    const response = await fetch(`${API_URL}/promotion`, {
      headers: {
        Accept: "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const result = await response.json();
    handleC7ApiError(result, 'listing promotions');

    return result.data || [];
  }

  // ============================================
  // PROMOTION SET METHODS
  // ============================================
  // Promotion Sets group multiple promotions to apply together
  // Without a set, only the highest value discount applies

  /**
   * Create a promotion set
   * Used when tier has multiple promotions (e.g., 20% off + free shipping)
   * @param data - Promotion set creation data
   */
  async createPromotionSet(
    data: C7PromotionSetCreateRequest
  ): Promise<C7PromotionSet> {
    const response = await fetch(`${API_URL}/promo-set`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    handleC7ApiError(result, 'creating promotion set');

    return result;
  }

  /**
   * Get a promotion set by ID
   * @param setId - The promotion set's ID
   */
  async getPromotionSet(setId: string): Promise<C7PromotionSet> {
    const response = await fetch(`${API_URL}/promo-set/${setId}`, {
      headers: {
        Accept: "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const result = await response.json();
    handleC7ApiError(result, 'fetching promotion set');

    return result;
  }

  /**
   * Delete a promotion set
   * @param setId - The promotion set's ID
   */
  async deletePromotionSet(setId: string): Promise<void> {
    const response = await fetch(`${API_URL}/promo-set/${setId}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    if (response.status === 204) {
      console.info('Promotion set deleted successfully');
      return;
    }

    const result = await response.json();
    handleC7ApiError(result, 'deleting promotion set');
  }

  // ============================================
  // LOYALTY TIER METHODS
  // ============================================
  // Loyalty is an EXTENSION - must be activated by tenant
  // Each club tier can optionally have loyalty earning


  /**
   * Create a loyalty tier
   * NOTE: Loyalty extension must be enabled by tenant first
   * @param data - Loyalty tier creation data
   */
  async createLoyaltyTier(
    data: C7LoyaltyTierCreateRequest
  ): Promise<C7LoyaltyTier> {
    const response = await fetch("https://api.commerce7.com/v1/loyalty-tier", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    handleC7ApiError(result, 'creating loyalty tier');

    return result;
  }

  /**
   * Get a loyalty tier by ID
   * @param loyaltyTierId - The loyalty tier's ID
   */
  async getLoyaltyTier(loyaltyTierId: string): Promise<C7LoyaltyTier> {
    const response = await fetch(`https://api.commerce7.com/v1/loyalty-tier/${loyaltyTierId}`, {
      headers: {
        Accept: "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const result = await response.json();
    handleC7ApiError(result, 'fetching loyalty tier');

    return result;
  }

  /**
   * Update a loyalty tier
   * @param loyaltyTierId - The loyalty tier's ID
   * @param data - Loyalty tier update data
   */
  async updateLoyaltyTier(
    loyaltyTierId: string,
    data: Partial<C7LoyaltyTierCreateRequest>
  ): Promise<C7LoyaltyTier> {
    const response = await fetch(`https://api.commerce7.com/v1/loyalty-tier/${loyaltyTierId}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    handleC7ApiError(result, 'updating loyalty tier');

    return result;
  }

  /**
   * Delete a loyalty tier
   * @param loyaltyTierId - The loyalty tier's ID
   */
  async deleteLoyaltyTier(loyaltyTierId: string): Promise<void> {
    const response = await fetch(`https://api.commerce7.com/v1/loyalty-tier/${loyaltyTierId}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    if (response.status === 204) {
      console.info('Loyalty tier deleted successfully');
      return;
    }

    const result = await response.json();
    handleC7ApiError(result, 'deleting loyalty tier');
  }

  /**
   * List all loyalty tiers
   */
  async listLoyaltyTiers(): Promise<C7LoyaltyTier[]> {
    const response = await fetch("https://api.commerce7.com/v1/loyalty-tier", {
      headers: {
        Accept: "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const result = await response.json();
    handleC7ApiError(result, 'listing loyalty tiers');

    return result.data || [];
  }

  // ============================================
  // LOYALTY TRANSACTION METHODS
  // ============================================
  // For manual point adjustments (bonus points, etc.)

  /**
   * Add or remove loyalty points for a customer
   * @param data - Transaction data (positive = add, negative = remove)
   */
  async addLoyaltyPoints(
    data: C7LoyaltyTransactionCreateRequest
  ): Promise<C7LoyaltyTransaction> {
    const response = await fetch("https://api.commerce7.com/v1/loyalty-transaction", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    handleC7ApiError(result, 'adding loyalty points');

    return result;
  }

  // ============================================
  // ORCHESTRATION METHODS
  // High-level business logic for tier creation
  // ============================================

  /**
   * Creates multiple promotions with a promotion set (if more than 1)
   * Handles the complex promotion set creation flow
   */
  async createPromotionsWithSet(
    promotions: Array<{
      title: string;
      productDiscountType?: string;
      productDiscount?: number;
      shippingDiscountType?: string;
      shippingDiscount?: number;
      appliesTo?: string;
      appliesToObjectIds?: string[];
      minimumCartAmount?: number;
    }>,
    clubId: string
  ): Promise<Array<{ id: string; title: string }>> {
    if (promotions.length === 0) {
      return [];
    }

    const createdPromotions: Array<{ id: string; title: string }> = [];
    let promotionSetId: string | null = null;

    try {
      // Create first promotion (no set yet)
      const firstPromo = promotions[0];
      
      // Determine promotion type (Product or Shipping)
      const isProductPromo = firstPromo.productDiscountType && firstPromo.productDiscountType !== "No Discount";
      const promoType = isProductPromo ? "Product" : "Shipping";
      const discountType = isProductPromo ? firstPromo.productDiscountType : firstPromo.shippingDiscountType;
      const discountAmount = isProductPromo ? firstPromo.productDiscount : firstPromo.shippingDiscount;
      
      const promoPayload: any = {
        title: firstPromo.title,
        actionMessage: "",
        type: promoType,                         // "Product" or "Shipping"
        discountType: discountType as string,   // "Percentage Off" | "Dollar Off"
        discount: discountType === "Percentage Off" ?
          (discountAmount || 0) * 100 :         // 10% → 1000 basis points
          (discountAmount || 0),                 // $10 → 10 dollars
        dollarOffDiscountApplies: "Once Per Order",
        appliesTo: firstPromo.appliesTo || "Store",
        appliesToObjectIds: firstPromo.appliesToObjectIds || [],  // Empty array = all products
        excludes: null,
        excludeObjectIds: [],
        cartRequirementType: "None",
        cartRequirement: null,
        cartRequirementMaximum: null,
        cartRequirementCountType: "All Items",
        usageLimitType: "Unlimited",
        usageLimit: null,
        status: "Enabled",
        availableTo: "Club",
        availableToObjectIds: [clubId],
        clubFrequencies: [],
        promotionSets: [],
        startDate: new Date().toISOString(),
        endDate: null,
      };
      
      // Add minimum cart requirement if specified
      if (firstPromo.minimumCartAmount) {
        promoPayload.cartRequirementType = "Minimum Amount";
        promoPayload.cartRequirement = firstPromo.minimumCartAmount * 100; // Convert to cents
      }
      
      console.log('Creating C7 promotion with payload:', JSON.stringify(promoPayload, null, 2));
      const firstPromotion = await this.createPromotion(promoPayload as C7PromotionCreateRequest);

      createdPromotions.push({
        id: firstPromotion.id,
        title: firstPromotion.title,
      });

      // If we have more promotions, create a set and link them
      if (promotions.length > 1) {
        // Create promotion set
        const promotionSet = await this.createPromotionSet({
          title: `${firstPromo.title} Benefits`,
        });
        promotionSetId = promotionSet.id;

        // Update first promotion with set
        await this.updatePromotion(firstPromotion.id, {
          promotionSets: [promotionSetId],
        } as any);

        // Create remaining promotions with set
        for (let i = 1; i < promotions.length; i++) {
          const promo = promotions[i];
          try {
            // Determine promotion type (Product or Shipping)
            const isProductPromo = promo.productDiscountType && promo.productDiscountType !== "No Discount";
            const promoType = isProductPromo ? "Product" : "Shipping";
            const discountType = isProductPromo ? promo.productDiscountType : promo.shippingDiscountType;
            const discountAmount = isProductPromo ? promo.productDiscount : promo.shippingDiscount;
            
            const promoPayload: any = {
              title: promo.title,
              actionMessage: "",
              type: promoType,
              discountType: discountType as string,
              discount: discountType === "Percentage Off" ?
                (discountAmount || 0) * 100 :
                (discountAmount || 0),
              dollarOffDiscountApplies: "Once Per Order",
              appliesTo: promo.appliesTo || "Store",
              appliesToObjectIds: promo.appliesToObjectIds || [],
              excludes: null,
              excludeObjectIds: [],
              cartRequirementType: "None",
              cartRequirement: null,
              cartRequirementMaximum: null,
              cartRequirementCountType: "All Items",
              usageLimitType: "Unlimited",
              usageLimit: null,
              status: "Enabled",
              availableTo: "Club",
              availableToObjectIds: [clubId],
              clubFrequencies: [],
              promotionSets: [promotionSetId], // Include set!
              startDate: new Date().toISOString(),
              endDate: null,
            };
            
            // Add minimum cart requirement if specified
            if (promo.minimumCartAmount) {
              promoPayload.cartRequirementType = "Minimum Amount";
              promoPayload.cartRequirement = promo.minimumCartAmount * 100;
            }
            
            console.log(`Creating C7 promotion ${i + 1} with payload:`, JSON.stringify(promoPayload, null, 2));
            const promotion = await this.createPromotion(promoPayload);

            createdPromotions.push({
              id: promotion.id,
              title: promotion.title,
            });
          } catch (error) {
            console.warn(`Failed to create promotion ${i + 1}:`, error);
            // Continue with other promotions (graceful degradation)
          }
        }
      }

      return createdPromotions;
    } catch (error) {
      // Rollback: Delete created promotions
      for (const promo of createdPromotions) {
        try {
          await this.deletePromotion(promo.id);
        } catch (deleteError) {
          console.warn(`Failed to delete promotion ${promo.id}:`, deleteError);
        }
      }

      // Delete promotion set if created
      if (promotionSetId) {
        try {
          await this.deletePromotionSet(promotionSetId);
        } catch (deleteError) {
          console.warn(`Failed to delete promotion set ${promotionSetId}:`, deleteError);
        }
      }

      throw new Error(`Failed to create promotions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Creates a complete tier with club, promotions, and optional loyalty
   * Implements the atomic creation flow with rollback
   */
  async createTierWithPromotionsAndLoyalty(
    tierData: {
      name: string;
      description?: string;
      durationMonths: number;
      minPurchaseAmount: number;
      promotions: Array<{
        title: string;
        productDiscountType?: string;
        productDiscount?: number;
        shippingDiscountType?: string;
        shippingDiscount?: number;
        minimumCartAmount?: number;
      }>;
      loyalty?: {
        enabled: boolean;
        earnRate: number; // e.g., 0.02 = 2%
        initialPointsBonus?: number;
      };
    }
  ): Promise<{
    clubId: string;
    promotionIds: string[];
    loyaltyTierId?: string;
  }> {
    let clubId: string | null = null;
    let loyaltyTierId: string | null = null;
    const createdPromotionIds: string[] = [];

    try {
      // 1. Create C7 Club
      const club = await this.createClub({
        title: tierData.name,
        slug: tierData.name.toLowerCase().replace(/\s+/g, '-'),
        type: "Traditional",
        seo: { title: tierData.name },
        webStatus: "Not Available", // Hidden from customers
        adminStatus: "Not Available", // Hidden from C7 admin
      });
      clubId = club.id;

      // 2. Create Promotions (with promotion set if multiple)
      const promotions = await this.createPromotionsWithSet(
        tierData.promotions,
        clubId
      );
      createdPromotionIds.push(...promotions.map(p => p.id));

      // 3. Create Loyalty Tier (if enabled)
      if (tierData.loyalty?.enabled) {
        const loyaltyTier = await this.createLoyaltyTier({
          title: `${tierData.name} Rewards`,
          qualificationType: "Club",
          clubsToQualify: [{ id: clubId }],
          earnRate: tierData.loyalty.earnRate,
          sortOrder: 0, // Will be updated based on tier order
        });
        loyaltyTierId = loyaltyTier.id;
      }

      return {
        clubId,
        promotionIds: createdPromotionIds,
        loyaltyTierId: loyaltyTierId || undefined,
      };
    } catch (error) {
      // Rollback: Clean up everything we created
      await this.rollbackTierCreation({
        clubId,
        promotionIds: createdPromotionIds,
        loyaltyTierId,
      });

      throw new Error(`Failed to create tier "${tierData.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Rollback tier creation - cleans up C7 resources
   * Used when tier creation fails partway through
   */
  async rollbackTierCreation(created: {
    clubId: string | null;
    promotionIds: string[];
    loyaltyTierId: string | null;
  }): Promise<void> {
    const errors: string[] = [];

    // Delete loyalty tier first (if exists)
    if (created.loyaltyTierId) {
      try {
        await this.deleteLoyaltyTier(created.loyaltyTierId);
      } catch (error) {
        errors.push(`Failed to delete loyalty tier: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Delete promotions
    for (const promotionId of created.promotionIds) {
      try {
        await this.deletePromotion(promotionId);
      } catch (error) {
        errors.push(`Failed to delete promotion ${promotionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Delete club last
    if (created.clubId) {
      try {
        await this.deleteClub(created.clubId);
      } catch (error) {
        errors.push(`Failed to delete club: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (errors.length > 0) {
      console.warn('Rollback completed with errors:', errors);
    }
  }

  /**
   * Preload bonus points for a customer when they join a premium tier
   * Called after club membership is created
   */
  async preloadTierBonusPoints(
    customerId: string,
    points: number,
    tierName: string
  ): Promise<void> {
    if (points <= 0) {
      return; // No bonus points to add
    }

    try {
      await this.addLoyaltyPoints({
        customerId,
        amount: points,
        notes: `${tierName} Tier Welcome Bonus`,
      });
    } catch (error) {
      // Don't fail the entire enrollment if bonus points fail
      console.warn(`Failed to add bonus points for customer ${customerId}:`, error);
      throw new Error(`Failed to add welcome bonus points: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================
  // CUSTOMER ADDRESS METHODS
  // ============================================

  /**
   * Get addresses for a customer
   */
  async getCustomerAddresses(customerId: string): Promise<CustomerAddress[]> {
    const response = await fetch(`${API_URL}/customer/${customerId}/address`, {
      method: 'GET',
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();
    handleC7ApiError(data, 'Get Customer Addresses');
    
    // C7 returns customerAddresses, not addresses
    const addresses = (data.customerAddresses || []).map((addr: C7AddressResponse) => fromC7Address(addr));
    return addresses;
  }

  /**
   * Create a new address for a customer
   */
  async createCustomerAddress(customerId: string, address: CustomerAddress): Promise<CustomerAddress> {
    const c7Address = toC7Address(address); // Convert to C7 format
    
    const response = await fetch(`${API_URL}/customer/${customerId}/address`, {
      method: 'POST',
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
      body: JSON.stringify(c7Address),
    });

    const data = await response.json();
    handleC7ApiError(data, 'Create Customer Address');
    
    return fromC7Address(data.address); // Convert back to unified format
  }

  // ============================================
  // CUSTOMER PAYMENT METHODS
  // ============================================

  /**
   * Get credit cards for a customer
   */
  async getCustomerCreditCards(customerId: string): Promise<CustomerPayment[]> {
    const response = await fetch(`${API_URL}/customer/${customerId}/credit-card`, {
      method: 'GET',
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();
    handleC7ApiError(data, 'Get Customer Credit Cards');
    
    // C7 returns customerCreditCards, not creditCards
    return (data.customerCreditCards || data.creditCards || []).map((card: C7CreditCardResponse) => fromC7Payment(card));
  }

  /**
   * Create a credit card for a customer
   * Note: In production, this should be done via a secure tokenization service
   * This is here for testing/development purposes
   */
  async createCustomerCreditCard(customerId: string, card: {
    cardholderName: string;
    cardNumber: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
    isDefault?: boolean;
  }): Promise<CustomerPayment> {
    const response = await fetch(`${API_URL}/customer/${customerId}/credit-card`, {
      method: 'POST',
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
      body: JSON.stringify({
        cardHolderName: card.cardholderName,
        // Note: C7 handles tokenization - in production we'd send token, not raw card data
        cardNumber: card.cardNumber.replace(/\D/g, ''), // Strip non-numeric characters (spaces, dashes, etc.)
        expiryMo: parseInt(card.expiryMonth),
        expiryYr: parseInt(card.expiryYear),
        cvv2: card.cvv, // C7 uses cvv2 field name
        isDefault: card.isDefault !== false, // Default to true
      }),
    });

    const data = await response.json();
    handleC7ApiError(data, 'Create Customer Credit Card');
    
    return fromC7Payment(data);
  }

  // ============================================
  // CLUB MEMBERSHIP METHODS
  // ============================================

  /**
   * Create a club membership for a customer
   * Uses the /club-membership endpoint (not /club/{id}/member)
   */
  async createClubMembership(data: {
    customerId: string;
    clubId: string;
    billingAddressId: string;
    shippingAddressId: string;
    paymentMethodId: string;
    startDate: string;
  }): Promise<{ id: string; status: string }> {
    const payload = toC7ClubMembership(data); // Convert using type helper
    
    const response = await fetch(`${API_URL}/club-membership`, {
      method: 'POST',
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();
    handleC7ApiError(responseData, 'Create Club Membership');
    
    return {
      id: responseData.id,
      status: responseData.status,
    };
  }

  /**
   * Get club memberships for a customer
   */
  async getCustomerClubMemberships(customerId: string): Promise<any[]> {
    const response = await fetch(`${API_URL}/customer/${customerId}/club`, {
      method: 'GET',
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();
    handleC7ApiError(data, 'Get Customer Club Memberships');
    
    return data.clubs || [];
  }

  /**
   * Get members of a specific club
   */
  async getClubMembers(clubId: string): Promise<any[]> {
    const response = await fetch(`${API_URL}/club/${clubId}/member`, {
      method: 'GET',
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();
    handleC7ApiError(data, 'Get Club Members');
    
    return data.members || [];
  }

}
