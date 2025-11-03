/**
 * Unified Discount Types (Promotions)
 * Works with both Commerce7 (Promotions) and Shopify (Discounts) platforms
 * 
 * Note: These are PROMOTIONS that auto-apply, not coupons with codes
 * - Commerce7: Creates Promotions (no code, auto-apply to club members)
 * - Shopify: Creates Discounts (auto-apply)
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
 * Note: Only applies to shipping promotions (minimum cart for free shipping)
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
  variantIds?: string[];
};

/**
 * Collection reference for discounts
 */
export type DiscountCollection = {
  id: string;
  title?: string;
};

/**
 * Customer segment/tag reference
 * For targeting specific customer groups (club tiers in C7)
 */
export type DiscountCustomerSegment = {
  id: string;
  name: string;
};

/**
 * Items that the discount applies to
 * Supports both product discounts and shipping discounts
 */
export type DiscountAppliesTo = {
  target: "product" | "shipping"; // What type of discount
  scope: "all" | "specific"; // All items or specific items
  products: DiscountProduct[]; // For specific products (when scope="specific")
  collections: DiscountCollection[]; // For specific collections (when scope="specific")
};

/**
 * Minimum purchase requirements
 * Note: Only used for shipping promotions (minimum cart amount for free shipping)
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
 * Unified Discount Type (Promotion)
 * Core type that works across both Commerce7 and Shopify
 * 
 * Note: Promotions auto-apply (no code needed) and never expire.
 * They remain active until the client uninstalls.
 * Customer tier/membership is tracked in Supabase separately.
 */
export type Discount = {
  // Basic Information
  id?: string; // Platform-specific ID (undefined for new discounts)
  title: string; // Internal name/title for the discount
  platform?: PlatformType; // Which platform this discount is for
  
  // Status and Timing
  status: DiscountStatus;
  startsAt: Date;
  // No endsAt - promotions never expire, only deleted on uninstall
  
  // Discount Configuration
  value: DiscountValue;
  appliesTo: DiscountAppliesTo;
  
  // Customer Eligibility
  customerSegments: DiscountCustomerSegment[]; // Club tiers in C7
  
  // Requirements (only for shipping promotions)
  minimumRequirement: DiscountMinimumRequirement;
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
  
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
export type DiscountInput = Omit<Discount, "id" | "createdAt" | "updatedAt" | "status">;

/**
 * Serialized input type
 */
export type SerializedDiscountInput = Omit<SerializedDiscount, "id" | "createdAt" | "updatedAt" | "status">;

/**
 * Helper to create a default discount object
 * Note: Promotions never expire, so no endsAt field
 */
export const createDefaultDiscount = (
  platform: PlatformType,
  target: "product" | "shipping" = "product"
): DiscountInput => ({
  title: "",
  platform,
  startsAt: new Date(),
  value: {
    type: "percentage",
    percentage: 0,
  },
  appliesTo: {
    target,
    scope: "all",
    products: [],
    collections: [],
  },
  customerSegments: [], // Will be set to club tier when creating
  minimumRequirement: {
    type: "none",
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

