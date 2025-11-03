/**
 * Unified Customer Types
 * Platform-agnostic customer, address, and payment representations
 */

export type PlatformType = "commerce7" | "shopify";

export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  ltv?: number;           // Always in currency (dollars), never cents
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddress {
  id?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;          // Normalized field name (stateCode in C7, province in Shopify)
  zip: string;            // Normalized field name (zipCode in C7, zip in Shopify)
  country: string;        // Normalized field name (countryCode in both)
  phone?: string;
  isDefault?: boolean;    // true = billing, false = shipping
}

export interface CustomerPayment {
  id?: string;
  type?: string;          // Card brand (Visa, Mastercard, etc)
  last4?: string;
  expiryMonth?: string;   // Always 2-digit string (MM)
  expiryYear?: string;    // Always 4-digit string (YYYY)
  cardholderName?: string;
  isDefault?: boolean;
}

