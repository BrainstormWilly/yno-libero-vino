/**
 * Commerce7-specific discount conversions
 * Converts between unified Discount type and Commerce7 Promotion API format
 * 
 * Note: This is for PROMOTIONS (auto-apply), not coupons (with codes)
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

