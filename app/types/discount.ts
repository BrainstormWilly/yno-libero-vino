/**
 * Unified Discount Types
 * Works with both Commerce7 and Shopify platforms
 */

/**
 * Platform-agnostic discount value type
 */
export type DiscountValueType = "percentage" | "fixed-amount";

/**
 * Platform-agnostic discount status
 * Note: Discounts never expire, they can only be deleted when client uninstalls
 */
export type DiscountStatus = "active" | "inactive" | "scheduled";

/**
 * Platform-agnostic minimum requirement type
 */
export type MinimumRequirementType = "none" | "quantity" | "amount";

/**
 * Platform identifier
 */
export type PlatformType = "commerce7" | "shopify";

/**
 * Product reference for discounts
 */
export type DiscountProduct = {
  id: string;
  title?: string;
  variantIds?: string[]; // Shopify uses variants, C7 uses product IDs
};

/**
 * Collection reference for discounts
 */
export type DiscountCollection = {
  id: string;
  title?: string;
};

/**
 * Customer reference for discounts
 */
export type DiscountCustomer = {
  id: string;
  email?: string;
  name?: string;
};

/**
 * Customer segment/tag reference
 */
export type DiscountCustomerSegment = {
  id: string;
  name: string;
};

/**
 * Items that the discount applies to
 */
export type DiscountAppliesTo = {
  all: boolean; // If true, applies to all products
  products: DiscountProduct[];
  collections: DiscountCollection[];
};

/**
 * Customer selection for discount eligibility
 */
export type DiscountCustomerSelection = {
  all: boolean; // If true, available to all customers
  customers: DiscountCustomer[];
  segments: DiscountCustomerSegment[]; // Tags in C7, Segments in Shopify
};

/**
 * Minimum purchase requirements
 */
export type DiscountMinimumRequirement = {
  type: MinimumRequirementType;
  quantity?: number; // Minimum quantity of items
  amount?: number; // Minimum purchase amount (in cents or smallest currency unit)
};

/**
 * Discount value configuration
 */
export type DiscountValue = {
  type: DiscountValueType;
  percentage?: number; // 0-100 for display, will convert to platform-specific
  amount?: number; // In cents or smallest currency unit
};

/**
 * Discount combination settings
 * Controls which other discount types this can be combined with
 */
export type DiscountCombinesWith = {
  productDiscounts: boolean;
  orderDiscounts: boolean;
  shippingDiscounts: boolean;
};

/**
 * Usage limits for the discount
 */
export type DiscountUsageLimits = {
  total: number | null; // Total number of times discount can be used (null = unlimited)
  perCustomer: number | null; // Max uses per customer (null = unlimited)
  appliesOncePerCustomer: boolean; // If true, customer can only use once regardless of perCustomer limit
};

/**
 * Unified Discount Type
 * Core type that works across both Commerce7 and Shopify
 * 
 * Note: Discounts never expire. They remain active until the client uninstalls.
 * Customer duration/membership is tracked in Supabase separately.
 */
export type Discount = {
  // Basic Information
  id?: string; // Platform-specific ID (undefined for new discounts)
  code: string; // Discount code customers will use
  title: string; // Internal name/title for the discount
  platform?: PlatformType; // Which platform this discount is for
  
  // Status and Timing
  status: DiscountStatus;
  startsAt: Date;
  // No endsAt - discounts never expire, only deleted on uninstall
  
  // Discount Configuration
  value: DiscountValue;
  appliesTo: DiscountAppliesTo;
  
  // Customer Eligibility
  customerSelection: DiscountCustomerSelection;
  
  // Requirements and Limits
  minimumRequirement: DiscountMinimumRequirement;
  usageLimits: DiscountUsageLimits;
  combinesWith: DiscountCombinesWith;
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
  usageCount?: number; // How many times it's been used
  
  // Platform-specific data (stored as JSON for flexibility)
  platformData?: Record<string, any>;
};

/**
 * Serialized version for API transmission (dates as strings)
 */
export type SerializedDiscount = Omit<Discount, "startsAt" | "createdAt" | "updatedAt"> & {
  startsAt: string;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Input type for creating/updating discounts
 */
export type DiscountInput = Omit<Discount, "id" | "createdAt" | "updatedAt" | "usageCount" | "status">;

/**
 * Serialized input type
 */
export type SerializedDiscountInput = Omit<SerializedDiscount, "id" | "createdAt" | "updatedAt" | "usageCount" | "status">;

/**
 * Helper to create a default discount object
 * Note: Discounts never expire, so no endsAt field
 */
export const createDefaultDiscount = (platform: PlatformType): DiscountInput => ({
  code: "",
  title: "",
  platform,
  startsAt: new Date(),
  value: {
    type: "percentage",
    percentage: 0,
  },
  appliesTo: {
    all: false,
    products: [],
    collections: [],
  },
  customerSelection: {
    all: false, // Start with no customers, will be added later
    customers: [],
    segments: [],
  },
  minimumRequirement: {
    type: "none",
  },
  usageLimits: {
    total: null,
    perCustomer: null,
    appliesOncePerCustomer: false,
  },
  combinesWith: {
    productDiscounts: false,
    orderDiscounts: false,
    shippingDiscounts: false,
  },
});

/**
 * Parse serialized discount to regular discount
 */
export const parseDiscount = (serialized: SerializedDiscount): Discount => ({
  ...serialized,
  startsAt: new Date(serialized.startsAt),
  createdAt: serialized.createdAt ? new Date(serialized.createdAt) : undefined,
  updatedAt: serialized.updatedAt ? new Date(serialized.updatedAt) : undefined,
});

/**
 * Serialize discount for API transmission
 */
export const serializeDiscount = (discount: Discount): SerializedDiscount => ({
  ...discount,
  startsAt: discount.startsAt instanceof Date 
    ? discount.startsAt.toISOString() 
    : (typeof discount.startsAt === 'string' ? discount.startsAt : new Date().toISOString()),
  createdAt: discount.createdAt instanceof Date 
    ? discount.createdAt.toISOString() 
    : (typeof discount.createdAt === 'string' ? discount.createdAt : undefined),
  updatedAt: discount.updatedAt instanceof Date 
    ? discount.updatedAt.toISOString() 
    : (typeof discount.updatedAt === 'string' ? discount.updatedAt : undefined),
});

/**
 * Calculate discount status based on start date
 * Note: Discounts never expire, only scheduled vs active
 */
export const calculateDiscountStatus = (discount: Discount): DiscountStatus => {
  const now = new Date();
  const startsAt = new Date(discount.startsAt);
  
  if (startsAt > now) {
    return "scheduled";
  }
  
  return discount.status === "inactive" ? "inactive" : "active";
};

/**
 * Format discount value for display
 */
export const formatDiscountValue = (value: DiscountValue): string => {
  if (value.type === "percentage" && value.percentage !== undefined) {
    return `${value.percentage}%`;
  }
  if (value.type === "fixed-amount" && value.amount !== undefined) {
    return `$${(value.amount / 100).toFixed(2)}`;
  }
  return "";
};

/**
 * Check if discount is currently active
 */
export const isDiscountActive = (discount: Discount): boolean => {
  return calculateDiscountStatus(discount) === "active";
};

