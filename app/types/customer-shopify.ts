/**
 * Shopify-specific customer conversions
 * Handles Shopify API format and data transformations
 */

import type { Customer, CustomerAddress, CustomerPayment } from "./customer";

// ============================================
// Shopify Raw API Response Types (to be implemented)
// ============================================

export type ShopifyCustomerResponse = {
  // TODO: Define based on Shopify GraphQL API
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
};

export type ShopifyAddressResponse = {
  // TODO: Define based on Shopify GraphQL API
  id: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  zip?: string;
  country?: string;
  phone?: string;
};

export type ShopifyOrderResponse = {
  // TODO: Define based on Shopify GraphQL API
  id: string;
  totalPrice: string; // Shopify stores as string in currency
};

// ============================================
// Conversion Functions (Stubs for future implementation)
// ============================================

export const fromShopifyCustomer = (shopifyCustomer: ShopifyCustomerResponse): Customer => {
  throw new Error('Shopify customer conversion not implemented yet');
};

export const fromShopifyAddress = (shopifyAddress: ShopifyAddressResponse): CustomerAddress => {
  throw new Error('Shopify address conversion not implemented yet');
};

export const fromShopifyPayment = (shopifyPayment: any): CustomerPayment => {
  throw new Error('Shopify payment conversion not implemented yet');
};

/**
 * Calculate LTV from Shopify orders
 * Note: Shopify already stores in currency, no conversion needed
 */
export const calculateShopifyLTV = (orders: ShopifyOrderResponse[]): number => {
  const total = orders.reduce((sum, order) => {
    return sum + parseFloat(order.totalPrice || '0');
  }, 0);
  return total;
};

