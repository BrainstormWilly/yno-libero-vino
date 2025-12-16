/**
 * Commerce7-specific customer conversions
 * Handles Commerce7 API format and data transformations
 */

import type { Customer, CustomerAddress, CustomerPayment } from "./customer";

// ============================================
// Commerce7 Raw API Response Types
// ============================================

export type C7CustomerResponse = {
  id: string;
  firstName: string;
  lastName: string;
  emails: Array<{ email: string; id?: string }>;
  phones?: Array<{ phone: string; id?: string }>;
  createdAt: string;
  updatedAt: string;
};

export type C7AddressResponse = {
  id: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  address: string;          // C7 uses "address" not "address1"
  address2?: string;
  city: string;
  stateCode: string;        // C7 uses "stateCode" not "state"
  zipCode: string;          // C7 uses "zipCode" not "zip"
  countryCode: string;      // C7 uses "countryCode" not "country"
  phone?: string;
  isDefault?: boolean;
};

export type C7OrderResponse = {
  id: string;
  total: number;            // In cents!
  customerId: string;
  createdAt: string;
};

export type C7CreditCardResponse = {
  id: string;
  cardBrand?: string;
  maskedCardNumber?: string;
  expiryMo?: number;
  expiryYr?: number;
  cardHolderName?: string;
  isDefault?: boolean;
};

// ============================================
// Conversion Functions: FROM Commerce7
// ============================================

export const fromC7Customer = (c7Customer: C7CustomerResponse): import('~/types/crm').CrmCustomer => ({
  id: c7Customer.id,
  email: c7Customer.emails[0].email,
  firstName: c7Customer.firstName,
  lastName: c7Customer.lastName,
  phone: c7Customer.phones?.[0]?.phone,
  createdAt: c7Customer.createdAt,
  updatedAt: c7Customer.updatedAt,
  emailMarketingStatus: (c7Customer as any).emailMarketingStatus, // May not exist on all C7 customer responses
});

export const fromC7Address = (c7Address: C7AddressResponse): CustomerAddress => ({
  id: c7Address.id,
  firstName: c7Address.firstName,
  lastName: c7Address.lastName,
  company: c7Address.company,
  address1: c7Address.address,      // Map address → address1
  address2: c7Address.address2,
  city: c7Address.city,
  state: c7Address.stateCode,       // Map stateCode → state
  zip: c7Address.zipCode,           // Map zipCode → zip
  country: c7Address.countryCode,   // Map countryCode → country
  phone: c7Address.phone,
  isDefault: c7Address.isDefault,
});

export const fromC7Payment = (c7Card: C7CreditCardResponse): CustomerPayment => ({
  id: c7Card.id,
  type: c7Card.cardBrand,
  last4: c7Card.maskedCardNumber?.slice(-4),
  expiryMonth: c7Card.expiryMo?.toString().padStart(2, '0'),
  expiryYear: c7Card.expiryYr?.toString(),
  cardholderName: c7Card.cardHolderName,
  isDefault: c7Card.isDefault,
});

// ============================================
// Conversion Functions: TO Commerce7
// ============================================

export const toC7Address = (address: CustomerAddress): Partial<C7AddressResponse> => ({
  firstName: address.firstName,
  lastName: address.lastName,
  company: address.company,
  address: address.address1,        // Map address1 → address
  address2: address.address2,
  city: address.city,
  stateCode: address.state,         // Map state → stateCode
  zipCode: address.zip,             // Map zip → zipCode
  countryCode: address.country,     // Map country → countryCode
  phone: address.phone,
  isDefault: address.isDefault,
});

// ============================================
// Commerce7-specific Calculations
// ============================================

/**
 * Calculate LTV from C7 orders
 * Converts from cents to dollars
 */
export const calculateC7LTV = (orders: C7OrderResponse[]): number => {
  const totalInCents = orders.reduce((sum, order) => sum + (order.total || 0), 0);
  return totalInCents / 100; // Convert cents to dollars
};

/**
 * Convert cents to dollars (C7 stores all amounts in cents)
 */
export const c7CentsToDollars = (cents: number): number => {
  return cents / 100;
};

/**
 * Convert dollars to cents (C7 requires amounts in cents)
 */
export const c7DollarsToCents = (dollars: number): number => {
  return Math.round(dollars * 100);
};

