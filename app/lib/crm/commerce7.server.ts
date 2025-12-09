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
import * as db from "~/lib/db/supabase.server";
import type { C7ClubMembershipResponse } from "~/types/member-commerce7";
import { sendExpirationNotification, sendUpgradeNotification } from "~/lib/communication/membership-communications.server";

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

  /**
   * Calculate annualized LTV (LTV per year as customer)
   * Used for tier qualification checks where min_ltv_amount is involved
   * @param ltv - Total lifetime value in dollars
   * @param customerCreatedAt - Customer creation date (from CRM)
   * @returns Annualized LTV (LTV / years_as_customer, minimum 1 year)
   */
  calculateAnnualizedLTV(ltv: number, customerCreatedAt: Date | string): number {
    const createdDate = typeof customerCreatedAt === 'string' 
      ? new Date(customerCreatedAt) 
      : customerCreatedAt;
    
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdDate.getTime());
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    const yearsAsCustomer = diffDays / 365.25; // Account for leap years
    
    // Use minimum of 1 year to avoid division by very small numbers
    const effectiveYears = Math.max(1, yearsAsCustomer);
    
    return ltv / effectiveYears;
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
  async validateWebhook(request: Request, bodyText?: string): Promise<boolean> {
    // Commerce7 webhook validation
    // Note: Basic Auth is not available from Commerce7 webhooks
    // Security is handled in the webhook endpoint via:
    // - Tenant validation (verifies tenant exists in database)
    // - Self-triggered blocking (prevents loops)
    // - Payload/topic validation
    
    // TODO: Implement signature validation if Commerce7 provides documentation
    // If a secret is configured and Commerce7 provides signature headers, validate here
    const secret = process.env.COMMERCE7_WEBHOOK_SECRET;
    if (secret && bodyText) {
      // TODO: Check Commerce7 docs for signature header name and validation method
      // This is a placeholder for when we know how Commerce7 signs webhooks
      try {
        // Example signature validation (update when we know Commerce7's method):
        // const signature = request.headers.get("x-commerce7-signature");
        // if (signature) {
        //   const expectedSignature = crypto
        //     .createHmac("sha256", secret)
        //     .update(bodyText, "utf8")
        //     .digest("hex");
        //   return signature === expectedSignature;
        // }
      } catch (error) {
        console.error("Commerce7 webhook validation error:", error);
        return false;
      }
    }

    // Validation is handled in webhook endpoint
    return true;
  }

  async processWebhook(payload: WebhookPayload): Promise<void> {
    console.log(`Processing Commerce7 webhook: ${payload.topic}`, payload.data);

    if (!payload.tenant) {
      console.error('Missing tenant in webhook payload');
      throw new Error('Missing tenant information');
    }

    // Get client by tenant identifier
    const client = await db.getClientbyCrmIdentifier('commerce7', payload.tenant);
    if (!client) {
      console.error(`Client not found for tenant: ${payload.tenant}`);
      throw new Error(`Client not found for tenant: ${payload.tenant}`);
    }

    try {
      switch (payload.topic) {
        case "customers/update":
          await this.handleCustomerUpdate(payload.data, client.id);
          break;

        case "club/update":
          await this.handleClubUpdate(payload.data, client.id);
          break;

        case "club/delete":
          await this.handleClubDelete(payload.data, client.id);
          break;

        case "club-membership/create":
          await this.handleClubMembershipCreate(payload.data, client.id);
          break;

        case "club-membership/update":
          await this.handleClubMembershipUpdate(payload.data, client.id);
          break;

        case "club-membership/delete":
          await this.handleClubMembershipDelete(payload.data, client.id);
          break;

        default:
          console.log("Unhandled webhook topic:", payload.topic);
      }
    } catch (error) {
      console.error(`Error processing webhook ${payload.topic}:`, error);
      throw error;
    }
  }

  /**
   * Handle customer/update webhook
   * - Update customer record
   * - Note: Commerce7 sends customer/update webhooks when club membership changes,
   *   but we already handle those in club-membership webhooks. Only update if
   *   actual customer data (name, email, phone) changed.
   */
  private async handleCustomerUpdate(customerData: any, clientId: string): Promise<void> {
    try {
      const crmCustomerId = customerData.id;
      if (!crmCustomerId) {
        console.error('Missing customer ID in customer/update webhook');
        return;
      }

      // Find customer
      const customer = await db.getCustomerByCrmId(clientId, crmCustomerId);
      if (!customer) {
        console.log(`Customer ${crmCustomerId} not found, skipping update`);
        return;
      }

      // Convert C7 customer data
      const c7Customer = fromC7Customer(customerData);
      
      // Check if any actual customer data changed (not just club membership status)
      const hasChanges = 
        c7Customer.email !== customer.email ||
        c7Customer.firstName !== customer.first_name ||
        c7Customer.lastName !== customer.last_name ||
        c7Customer.phone !== customer.phone;
      
      // Update customer if data changed
      if (hasChanges) {
        const supabase = db.getSupabaseClient();
        await supabase
          .from('customers')
          .update({
            email: c7Customer.email,
            first_name: c7Customer.firstName || null,
            last_name: c7Customer.lastName || null,
            phone: c7Customer.phone || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', customer.id);

        console.log(`Customer ${crmCustomerId} updated successfully (data changed)`);
      }

      // Sync marketing preferences: C7 emailMarketingStatus → LV emailPromotions
      // This is separate from customer data - if customer unsubscribes in C7, we should respect it
      if (customerData.emailMarketingStatus !== undefined) {
        const currentPrefs = await db.getCommunicationPreferences(customer.id);
        const shouldReceivePromotions = customerData.emailMarketingStatus === 'Subscribed';
        
        // Only update if preference changed
        if (currentPrefs.emailPromotions !== shouldReceivePromotions) {
          await db.upsertCommunicationPreferences(customer.id, {
            ...currentPrefs,
            emailPromotions: shouldReceivePromotions,
          });
          
          console.log(`Updated email promotions preference for ${crmCustomerId}: ${shouldReceivePromotions}`);
        }
      }
      
      // If no changes to customer data or preferences, log it
      if (!hasChanges && customerData.emailMarketingStatus === undefined) {
        console.log(`Customer ${crmCustomerId} update skipped - no changes to customer data or preferences (likely club membership change already handled)`);
      }
    } catch (error) {
      console.error('Error handling customer/update webhook:', error);
      throw error;
    }
  }

  /**
   * Handle club/update webhook
   * - Update club_stage record (sync tier config changes from C7)
   */
  private async handleClubUpdate(clubData: any, clientId: string): Promise<void> {
    try {
      const c7ClubId = clubData.id;
      if (!c7ClubId) {
        console.error('Missing club ID in club/update webhook');
        return;
      }

      // Find club_stage by c7_club_id
      const supabase = db.getSupabaseClient();
      const { data: stage } = await supabase
        .from('club_stages')
        .select('*')
        .eq('c7_club_id', c7ClubId)
        .single();

      if (!stage) {
        console.log(`Club stage not found for C7 club ${c7ClubId}, skipping update`);
        return;
      }

      // Update club_stage with changes from C7
      // Note: Only sync name changes, other config is managed in LV
      // Commerce7 uses 'title' field, we store as 'name' in our database
      await supabase
        .from('club_stages')
        .update({
          name: clubData.title || stage.name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', stage.id);

      console.log(`Club ${c7ClubId} updated successfully`);
    } catch (error) {
      console.error('Error handling club/update webhook:', error);
      throw error;
    }
  }

  /**
   * Handle club/delete webhook
   * - Mark tier as inactive
   * - Cancel all active enrollments for this club
   * - Update customer flags for affected customers
   */
  private async handleClubDelete(clubData: any, clientId: string): Promise<void> {
    try {
      const c7ClubId = clubData.id;
      if (!c7ClubId) {
        console.error('Missing club ID in club/delete webhook');
        return;
      }

      const supabase = db.getSupabaseClient();

      // Find the club_stage(s) for this C7 club ID
      const { data: clubStages, error: stagesError } = await supabase
        .from('club_stages')
        .select('id')
        .eq('c7_club_id', c7ClubId);

      if (stagesError || !clubStages || clubStages.length === 0) {
        console.log(`No club_stages found for C7 club ${c7ClubId}, skipping delete`);
        return;
      }

      const stageIds = clubStages.map(stage => stage.id);

      // Find all active enrollments for these club stages
      const { data: activeEnrollments, error: enrollmentsError } = await supabase
        .from('club_enrollments')
        .select('id, customer_id')
        .in('club_stage_id', stageIds)
        .eq('status', 'active');

      if (enrollmentsError) {
        console.error('Error fetching enrollments for club delete:', enrollmentsError);
      }

      // Cancel all active enrollments for this club
      if (activeEnrollments && activeEnrollments.length > 0) {
        const enrollmentIds = activeEnrollments.map(e => e.id);
        const uniqueCustomerIds = [...new Set(activeEnrollments.map(e => e.customer_id))];

        // Mark all enrollments as expired
        await supabase
          .from('club_enrollments')
          .update({
            status: 'expired',
            updated_at: new Date().toISOString(),
          })
          .in('id', enrollmentIds);

        // Update customer flags (1 customer/1 tier policy - no other enrollments to check)
        await supabase
          .from('customers')
          .update({
            is_club_member: false,
            current_club_stage_id: null,
            updated_at: new Date().toISOString(),
          })
          .in('id', uniqueCustomerIds);

        console.log(`Cancelled ${activeEnrollments.length} active enrollments for club ${c7ClubId}`);
      }

      // Mark club_stage(s) as inactive
      await supabase
        .from('club_stages')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('c7_club_id', c7ClubId);

      console.log(`Club ${c7ClubId} marked as inactive`);
    } catch (error) {
      console.error('Error handling club/delete webhook:', error);
      throw error;
    }
  }

  /**
   * Handle club-membership/create webhook
   * - Create new enrollment when admin creates membership in C7
   * - Only process if it's for an LV-managed club
   */
  private async handleClubMembershipCreate(membershipData: C7ClubMembershipResponse, clientId: string): Promise<void> {
    try {
      const c7MembershipId = membershipData.id;
      const c7CustomerId = membershipData.customerId;
      const c7ClubId = membershipData.clubId;

      if (!c7MembershipId || !c7CustomerId || !c7ClubId) {
        console.error('Missing required fields in club-membership/create webhook');
        return;
      }

      console.log(`Processing club-membership/create webhook: membership=${c7MembershipId}, customer=${c7CustomerId}, club=${c7ClubId}`);

      const supabase = db.getSupabaseClient();

      // Check if this club is managed by LiberoVino
      const { data: clubStage } = await supabase
        .from('club_stages')
        .select('id, name, duration_months, club_program_id')
        .eq('c7_club_id', c7ClubId)
        .eq('is_active', true)
        .single();

      if (!clubStage) {
        console.log(`Club ${c7ClubId} not managed by LiberoVino, skipping enrollment creation`);
        return;
      }

      // Get or create customer in LV
      let customer = await db.getCustomerByCrmId(clientId, c7CustomerId);
      
      if (!customer) {
        console.log(`Customer ${c7CustomerId} not found in LV, fetching from C7 and creating...`);
        
        // Fetch customer from C7
        const c7Customer = await this.getCustomer(c7CustomerId);
        
        // Create customer in LV
        customer = await db.createCustomer(clientId, {
          email: c7Customer.email,
          firstName: c7Customer.firstName || '',
          lastName: c7Customer.lastName || '',
          phone: c7Customer.phone || null,
          crmId: c7CustomerId,
        });

        // Create communication preferences - respect C7's marketing status
        const defaultPrefs = db.getDefaultCommunicationPreferences();
        const preferences = {
          ...defaultPrefs,
          // Sync C7 emailMarketingStatus to emailPromotions
          emailPromotions: c7Customer.emailMarketingStatus === 'Subscribed',
        };
        await db.upsertCommunicationPreferences(customer.id, preferences);
      }

      // Check if customer already has an active enrollment
      const { data: existingEnrollment } = await supabase
        .from('club_enrollments')
        .select('id, club_stage_id, status')
        .eq('customer_id', customer.id)
        .eq('status', 'active')
        .single();

      if (existingEnrollment) {
        console.warn(`Customer ${customer.id} already has active enrollment ${existingEnrollment.id}, cannot create duplicate. Updating c7_membership_id instead.`);
        
        // Update existing enrollment with new C7 membership ID (edge case: membership was recreated in C7)
        await supabase
          .from('club_enrollments')
          .update({
            c7_membership_id: c7MembershipId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingEnrollment.id);
        
        return;
      }

      // Calculate expiration date
      const enrolledAt = membershipData.signupDate || new Date().toISOString();
      const expiresAt = new Date(enrolledAt);
      expiresAt.setMonth(expiresAt.getMonth() + clubStage.duration_months);

      // Determine status
      let status: 'active' | 'expired' = 'active';
      if (membershipData.status === 'Cancelled') {
        status = 'expired';
      } else if (membershipData.cancelDate) {
        const cancelDateInPast = new Date(membershipData.cancelDate) <= new Date();
        if (cancelDateInPast) {
          status = 'expired';
        }
      }

      // Create new enrollment
      const enrollment = await db.createClubEnrollment({
        customerId: customer.id,
        clubStageId: clubStage.id,
        status: status,
        enrolledAt: enrolledAt,
        expiresAt: membershipData.cancelDate || expiresAt.toISOString(),
        crmMembershipId: c7MembershipId,
      });

      console.log(`✅ Created enrollment ${enrollment.id} for customer ${customer.email} in tier ${clubStage.name}`);

      // Note: Not sending welcome notification here - member was enrolled via C7 admin,
      // they likely already received C7's notifications
      
    } catch (error) {
      console.error('Error handling club-membership/create webhook:', error);
      throw error;
    }
  }

  /**
   * Handle club-membership/update webhook
   * - Update enrollment record
   * - Sync status, tier, and cancel_date changes
   */
  private async handleClubMembershipUpdate(membershipData: C7ClubMembershipResponse, clientId: string): Promise<void> {
    try {
      const c7MembershipId = membershipData.id;
      if (!c7MembershipId) {
        console.error('Missing membership ID in club-membership/update webhook');
        return;
      }

      // Find enrollment by c7_membership_id
      const supabase = db.getSupabaseClient();
      const { data: enrollment } = await supabase
        .from('club_enrollments')
        .select('*')
        .eq('c7_membership_id', c7MembershipId)
        .single();

      if (!enrollment) {
        console.log(`Enrollment not found for C7 membership ${c7MembershipId}, skipping update`);
        return;
      }

      // Map C7 status to LV status
      // Database allows: 'active', 'expired', 'upgraded', 'cancelled'
      type EnrollmentStatus = 'active' | 'expired' | 'upgraded' | 'cancelled';
      let status: EnrollmentStatus = (enrollment.status || 'active') as EnrollmentStatus;
      if (membershipData.status === 'Cancelled') {
        status = 'expired';
      } else if (membershipData.status === 'Active') {
        status = 'active';
      }

      // Handle cancelDate - if set, update expires_at to that date
      let expiresAt = enrollment.expires_at;
      if (membershipData.cancelDate) {
        expiresAt = membershipData.cancelDate;
        
        // Only mark as expired if:
        // 1. Status is already 'Cancelled' in C7, OR
        // 2. cancelDate is in the past
        const cancelDateInPast = new Date(membershipData.cancelDate) <= new Date();
        
        if (status === 'active' && (membershipData.status === 'Cancelled' || cancelDateInPast)) {
          status = 'expired';
        }
        // If cancelDate is in the future and status is still Active in C7,
        // keep status as 'active' - member retains benefits until cancelDate
      }

      // Check if club/tier changed
      let clubStageId = enrollment.club_stage_id;
      let tierChanged = false;
      let movedToNonLVClub = false;

      if (membershipData.clubId) {
        // Find club_stage by c7_club_id
        const { data: newStage } = await supabase
          .from('club_stages')
          .select('id, stage_order')
          .eq('c7_club_id', membershipData.clubId)
          .single();

        if (!newStage) {
          // Member moved to a non-LV club - expire enrollment (keep old club_stage_id for history), no notification
          movedToNonLVClub = true;
          // Keep the old club_stage_id in enrollment for history, but mark as expired
          tierChanged = true;
        } else if (newStage.id !== enrollment.club_stage_id) {
          // Member moved to a different LV tier
          clubStageId = newStage.id;
          tierChanged = true;
        }
      }

      // Track if this is a cancellation (status changed to Cancelled)
      const wasActive = enrollment.status === 'active';
      const isNowCancelled = membershipData.status === 'Cancelled';
      const justCancelled = wasActive && isNowCancelled;

      // Update enrollment
      const updateData: any = {
        status: movedToNonLVClub ? 'expired' : status,
        // Keep old club_stage_id if moved to non-LV club (for history), otherwise update to new tier
        club_stage_id: movedToNonLVClub ? enrollment.club_stage_id : clubStageId,
        updated_at: new Date().toISOString(),
      };

      // Only update expires_at if cancelDate was provided
      if (membershipData.cancelDate && expiresAt !== enrollment.expires_at) {
        updateData.expires_at = expiresAt;
      }

      await supabase
        .from('club_enrollments')
        .update(updateData)
        .eq('id', enrollment.id);

      // Handle customer flags and notifications based on tier change type
      if (tierChanged) {
        if (movedToNonLVClub) {
          // Member moved to non-LV club - clear customer flags, no notification
          await supabase
            .from('customers')
            .update({
              is_club_member: false,
              current_club_stage_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', enrollment.customer_id);
        } else {
          // LV tier change - update customer flags and send notification
          await supabase
            .from('customers')
            .update({
              current_club_stage_id: clubStageId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', enrollment.customer_id);

          // Send tier change notification (works for both upgrade and downgrade)
          if (status === 'active') {
            try {
              await sendUpgradeNotification(
                clientId,
                membershipData.customerId,
                enrollment.club_stage_id,
                clubStageId
              );
            } catch (error) {
              console.error(`Failed to send tier change notification for membership ${c7MembershipId}:`, error);
              // Don't throw - notification failure shouldn't break webhook processing
            }
          }
        }
      } else if (clubStageId !== enrollment.club_stage_id && status === 'active') {
        // Existing logic for non-tier-change updates
        await supabase
          .from('customers')
          .update({
            current_club_stage_id: clubStageId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', enrollment.customer_id);
      }

      // Send expiration notification if membership was just cancelled
      // Skip if moved to non-LV club (C7 handles those notifications)
      if (justCancelled && !movedToNonLVClub) {
        try {
          // Use the enrollment's original club_stage_id for the notification
          await sendExpirationNotification(clientId, membershipData.customerId, enrollment.club_stage_id);
        } catch (error) {
          console.error(`Failed to send expiration notification for cancelled membership ${c7MembershipId}:`, error);
          // Don't throw - notification failure shouldn't break webhook processing
        }
      }

      console.log(`Club membership ${c7MembershipId} updated successfully`);
    } catch (error) {
      console.error('Error handling club-membership/update webhook:', error);
      throw error;
    }
  }

  /**
   * Handle club-membership/delete webhook
   * - Delete enrollment record (mirror C7 deletion)
   */
  private async handleClubMembershipDelete(membershipData: C7ClubMembershipResponse, clientId: string): Promise<void> {
    try {
      const c7MembershipId = membershipData.id;
      if (!c7MembershipId) {
        console.error('Missing membership ID in club-membership/delete webhook');
        return;
      }

      // Find enrollment by c7_membership_id
      const supabase = db.getSupabaseClient();
      const { data: enrollment } = await supabase
        .from('club_enrollments')
        .select('id, customer_id')
        .eq('c7_membership_id', c7MembershipId)
        .single();

      if (!enrollment) {
        console.log(`Enrollment not found for C7 membership ${c7MembershipId}, skipping delete`);
        return;
      }

      // Delete the enrollment record (C7 deleted it, so we delete it too)
      await supabase
        .from('club_enrollments')
        .delete()
        .eq('id', enrollment.id);

      // Update customer flags (1 customer/1 tier policy - no other enrollments to check)
      await supabase
        .from('customers')
        .update({
          is_club_member: false,
          current_club_stage_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', enrollment.customer_id);

      console.log(`Club membership ${c7MembershipId} deleted successfully`);
    } catch (error) {
      console.error('Error handling club-membership/delete webhook:', error);
      throw error;
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
        cancellationReason: 'Other', // Required by Commerce7 ENUM when setting cancelDate
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
   * Get a specific club membership by ID
   * Returns full membership object with nested customer and orderInformation
   */
  async getClubMembership(membershipId: string): Promise<C7ClubMembershipResponse> {
    const response = await fetch(`${API_URL}/club-membership/${membershipId}`, {
      method: 'GET',
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const data = await response.json();
    handleC7ApiError(data, 'Get Club Membership');
    
    return data;
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
