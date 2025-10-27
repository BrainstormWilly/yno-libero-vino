/**
 * Commerce7 Install Payload
 * Received when a user installs the app in Commerce7
 */
export type Commerce7InstallPayload = {
  tenantId: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  "organization-name"?: string;
  "organization-address"?: string;
  "organization-website"?: string;
  "organization-phone"?: string;
};

/**
 * Commerce7 Auth Query Params
 * Received when Commerce7 redirects to our app after install
 */
export type Commerce7AuthParams = {
  tenantId: string;
  account: string;
  adminUITheme?: string;
};

/**
 * ============================================
 * Commerce7 Club (Tier) Types
 * ============================================
 * C7 Clubs represent our LiberoVino tiers
 * Each tier (Bronze, Silver, Gold) gets its own C7 Club
 */

export type C7ClubType = "Traditional" | "Subscription";
export type C7ClubStatus = "Available" | "Not Available";

export interface C7ClubCreateRequest {
  title: string;                    // Tier name (e.g., "Bronze Member")
  slug: string;                     // URL-friendly slug
  type: C7ClubType;                 // Always "Traditional"
  seo: {
    title: string;
    description?: string | null;
  };
  webStatus: C7ClubStatus;          // Always "Not Available"
  adminStatus: C7ClubStatus;        // Always "Not Available"
}

export interface C7Club {
  id: string;
  title: string;
  type: C7ClubType;
  content: string | null;
  publishDate: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  seo: {
    title: string;
    description: string | null;
  };
}

/**
 * ============================================
 * Commerce7 Promotion Types
 * ============================================
 * Promotions auto-apply discounts (unlike coupons)
 * Linked to clubs via availableTo + availableToObjectIds
 */

export type C7PromotionAppliesTo = "Store" | "Product" | "Collection";
export type C7PromotionAvailableTo = "Everyone" | "Club" | "Customer";
export type C7PromotionDiscountType = "Percentage Off" | "Dollar Off" | "No Discount";
export type C7PromotionUsageLimitType = "Unlimited" | "Limited";
export type C7PromotionStatus = "Enabled" | "Disabled";

export interface C7PromotionCreateRequest {
  title: string;                              // e.g., "Bronze Member Discount"
  actionMessage?: string | null;              // Customer-facing message
  usageLimitType: C7PromotionUsageLimitType;  // "Unlimited"
  usageLimit?: number | null;                 // If Limited
  
  // Product discount
  appliesTo: C7PromotionAppliesTo;            // "Store" = all products
  appliesToObjectIds?: string[] | null;       // Product/collection IDs
  productDiscountType: C7PromotionDiscountType;
  productDiscount?: number | null;            // Discount value (need to verify format)
  
  // Shipping discount
  shippingDiscountType: C7PromotionDiscountType;
  shippingDiscount?: number | null;
  
  // Availability
  status: C7PromotionStatus;
  minimumCartAmount?: number | null;
  availableTo: C7PromotionAvailableTo;        // "Club"
  availableToObjectIds?: string[] | null;     // [clubId]
  
  // Timing
  startDate?: string | null;
  endDate?: string | null;
}

export interface C7Promotion {
  id: string;
  title: string;
  actionMessage: string | null;
  usageLimitType: C7PromotionUsageLimitType;
  usageLimit: number | null;
  appliesTo: C7PromotionAppliesTo;
  appliesToObjectIds: string[] | null;
  productDiscountType: C7PromotionDiscountType;
  productDiscount: number | null;
  shippingDiscountType: C7PromotionDiscountType;
  shippingDiscount: number | null;
  startDate: string | null;
  endDate: string | null;
  status: C7PromotionStatus;
  minimumCartAmount: number | null;
  availableTo: C7PromotionAvailableTo;
  availableToObjectIds: string[] | null;
  promotionSets: Array<{ id: string }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * ============================================
 * Commerce7 Promotion Set Types
 * ============================================
 * Promotion Sets group multiple discounts to apply together
 * Without a set, only the highest value discount applies
 */

export interface C7PromotionSetCreateRequest {
  title: string;                              // e.g., "Silver Tier Benefits"
}

export interface C7PromotionSet {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  coupons: any[];                             // Coupon objects (if any)
  promotions: any[];                          // Promotion objects (if any)
}

/**
 * ============================================
 * Commerce7 Loyalty Tier Types
 * ============================================
 * Loyalty is an EXTENSION - must be activated by tenant
 * 
 * Two qualification types:
 * - "Lifetime Value": Customer auto-promoted based on total spend
 * - "Club": Customer gets tier automatically when joining specific club(s)
 * 
 * For LiberoVino: Use "Club" type, 1-to-1 with club tier
 */

export type C7LoyaltyQualificationType = "Lifetime Value" | "Club";

export interface C7LoyaltyTierCreateRequest {
  title: string;                              // e.g., "Silver Rewards"
  qualificationType: C7LoyaltyQualificationType;
  earnRate: number;                           // Decimal: 0.01 = 1%, 0.02 = 2%
  sortOrder?: number;                         // Display order
  
  // Only for "Lifetime Value" type
  lifetimeValueToQualify?: number;            // Dollar amount (50000 = $500.00)
  
  // Only for "Club" type - array of club IDs
  clubsToQualify?: Array<{ id: string }>;
  
  // NOTE: isBaseTier is read-only, cannot be set
}

export interface C7LoyaltyTier {
  id: string;
  title: string;
  isBaseTier: boolean;                        // Read-only, auto-determined by C7
  qualificationType: C7LoyaltyQualificationType;
  earnRate: number;                           // Decimal: 0.01 = 1%
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  
  // Only present if "Lifetime Value" type
  lifetimeValueToQualify?: number;
  
  // Only present if "Club" type (returns full club objects!)
  clubsToQualify?: Array<C7Club>;
}

/**
 * ============================================
 * Commerce7 Loyalty Transaction Types
 * ============================================
 * For manual point adjustments (bonus points, etc.)
 * 
 * Use Case: Preload welcome bonus points when customer joins premium tier
 * Example: Customer joins Gold tier → add 1000 bonus points
 */

export type C7LoyaltyTransactionType = "Manual" | "Order" | "Redemption";

export interface C7LoyaltyTransactionCreateRequest {
  customerId: string;
  amount: number;                             // Positive = add, negative = remove
  notes?: string;                             // e.g., "Gold Tier Welcome Bonus"
}

export interface C7LoyaltyTransaction {
  id: string;
  customerId: string;
  transactionDate: string;
  transactionType: C7LoyaltyTransactionType;
  orderId: string | null;
  orderNumber: string | null;
  transactionDetails: string;                 // Auto-generated by C7
  notes: string | null;
  amount: number;
  amountRedeemed: number | null;
  createdAt: string;
  updatedAt: string;
  customer?: any;                             // Full customer object in response
}

// Re-export unified discount types
export * from "./discount";
export * from "./discount-commerce7";
export * from "./discount-shopify";
export * from "./tag";
