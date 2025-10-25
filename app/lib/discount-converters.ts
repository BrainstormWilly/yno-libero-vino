/**
 * Discount Conversion Helpers
 * 
 * Converts our unified Discount type to platform-specific formats
 * for Commerce7 and Shopify
 */

import type { Discount } from '~/types/discount';

/**
 * Commerce7 Coupon Type (simplified for creation)
 */
export type C7CouponPayload = {
  code: string;
  title: string;
  type: "Product" | "Shipping";
  status: "Enabled" | "Disabled";
  startDate: string; // ISO string
  endDate: string | null;
  discount: number;
  discountType: "Percentage Off" | "Dollar Off";
  appliesTo: "Store" | "Product" | "Collection" | "Department";
  appliesToObjectIds: string | string[];
  availableTo: "Everyone" | "Tag";
  availableToObjectIds: string | string[];
  cartRequirementType: "None" | "Minimum Quantity" | "Minimum Purchase Amount";
  cartRequirement: number | null;
  cartRequirementCountType: "All Items" | "Only Items In Discount";
  cartRequirementMaximum: number | null;
  usageLimitType: "Unlimited" | "Per Store" | "Per Customer";
  usageLimit: number | null;
  dollarOffDiscountApplies: "Once Per Order" | "To Each Discounted Item";
  actionMessage: string;
  cartContainsType: "Anything";
  cartContainsObjectIds: null;
  excludes: null;
  excludeObjectIds?: string[];
};

/**
 * Convert unified Discount to Commerce7 Coupon payload
 */
export function toC7Coupon(discount: Discount): C7CouponPayload {
  // Determine appliesTo and appliesToObjectIds
  let appliesTo: "Store" | "Product" | "Collection" | "Department" = "Store";
  let appliesToObjectIds: string | string[] = "";
  
  if (!discount.appliesTo.all) {
    if (discount.appliesTo.products.length > 0) {
      appliesTo = "Product";
      appliesToObjectIds = discount.appliesTo.products.map(p => p.id);
    } else if (discount.appliesTo.collections.length > 0) {
      appliesTo = "Collection";
      appliesToObjectIds = discount.appliesTo.collections.map(c => c.id);
    }
  }
  
  // Determine customer availability
  let availableTo: "Everyone" | "Tag" = "Everyone";
  let availableToObjectIds: string | string[] = "";
  
  if (!discount.customerSelection.all) {
    if (discount.customerSelection.segments.length > 0) {
      availableTo = "Tag";
      availableToObjectIds = discount.customerSelection.segments.map(s => s.id);
    } else if (discount.customerSelection.customers.length > 0) {
      // C7 doesn't have "specific customers", so we'll use Tags
      // This would require creating a tag for these customers
      availableTo = "Tag";
      availableToObjectIds = []; // TODO: Create tag for specific customers
    }
  }
  
  // Determine cart requirements
  let cartRequirementType: "None" | "Minimum Quantity" | "Minimum Purchase Amount" = "None";
  let cartRequirement: number | null = null;
  
  if (discount.minimumRequirement.type === "amount") {
    cartRequirementType = "Minimum Purchase Amount";
    cartRequirement = (discount.minimumRequirement.amount || 0) / 100; // Convert cents to dollars
  } else if (discount.minimumRequirement.type === "quantity") {
    cartRequirementType = "Minimum Quantity";
    cartRequirement = discount.minimumRequirement.quantity || null;
  }
  
  // Determine usage limits
  let usageLimitType: "Unlimited" | "Per Store" | "Per Customer" = "Unlimited";
  let usageLimit: number | null = null;
  
  if (discount.usageLimits.total !== null) {
    usageLimitType = "Per Store";
    usageLimit = discount.usageLimits.total;
  } else if (discount.usageLimits.perCustomer !== null) {
    usageLimitType = "Per Customer";
    usageLimit = discount.usageLimits.perCustomer;
  }
  
  // Discount value
  // C7 stores ALL numbers as integers * 100 (like cents)
  // 10% -> 1000, $10.50 -> 1050
  const isPercentage = discount.value.type === "percentage";
  const discountValue = isPercentage 
    ? (discount.value.percentage || 0) * 100 // Percentage: 10 -> 1000
    : (discount.value.amount || 0); // Already in cents
  
  return {
    code: discount.code,
    title: discount.title,
    type: "Product",
    status: discount.status === "active" ? "Enabled" : "Disabled",
    startDate: discount.startsAt.toISOString(),
    endDate: null, // We don't use end dates per requirements
    discount: discountValue,
    discountType: isPercentage ? "Percentage Off" : "Dollar Off",
    appliesTo,
    appliesToObjectIds,
    availableTo,
    availableToObjectIds,
    cartRequirementType,
    cartRequirement,
    cartRequirementCountType: "All Items",
    cartRequirementMaximum: null,
    usageLimitType,
    usageLimit,
    dollarOffDiscountApplies: "Once Per Order",
    actionMessage: "",
    cartContainsType: "Anything",
    cartContainsObjectIds: null,
    excludes: null,
    excludeObjectIds: undefined,
  };
}

/**
 * Convert Commerce7 coupon response back to unified Discount
 * NOTE: The full implementation is in ~/types/discount-commerce7.ts
 * This file only contains the simpler toC7Coupon for creating coupons
 */
// Removed - use fromC7Coupon from ~/types/discount-commerce7.ts instead

/**
 * Convert unified Discount to Shopify Discount payload
 * TODO: Implement when adding Shopify support
 */
export function toShopifyDiscount(discount: Discount): any {
  throw new Error("Shopify discount conversion not yet implemented");
}

/**
 * Convert Shopify discount response back to unified Discount
 * TODO: Implement when adding Shopify support
 */
export function fromShopifyDiscount(shopifyDiscount: any): Partial<Discount> {
  throw new Error("Shopify discount conversion not yet implemented");
}

