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
  // Check for status code errors
  if (data.statusCode && data.statusCode !== 200) {
    throw new Error(
      `Commerce7 ${operation} error (${data.statusCode}): ${data.message || data.type || 'Unknown error'}`
    );
  }
  
  // Check for errors array (success status but operation failed)
  if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
    const errorMessages = data.errors.map((e: any) => 
      typeof e === 'string' ? e : (e.message || JSON.stringify(e))
    ).join(', ');
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

    if (data.errors) {
      throw new Error(
        `Error fetching Commerce7 customers: ${data.errors[0]?.message}`
      );
    }

    return data.customers.map((customer: any) => ({
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    }));
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

    if (data.errors) {
      throw new Error(
        `Error creating Commerce7 customer: ${data.errors[0]?.message}`
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

    if (!response.ok) {
      throw new Error(
        `Error deleting Commerce7 webhook: ${response.statusText}`
      );
    }

    return true;
  }

  // Customer-specific discount management
  async addCustomerToDiscount(discountId: string, customerId: string): Promise<void> {
    // TODO: Implement Commerce7 customer-specific discount assignment
    // This might be done through coupon customer restrictions
    throw new Error("addCustomerToDiscount not implemented yet for Commerce7");
  }

  async removeCustomerFromDiscount(discountId: string, customerId: string): Promise<void> {
    // TODO: Implement Commerce7 customer-specific discount removal
    throw new Error("removeCustomerFromDiscount not implemented yet for Commerce7");
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
  async createClub(data: import("~/types/commerce7").C7ClubCreateRequest): Promise<import("~/types/commerce7").C7Club> {
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
  async getClub(clubId: string): Promise<import("~/types/commerce7").C7Club> {
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
    data: Partial<import("~/types/commerce7").C7ClubCreateRequest>
  ): Promise<import("~/types/commerce7").C7Club> {
    const response = await fetch(`${API_URL}/club/${clubId}`, {
      method: "PATCH",
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

    const result = await response.json();
    handleC7ApiError(result, 'deleting club');
  }

  /**
   * List all clubs
   */
  async listClubs(): Promise<import("~/types/commerce7").C7Club[]> {
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
    data: import("~/types/commerce7").C7PromotionCreateRequest
  ): Promise<import("~/types/commerce7").C7Promotion> {
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
  async getPromotion(promotionId: string): Promise<import("~/types/commerce7").C7Promotion> {
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
    data: Partial<import("~/types/commerce7").C7PromotionCreateRequest>
  ): Promise<import("~/types/commerce7").C7Promotion> {
    const response = await fetch(`${API_URL}/promotion/${promotionId}`, {
      method: "PATCH",
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

    const result = await response.json();
    handleC7ApiError(result, 'deleting promotion');
  }

  /**
   * List all promotions
   */
  async listPromotions(): Promise<import("~/types/commerce7").C7Promotion[]> {
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
    data: import("~/types/commerce7").C7PromotionSetCreateRequest
  ): Promise<import("~/types/commerce7").C7PromotionSet> {
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
  async getPromotionSet(setId: string): Promise<import("~/types/commerce7").C7PromotionSet> {
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

    const result = await response.json();
    handleC7ApiError(result, 'deleting promotion set');
  }

  // ============================================
  // LOYALTY TIER METHODS
  // ============================================
  // Loyalty is an EXTENSION - must be activated by tenant
  // Each club tier can optionally have loyalty earning
  // Uses /v2 API (not v1)

  /**
   * Create a loyalty tier
   * NOTE: Loyalty extension must be enabled by tenant first
   * @param data - Loyalty tier creation data
   */
  async createLoyaltyTier(
    data: import("~/types/commerce7").C7LoyaltyTierCreateRequest
  ): Promise<import("~/types/commerce7").C7LoyaltyTier> {
    const response = await fetch("https://api.commerce7.com/v2/loyalty-tier", {
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
  async getLoyaltyTier(loyaltyTierId: string): Promise<import("~/types/commerce7").C7LoyaltyTier> {
    const response = await fetch(`https://api.commerce7.com/v2/loyalty-tier/${loyaltyTierId}`, {
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
    data: Partial<import("~/types/commerce7").C7LoyaltyTierCreateRequest>
  ): Promise<import("~/types/commerce7").C7LoyaltyTier> {
    const response = await fetch(`https://api.commerce7.com/v2/loyalty-tier/${loyaltyTierId}`, {
      method: "PATCH",
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
    const response = await fetch(`https://api.commerce7.com/v2/loyalty-tier/${loyaltyTierId}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: getApiAuth(),
        tenant: this.tenantId,
      },
    });

    const result = await response.json();
    handleC7ApiError(result, 'deleting loyalty tier');
  }

  /**
   * List all loyalty tiers
   */
  async listLoyaltyTiers(): Promise<import("~/types/commerce7").C7LoyaltyTier[]> {
    const response = await fetch("https://api.commerce7.com/v2/loyalty-tier", {
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
    data: import("~/types/commerce7").C7LoyaltyTransactionCreateRequest
  ): Promise<import("~/types/commerce7").C7LoyaltyTransaction> {
    const response = await fetch("https://api.commerce7.com/v2/loyalty-transaction", {
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
}
