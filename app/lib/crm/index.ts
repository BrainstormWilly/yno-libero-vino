import type { CrmProvider } from '~/types/crm';
import { ShopifyProvider } from './shopify.server';
import { Commerce7Provider } from './commerce7.server';

export class CrmManager {
  private providers: Map<string, CrmProvider> = new Map();

  constructor() {
    // Initialize providers
    this.providers.set('shopify', new ShopifyProvider());
    this.providers.set('commerce7', new Commerce7Provider());
  }

  getProvider(crmType: string): CrmProvider {
    const provider = this.providers.get(crmType);
    if (!provider) {
      throw new Error(`Unsupported CRM type: ${crmType}`);
    }
    return provider;
  }

  getAvailableProviders(): CrmProvider[] {
    return Array.from(this.providers.values());
  }

  async authenticate(crmType: string, request: Request) {
    const provider = this.getProvider(crmType);
    return await provider.authenticate(request);
  }

  async authorizeInstall(crmType: string, request: Request): Promise<boolean> {
    const provider = this.getProvider(crmType);
    return provider.authorizeInstall(request);
  }

  // Customer operations
  async getCustomers(crmType: string, params?: any) {
    const provider = this.getProvider(crmType);
    return await provider.getCustomers(params);
  }

  async getCustomer(crmType: string, id: string) {
    const provider = this.getProvider(crmType);
    return await provider.getCustomer(id);
  }

  async createCustomer(crmType: string, customer: any) {
    const provider = this.getProvider(crmType);
    return await provider.createCustomer(customer);
  }

  async updateCustomer(crmType: string, id: string, customer: any) {
    const provider = this.getProvider(crmType);
    return await provider.updateCustomer(id, customer);
  }

  // Product operations
  async getProducts(crmType: string, params?: any) {
    const provider = this.getProvider(crmType);
    return await provider.getProducts(params);
  }

  async getProduct(crmType: string, id: string) {
    const provider = this.getProvider(crmType);
    return await provider.getProduct(id);
  }

  // Order operations
  async getOrders(crmType: string, params?: any) {
    const provider = this.getProvider(crmType);
    return await provider.getOrders(params);
  }

  async getOrder(crmType: string, id: string) {
    const provider = this.getProvider(crmType);
    return await provider.getOrder(id);
  }

  // Discount operations
  async getDiscounts(crmType: string, params?: any) {
    const provider = this.getProvider(crmType);
    return await provider.getDiscounts(params);
  }

  async getDiscount(crmType: string, id: string) {
    const provider = this.getProvider(crmType);
    return await provider.getDiscount(id);
  }

  async createDiscount(crmType: string, discount: any) {
    const provider = this.getProvider(crmType);
    return await provider.createDiscount(discount);
  }

  async updateDiscount(crmType: string, id: string, discount: any) {
    const provider = this.getProvider(crmType);
    return await provider.updateDiscount(id, discount);
  }

  async deleteDiscount(crmType: string, id: string) {
    const provider = this.getProvider(crmType);
    return await provider.deleteDiscount(id);
  }
}

// Singleton instance
export const crmManager = new CrmManager();
