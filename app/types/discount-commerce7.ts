/**
 * Commerce7-specific discount conversions
 * Converts between unified Discount type and Commerce7 Promotion API format
 * 
 * Note: This is for PROMOTIONS (auto-apply), not coupons (with codes)
 * Legacy coupon types are kept at the bottom for backward compatibility
 */

import type { 
  C7Promotion, 
  C7PromotionCreateRequest,
  C7PromotionStatus,
  C7PromotionType,
  C7PromotionAppliesTo,
  C7PromotionDiscountType,
  C7PromotionCartRequirementType,
  C7PromotionUsageLimitType,
} from "./commerce7";
import type { Discount, DiscountStatus } from "./discount";

// ============================================
// Legacy Coupon Types (for backward compatibility)
// ============================================

export enum C7CouponStatus {
  ENABLED = "Enabled",
  DISABLED = "Disabled",
}

export enum C7DiscountType {
  PERCENTAGE_OFF = "Percentage Off",
  DOLLAR_OFF = "Dollar Off",
}

export enum C7AppliesTo {
  PRODUCT = "Product",
  COLLECTION = "Collection",
  DEPARTMENT = "Department",
  STORE = "Store",
  NONE = "None",
}

export enum C7AvailableTo {
  EVERYONE = "Everyone",
  TAG = "Tag",
}

export enum C7CartRequirementType {
  NONE = "None",
  MINIMUM_QUANTITY = "Minimum Quantity",
  MINIMUM_PURCHASE = "Minimum Purchase Amount",
}

export enum C7UsageLimitType {
  UNLIMITED = "Unlimited",
  STORE = "Per Store",
  CUSTOMER = "Per Customer",
}

export enum C7CartRequirementCountType {
  ONLY_DISCOUNT_ITEMS = "Only Items In Discount",
  ALL_ITEMS = "All Items",
}

export type C7CouponPayload = {
  actionMessage: string;
  appliesTo: C7AppliesTo;
  appliesToObjectIds: string | string[];
  availableTo: C7AvailableTo;
  availableToObjectIds: string | string[];
  cartContainsObjectIds: string | null;
  cartContainsType: "Anything";
  cartRequirement: number | null;
  cartRequirementCountType: C7CartRequirementCountType;
  cartRequirementMaximum: number | null;
  cartRequirementType: C7CartRequirementType;
  code: string;
  discount: number;
  discountType: C7DiscountType;
  dollarOffDiscountApplies: string;
  endDate: string | null;
  excludeObjectIds?: string[];
  excludes: C7AppliesTo | null;
  id?: string;
  startDate: string;
  status: C7CouponStatus;
  title: string;
  type: "Product" | "Shipping";
  usageLimit: number | null;
  usageLimitType: C7UsageLimitType;
};

// ============================================
// Helper Functions
// ============================================

/**
 * Convert percentage to C7 basis points
 * 10% → 1000 (C7 stores percentages as basis points)
 */
export const c7PercentageToBasisPoints = (percentage: number): number => {
  return Math.round(percentage * 100);
};

/**
 * Convert C7 basis points to percentage
 * 1000 → 10%
 */
export const c7BasisPointsToPercentage = (basisPoints: number): number => {
  return basisPoints / 100;
};

/**
 * Convert dollars to cents for cart requirements
 * $10.50 → 1050 cents
 */
export const c7DollarsToCents = (dollars: number): number => {
  return Math.round(dollars * 100);
};

/**
 * Convert cents to dollars for cart requirements
 * 1050 cents → $10.50
 */
export const c7CentsToDollars = (cents: number): number => {
  return cents / 100;
};

/**
 * Convert unified DiscountStatus to C7 status
 */
const toC7Status = (status: DiscountStatus): C7PromotionStatus => {
  return status === "active" ? "Enabled" : "Disabled";
};

/**
 * Convert C7 status to unified DiscountStatus
 */
const fromC7Status = (status: C7PromotionStatus): DiscountStatus => {
  return status === "Enabled" ? "active" : "inactive";
};

// ============================================
// Conversion Functions: TO Commerce7
// ============================================

/**
 * Convert unified Discount to Commerce7 Promotion create request
 * 
 * @param discount - The unified discount object
 * @param clubId - The C7 club ID to link this promotion to
 * @returns C7PromotionCreateRequest payload
 */
export const toC7Promotion = (
  discount: Discount,
  clubId: string
): C7PromotionCreateRequest => {
  // Determine promotion type (Product or Shipping)
  const type: C7PromotionType = discount.appliesTo.target === "shipping" 
    ? "Shipping" 
    : "Product";

  // Determine what the discount applies to
  let appliesTo: C7PromotionAppliesTo;
  let appliesToObjectIds: string[] | undefined;

  if (discount.appliesTo.scope === "all") {
    appliesTo = "Store";
    appliesToObjectIds = undefined;
  } else if (discount.appliesTo.collections && discount.appliesTo.collections.length > 0) {
    appliesTo = "Collection";
    appliesToObjectIds = discount.appliesTo.collections.map(c => c.id);
  } else if (discount.appliesTo.products && discount.appliesTo.products.length > 0) {
    appliesTo = "Product";
    appliesToObjectIds = discount.appliesTo.products.map(p => p.id);
  } else {
    appliesTo = "Store";
    appliesToObjectIds = undefined;
  }

  // Determine discount type and value
  const discountType: C7PromotionDiscountType = 
    discount.value.type === "percentage" ? "Percentage Off" : "Dollar Off";
  
  const discountValue = discount.value.type === "percentage"
    ? c7PercentageToBasisPoints(discount.value.percentage || 0)
    : (discount.value.amount || 0); // Already in cents

  // Determine cart requirements (only for shipping promotions)
  let cartRequirementType: C7PromotionCartRequirementType = "None";
  let cartRequirement: number | null = null;

  if (discount.appliesTo.target === "shipping" && discount.minimumRequirement) {
    if (discount.minimumRequirement.type === "amount" && discount.minimumRequirement.amount) {
      cartRequirementType = "Minimum Amount";
      // C7 expects dollars, we store in cents
      cartRequirement = c7CentsToDollars(discount.minimumRequirement.amount);
    } else if (discount.minimumRequirement.type === "quantity" && discount.minimumRequirement.quantity) {
      cartRequirementType = "Minimum Quantity";
      cartRequirement = discount.minimumRequirement.quantity;
    }
  }

  const payload: C7PromotionCreateRequest = {
    title: discount.title,
    actionMessage: "",
    
    // Discount configuration
    type,
    discountType,
    discount: discountValue,
    dollarOffDiscountApplies: "Once Per Order",
    
    // Applies to
    appliesTo,
    appliesToObjectIds: appliesTo === "Store" ? undefined : appliesToObjectIds,
    // excludes: null,
    // excludeObjectIds: [],
    
    // Cart requirements
    cartRequirementType,
    cartRequirement,
    cartRequirementMaximum: null,
    cartRequirementCountType: "All Items",
    
    // Usage limits (promotions are unlimited)
    usageLimitType: "Unlimited",
    usageLimit: null,
    
    // Availability - linked to club
    status: toC7Status(discount.status),
    availableTo: "Club",
    availableToObjectIds: [clubId],
    clubFrequencies: [],
    // channels: ["All"],
    
    // Promotion sets
    promotionSets: [],
    
    // Timing
    startDate: discount.startsAt instanceof Date 
      ? discount.startsAt.toISOString() 
      : new Date().toISOString(),
    endDate: null, // Promotions never expire
  };

  return payload;
};

// ============================================
// Conversion Functions: FROM Commerce7
// ============================================

/**
 * Convert Commerce7 Promotion to unified Discount
 * 
 * @param c7Promotion - The C7 promotion response object
 * @returns Unified Discount object
 */
export const fromC7Promotion = (c7Promotion: C7Promotion): Discount => {
  if (!c7Promotion) {
    throw new Error('C7 Promotion data is null or undefined');
  }

  // C7 returns the structure matching the create request
  const target: "product" | "shipping" = c7Promotion.type === "Product" ? "product" : "shipping";
  const discountType = c7Promotion.discountType;
  const discountAmount = c7Promotion.discount;

  const value = {
    type: discountType === "Percentage Off" ? "percentage" as const : "fixed-amount" as const,
    percentage: discountType === "Percentage Off" 
      ? c7BasisPointsToPercentage(discountAmount || 0)
      : undefined,
    amount: discountType === "Dollar Off" 
      ? (discountAmount || 0)
      : undefined,
  };

  // Parse applies to
  const scope: "all" | "specific" = 
    c7Promotion.appliesTo === "Store" ? "all" : "specific";
  
  const products = c7Promotion.appliesTo === "Product" && c7Promotion.appliesToObjectIds
    ? c7Promotion.appliesToObjectIds.map(id => ({ id }))
    : [];
  
  const collections = c7Promotion.appliesTo === "Collection" && c7Promotion.appliesToObjectIds
    ? c7Promotion.appliesToObjectIds.map(id => ({ id }))
    : [];

  const appliesTo = {
    target,
    scope,
    products,
    collections,
  };

  // Parse minimum requirement (from cartRequirement)
  let minimumRequirement: {
    type: "none" | "quantity" | "amount";
    quantity?: number;
    amount?: number;
  } = {
    type: "none",
  };

  if (c7Promotion.cartRequirementType === "Minimum Amount" && c7Promotion.cartRequirement) {
    minimumRequirement = {
      type: "amount",
      amount: c7DollarsToCents(c7Promotion.cartRequirement),
    };
  } else if (c7Promotion.cartRequirementType === "Minimum Quantity" && c7Promotion.cartRequirement) {
    minimumRequirement = {
      type: "quantity",
      quantity: c7Promotion.cartRequirement,
    };
  }

  // Parse customer segments (from availableToObjectIds - club IDs)
  const customerSegments = c7Promotion.availableToObjectIds
    ? c7Promotion.availableToObjectIds.map(id => ({ id, name: "" }))
    : [];

  // Parse status
  const status = fromC7Status(c7Promotion.status);

  const discount: Discount = {
    id: c7Promotion.id,
    title: c7Promotion.title,
    platform: "commerce7",
    status,
    startsAt: c7Promotion.startDate ? new Date(c7Promotion.startDate) : new Date(),
    value,
    appliesTo,
    customerSegments,
    minimumRequirement,
    createdAt: c7Promotion.createdAt ? new Date(c7Promotion.createdAt) : undefined,
    updatedAt: c7Promotion.updatedAt ? new Date(c7Promotion.updatedAt) : undefined,
    platformData: {
      promotionSets: c7Promotion.promotionSets,
      actionMessage: c7Promotion.actionMessage,
    },
  };

  return discount;
};

// ============================================
// Legacy Coupon Conversion Functions (for backward compatibility)
// ============================================

/**
 * Convert unified Discount to C7CouponPayload (legacy coupon format)
 * Used by tier-helpers and other legacy code that still uses coupons
 */
export const toC7Coupon = (discount: Discount): C7CouponPayload => {
  // Determine discount type
  const discountType = discount.value.type === "percentage" 
    ? C7DiscountType.PERCENTAGE_OFF 
    : C7DiscountType.DOLLAR_OFF;
  
  // Get discount value
  const discountValue = discount.value.type === "percentage"
    ? (discount.value.percentage || 0)
    : c7CentsToDollars(discount.value.amount || 0);
  
  // Determine applies to
  const appliesTo = discount.appliesTo.target === "shipping"
    ? C7AppliesTo.STORE
    : discount.appliesTo.scope === "all"
    ? C7AppliesTo.STORE
    : discount.appliesTo.products.length > 0
    ? C7AppliesTo.PRODUCT
    : C7AppliesTo.COLLECTION;
  
  // Get applies to object IDs
  const appliesToObjectIds = discount.appliesTo.scope === "specific"
    ? [
        ...discount.appliesTo.products.map(p => p.id),
        ...discount.appliesTo.collections.map(c => c.id),
      ]
    : [];
  
  // Determine available to (customer selection)
  const availableTo = discount.customerSelection?.all 
    ? C7AvailableTo.EVERYONE
    : C7AvailableTo.TAG;
  
  const availableToObjectIds = discount.customerSelection?.segments.map(s => s.id) || [];
  
  // Cart requirement
  const cartRequirementType = discount.minimumRequirement.type === "quantity"
    ? C7CartRequirementType.MINIMUM_QUANTITY
    : discount.minimumRequirement.type === "amount"
    ? C7CartRequirementType.MINIMUM_PURCHASE
    : C7CartRequirementType.NONE;
  
  const cartRequirement = discount.minimumRequirement.type === "quantity"
    ? discount.minimumRequirement.quantity || null
    : discount.minimumRequirement.type === "amount"
    ? c7CentsToDollars(discount.minimumRequirement.amount || 0)
    : null;
  
  return {
    actionMessage: discount.title,
    appliesTo,
    appliesToObjectIds: appliesToObjectIds.length > 0 ? appliesToObjectIds : [],
    availableTo,
    availableToObjectIds: availableToObjectIds.length > 0 ? availableToObjectIds : [],
    cartContainsObjectIds: null,
    cartContainsType: "Anything",
    cartRequirement,
    cartRequirementCountType: C7CartRequirementCountType.ALL_ITEMS,
    cartRequirementMaximum: null,
    cartRequirementType,
    code: discount.code || "",
    discount: discountValue,
    discountType,
    dollarOffDiscountApplies: "All Items",
    endDate: null,
    excludes: null,
    startDate: discount.startsAt.toISOString().split('T')[0],
    status: discount.status === "active" ? C7CouponStatus.ENABLED : C7CouponStatus.DISABLED,
    title: discount.title,
    type: discount.appliesTo.target === "shipping" ? "Shipping" : "Product",
    usageLimit: null,
    usageLimitType: C7UsageLimitType.UNLIMITED,
  };
};

/**
 * Convert C7CouponPayload to unified Discount (legacy coupon format)
 * Used by setup-loader-helpers and other legacy code
 */
export const fromC7Coupon = (coupon: C7CouponPayload): Discount => {
  // Determine discount value
  const value = coupon.discountType === C7DiscountType.PERCENTAGE_OFF
    ? { type: "percentage" as const, percentage: coupon.discount }
    : { type: "fixed-amount" as const, amount: c7DollarsToCents(coupon.discount) };
  
  // Determine applies to
  const appliesToTarget = coupon.type === "Shipping" ? "shipping" : "product";
  const appliesToScope = coupon.appliesTo === C7AppliesTo.STORE ? "all" : "specific";
  
  const appliesTo = {
    target: appliesToTarget as "product" | "shipping",
    scope: appliesToScope as "all" | "specific",
    products: appliesToScope === "specific" && Array.isArray(coupon.appliesToObjectIds)
      ? coupon.appliesToObjectIds.map(id => ({ id, title: "" }))
      : [],
    collections: [],
  };
  
  // Customer segments from availableToObjectIds
  const customerSegments = Array.isArray(coupon.availableToObjectIds)
    ? coupon.availableToObjectIds.map(id => ({ id, name: "" }))
    : [];
  
  // Minimum requirement
  const minimumRequirement = coupon.cartRequirementType === C7CartRequirementType.MINIMUM_QUANTITY
    ? { type: "quantity" as const, quantity: coupon.cartRequirement || undefined }
    : coupon.cartRequirementType === C7CartRequirementType.MINIMUM_PURCHASE
    ? { type: "amount" as const, amount: coupon.cartRequirement ? c7DollarsToCents(coupon.cartRequirement) : undefined }
    : { type: "none" as const };
  
  return {
    id: coupon.id,
    title: coupon.title,
    platform: "commerce7",
    status: coupon.status === C7CouponStatus.ENABLED ? "active" : "inactive",
    startsAt: coupon.startDate ? new Date(coupon.startDate) : new Date(),
    value,
    appliesTo,
    customerSegments,
    minimumRequirement,
    code: coupon.code,
    customerSelection: {
      all: coupon.availableTo === C7AvailableTo.EVERYONE,
      customers: [],
      segments: customerSegments.map(s => ({ id: s.id, name: s.name || "" })),
    },
  };
};

