import type { CrmProvider, CrmCustomer, CrmProduct, CrmOrder, CrmDiscount, WebhookPayload, WebhookTopic, WebhookRegistration } from '~/types/crm';
import { CrmNames, CrmSlugs } from '~/types/crm';
import { redirect } from 'react-router';
import crypto from 'crypto';

const API_URL = "https://api.commerce7.com/v1";
const API_KEY = process.env.COMMERCE7_KEY;
const APP_NAME = "yno-libero-vino";

if (!API_KEY) {
  throw new Error("Commerce7 Error. Missing API key");
}

const apiAuth = "Basic " + Buffer.from(`${APP_NAME}:${API_KEY}`).toString("base64");

export class Commerce7Provider implements CrmProvider {
  name = CrmNames.COMMERCE7;
  slug = CrmSlugs.COMMERCE7;

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
        tenant: tenantId
      },
    }).then((res) => res.json());

    if (userResponse?.statusCode === 401) {
      throw new Error("Commerce7 Error. Invalid authentication");
    }

    return {
      tenantId,
      account,
      user: userResponse
    };
  }

  authorizeInstall(request: Request): boolean {
    const auth = request.headers.get("Authorization");
    if (!auth) {
      return false;
    }

    const base64 = auth.replace("Basic ", "");
    const [username, password] = Buffer.from(base64, "base64").toString().split(":");
    
    return username === process.env.COMMERCE7_USER && 
           password === process.env.COMMERCE7_PASSWORD;
  }

  async getCustomers(params?: any): Promise<CrmCustomer[]> {
    const { tenant, q = '', limit = 50 } = params || {};
    
    const response = await fetch(`${API_URL}/customer?q=${q}&limit=${limit}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: apiAuth,
        tenant: tenant
      },
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`Error fetching Commerce7 customers: ${data.errors[0]?.message}`);
    }

    return data.customers.map((customer: any) => ({
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt
    }));
  }

  async getCustomer(id: string): Promise<CrmCustomer> {
    const { tenant } = await this.getCurrentTenant();
    
    const response = await fetch(`${API_URL}/customer/${id}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: apiAuth,
        tenant: tenant
      },
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`Error fetching Commerce7 customer: ${data.errors[0]?.message}`);
    }

    return {
      id: data.id,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }

  async createCustomer(customer: Partial<CrmCustomer>): Promise<CrmCustomer> {
    const { tenant } = await this.getCurrentTenant();
    
    const response = await fetch(`${API_URL}/customer/`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: apiAuth,
        tenant: tenant
      },
      body: JSON.stringify(customer)
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`Error creating Commerce7 customer: ${data.errors[0]?.message}`);
    }

    return {
      id: data.id,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }

  async updateCustomer(id: string, customer: Partial<CrmCustomer>): Promise<CrmCustomer> {
    const { tenant } = await this.getCurrentTenant();
    
    const response = await fetch(`${API_URL}/customer/${id}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: apiAuth,
        tenant: tenant
      },
      body: JSON.stringify(customer)
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`Error updating Commerce7 customer: ${data.errors[0]?.message}`);
    }

    return {
      id: data.id,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }

  async getProducts(params?: any): Promise<CrmProduct[]> {
    const { tenant, q = '', limit = 50 } = params || {};
    
    const response = await fetch(`${API_URL}/product?q=${q}&limit=${limit}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: apiAuth,
        tenant: tenant
      },
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`Error fetching Commerce7 products: ${data.errors[0]?.message}`);
    }

    return data.products.map((product: any) => ({
      id: product.id,
      title: product.title,
      sku: product.sku,
      price: product.price,
      image: product.image,
      description: product.description,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    }));
  }

  async getProduct(id: string): Promise<CrmProduct> {
    const { tenant } = await this.getCurrentTenant();
    
    const response = await fetch(`${API_URL}/product/${id}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: apiAuth,
        tenant: tenant
      },
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`Error fetching Commerce7 product: ${data.errors[0]?.message}`);
    }

    return {
      id: data.id,
      title: data.title,
      sku: data.sku,
      price: data.price,
      image: data.image,
      description: data.description,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }

  async getOrders(params?: any): Promise<CrmOrder[]> {
    const { tenant, q = '', limit = 50 } = params || {};
    
    const response = await fetch(`${API_URL}/order?q=${q}&limit=${limit}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: apiAuth,
        tenant: tenant
      },
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`Error fetching Commerce7 orders: ${data.errors[0]?.message}`);
    }

    return data.orders.map((order: any) => ({
      id: order.id,
      customerId: order.customerId,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));
  }

  async getOrder(id: string): Promise<CrmOrder> {
    const { tenant } = await this.getCurrentTenant();
    
    const response = await fetch(`${API_URL}/order/${id}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: apiAuth,
        tenant: tenant
      },
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`Error fetching Commerce7 order: ${data.errors[0]?.message}`);
    }

    return {
      id: data.id,
      customerId: data.customerId,
      total: data.total,
      status: data.status,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }

  async getDiscounts(params?: any): Promise<CrmDiscount[]> {
    const { tenant, q = '', limit = 50 } = params || {};
    
    const response = await fetch(`${API_URL}/coupon?q=${q}&limit=${limit}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: apiAuth,
        tenant: tenant
      },
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`Error fetching Commerce7 discounts: ${data.errors[0]?.message}`);
    }

    return data.coupons.map((coupon: any) => ({
      id: coupon.id,
      code: coupon.code,
      type: coupon.type === 'percentage' ? 'percentage' : 'fixed_amount',
      value: coupon.value,
      startsAt: coupon.startsAt,
      endsAt: coupon.endsAt,
      usageLimit: coupon.usageLimit,
      usageCount: coupon.usageCount,
      isActive: coupon.isActive
    }));
  }

  async getDiscount(id: string): Promise<CrmDiscount> {
    const { tenant } = await this.getCurrentTenant();
    
    const response = await fetch(`${API_URL}/coupon/${id}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: apiAuth,
        tenant: tenant
      },
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`Error fetching Commerce7 discount: ${data.errors[0]?.message}`);
    }

    return {
      id: data.id,
      code: data.code,
      type: data.type === 'percentage' ? 'percentage' : 'fixed_amount',
      value: data.value,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      usageLimit: data.usageLimit,
      usageCount: data.usageCount,
      isActive: data.isActive
    };
  }

  async createDiscount(discount: Partial<CrmDiscount>): Promise<CrmDiscount> {
    const { tenant } = await this.getCurrentTenant();
    
    const response = await fetch(`${API_URL}/coupon/`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: apiAuth,
        tenant: tenant
      },
      body: JSON.stringify(discount)
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`Error creating Commerce7 discount: ${data.errors[0]?.message}`);
    }

    return {
      id: data.id,
      code: data.code,
      type: data.type === 'percentage' ? 'percentage' : 'fixed_amount',
      value: data.value,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      usageLimit: data.usageLimit,
      usageCount: data.usageCount,
      isActive: data.isActive
    };
  }

  async updateDiscount(id: string, discount: Partial<CrmDiscount>): Promise<CrmDiscount> {
    const { tenant } = await this.getCurrentTenant();
    
    const response = await fetch(`${API_URL}/coupon/${id}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: apiAuth,
        tenant: tenant
      },
      body: JSON.stringify(discount)
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`Error updating Commerce7 discount: ${data.errors[0]?.message}`);
    }

    return {
      id: data.id,
      code: data.code,
      type: data.type === 'percentage' ? 'percentage' : 'fixed_amount',
      value: data.value,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      usageLimit: data.usageLimit,
      usageCount: data.usageCount,
      isActive: data.isActive
    };
  }

  async deleteDiscount(id: string): Promise<boolean> {
    const { tenant } = await this.getCurrentTenant();
    
    const response = await fetch(`${API_URL}/coupon/${id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: apiAuth,
        tenant: tenant
      },
    });

    if (!response.ok) {
      throw new Error(`Error deleting Commerce7 discount: ${response.statusText}`);
    }

    return true;
  }

  private async getCurrentTenant() {
    // This would typically come from the session or request context
    // For now, we'll use an environment variable or throw an error
    const tenant = process.env.COMMERCE7_TENANT;
    if (!tenant) {
      throw new Error('Commerce7 tenant not configured');
    }
    return { tenant };
  }

  // Webhook operations
  async validateWebhook(request: Request): Promise<boolean> {
    // Commerce7 webhook validation
    // Check if request is from Commerce7 using signature or IP whitelist
    const signature = request.headers.get('x-commerce7-signature');
    const tenantId = request.headers.get('x-commerce7-tenant');
    
    if (!signature || !tenantId) {
      console.warn('Commerce7 webhook missing required headers');
      return false;
    }

    // TODO: Implement signature validation if Commerce7 provides one
    // For now, we'll validate the basic headers are present
    
    const secret = process.env.COMMERCE7_WEBHOOK_SECRET;
    if (secret) {
      try {
        const body = await request.text();
        const expectedSignature = crypto
          .createHmac('sha256', secret)
          .update(body, 'utf8')
          .digest('hex');

        return signature === expectedSignature;
      } catch (error) {
        console.error('Commerce7 webhook validation error:', error);
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
      case 'customers/create':
        console.log('New customer created:', payload.data.id);
        // TODO: Store customer in Supabase
        break;
      
      case 'customers/update':
        console.log('Customer updated:', payload.data.id);
        // TODO: Update customer in Supabase
        break;
      
      case 'orders/create':
        console.log('New order created:', payload.data.id);
        // TODO: Store order in Supabase
        break;
      
      case 'orders/update':
        console.log('Order updated:', payload.data.id);
        // TODO: Update order in Supabase
        break;
      
      case 'products/create':
        console.log('New product created:', payload.data.id);
        // TODO: Store product in Supabase
        break;
      
      case 'products/update':
        console.log('Product updated:', payload.data.id);
        // TODO: Update product in Supabase
        break;
      
      default:
        console.log('Unhandled webhook topic:', payload.topic);
    }
  }

  async registerWebhook(topic: WebhookTopic, address: string): Promise<WebhookRegistration> {
    const { tenant } = await this.getCurrentTenant();
    
    // Commerce7 webhook registration
    const response = await fetch(`${API_URL}/webhook`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: apiAuth,
        tenant: tenant
      },
      body: JSON.stringify({
        topic,
        url: address,
        isActive: true
      })
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`Error registering Commerce7 webhook: ${data.errors[0]?.message}`);
    }

    return {
      id: data.id,
      topic,
      address,
      createdAt: data.createdAt
    };
  }

  async listWebhooks(): Promise<WebhookRegistration[]> {
    const { tenant } = await this.getCurrentTenant();
    
    const response = await fetch(`${API_URL}/webhook`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: apiAuth,
        tenant: tenant
      }
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`Error listing Commerce7 webhooks: ${data.errors[0]?.message}`);
    }

    return (data.webhooks || []).map((webhook: any) => ({
      id: webhook.id,
      topic: webhook.topic as WebhookTopic,
      address: webhook.url,
      createdAt: webhook.createdAt
    }));
  }

  async deleteWebhook(id: string): Promise<boolean> {
    const { tenant } = await this.getCurrentTenant();
    
    const response = await fetch(`${API_URL}/webhook/${id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: apiAuth,
        tenant: tenant
      }
    });

    if (!response.ok) {
      throw new Error(`Error deleting Commerce7 webhook: ${response.statusText}`);
    }

    return true;
  }
}
