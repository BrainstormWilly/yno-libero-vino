/**
 * Commerce7-specific discount conversions
 * Converts between unified Discount type and Commerce7 Coupon API format
 */

import type { Discount, DiscountStatus } from "./discount";

/**
 * Commerce7 Coupon API types (based on yno-neighborly)
 */
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

/**
 * Commerce7 Coupon API payload
 */
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
  endDate: string | null; // ISO string
  excludeObjectIds?: string[];
  excludes: C7AppliesTo | null;
  id?: string;
  startDate: string; // ISO string
  status: C7CouponStatus;
  title: string;
  type: "Product" | "Shipping";
  usageLimit: number | null;
  usageLimitType: C7UsageLimitType;
};

/**
 * Convert unified DiscountStatus to C7 status
 */
const toC7Status = (status: DiscountStatus): C7CouponStatus => {
  return status === "active" ? C7CouponStatus.ENABLED : C7CouponStatus.DISABLED;
};

/**
 * Convert C7 status to unified DiscountStatus
 */
const fromC7Status = (status: C7CouponStatus): DiscountStatus => {
  return status === C7CouponStatus.ENABLED ? "active" : "inactive";
};

/**
 * Convert unified Discount to Commerce7 Coupon payload
 */
export const toC7Coupon = (discount: Discount): C7CouponPayload => {
  // Determine applies to
  let appliesTo: C7AppliesTo;
  let appliesToObjectIds: string | string[];
  
  if (discount.appliesTo.all) {
    appliesTo = C7AppliesTo.NONE;
    appliesToObjectIds = "";
  } else if (discount.appliesTo.collections.length > 0) {
    appliesTo = C7AppliesTo.COLLECTION;
    appliesToObjectIds = discount.appliesTo.collections.map(c => c.id);
  } else if (discount.appliesTo.products.length > 0) {
    appliesTo = C7AppliesTo.PRODUCT;
    appliesToObjectIds = discount.appliesTo.products.map(p => p.id);
  } else {
    appliesTo = C7AppliesTo.NONE;
    appliesToObjectIds = "";
  }

  // Determine available to
  let availableTo: C7AvailableTo;
  let availableToObjectIds: string | string[];
  
  if (discount.customerSelection.all) {
    availableTo = C7AvailableTo.EVERYONE;
    availableToObjectIds = "";
  } else if (discount.customerSelection.segments.length > 0) {
    availableTo = C7AvailableTo.TAG;
    availableToObjectIds = discount.customerSelection.segments.map(s => s.id);
  } else if (discount.customerSelection.customers.length > 0) {
    // C7 doesn't support individual customer selection well, use tags
    availableTo = C7AvailableTo.TAG;
    availableToObjectIds = discount.customerSelection.customers.map(c => c.id);
  } else {
    availableTo = C7AvailableTo.EVERYONE;
    availableToObjectIds = "";
  }

  // Determine cart requirement
  let cartRequirementType: C7CartRequirementType;
  let cartRequirement: number | null;
  
  switch (discount.minimumRequirement.type) {
    case "quantity":
      cartRequirementType = C7CartRequirementType.MINIMUM_QUANTITY;
      cartRequirement = discount.minimumRequirement.quantity || null;
      break;
    case "amount":
      cartRequirementType = C7CartRequirementType.MINIMUM_PURCHASE;
      // C7 expects dollar amount, convert from cents
      cartRequirement = discount.minimumRequirement.amount 
        ? discount.minimumRequirement.amount / 100 
        : null;
      break;
    default:
      cartRequirementType = C7CartRequirementType.NONE;
      cartRequirement = null;
  }

  // Determine usage limit
  let usageLimitType: C7UsageLimitType;
  let usageLimit: number | null;
  
  if (discount.usageLimits.appliesOncePerCustomer || discount.usageLimits.perCustomer) {
    usageLimitType = C7UsageLimitType.CUSTOMER;
    usageLimit = discount.usageLimits.perCustomer || 1;
  } else if (discount.usageLimits.total) {
    usageLimitType = C7UsageLimitType.STORE;
    usageLimit = discount.usageLimits.total;
  } else {
    usageLimitType = C7UsageLimitType.UNLIMITED;
    usageLimit = null;
  }

  // Convert discount value
  const discountType = discount.value.type === "percentage" 
    ? C7DiscountType.PERCENTAGE_OFF 
    : C7DiscountType.DOLLAR_OFF;
  
  const discountValue = discount.value.type === "percentage"
    ? (discount.value.percentage || 0)
    : ((discount.value.amount || 0) / 100); // Convert cents to dollars

  const payload: C7CouponPayload = {
    actionMessage: "", // C7 specific, could be added to platformData
    appliesTo,
    appliesToObjectIds,
    availableTo,
    availableToObjectIds,
    cartContainsObjectIds: null,
    cartContainsType: "Anything",
    cartRequirement,
    cartRequirementCountType: C7CartRequirementCountType.ALL_ITEMS,
    cartRequirementMaximum: null,
    cartRequirementType,
    code: discount.code,
    discount: discountValue,
    discountType,
    dollarOffDiscountApplies: "Items",
    endDate: null, // Discounts never expire
    excludes: null,
    startDate: discount.startsAt.toISOString(),
    status: toC7Status(discount.status),
    title: discount.title,
    type: "Product",
    usageLimit,
    usageLimitType,
  };

  // Include ID if updating existing coupon
  if (discount.id) {
    payload.id = discount.id;
  }

  return payload;
};

/**
 * Convert Commerce7 Coupon to unified Discount
 */
export const fromC7Coupon = (coupon: C7CouponPayload): Discount => {
  // Parse applies to
  const appliesTo = {
    all: coupon.appliesTo === C7AppliesTo.NONE,
    products: coupon.appliesTo === C7AppliesTo.PRODUCT
      ? (Array.isArray(coupon.appliesToObjectIds) 
          ? coupon.appliesToObjectIds.map(id => ({ id }))
          : coupon.appliesToObjectIds ? [{ id: coupon.appliesToObjectIds }] : [])
      : [],
    collections: coupon.appliesTo === C7AppliesTo.COLLECTION
      ? (Array.isArray(coupon.appliesToObjectIds)
          ? coupon.appliesToObjectIds.map(id => ({ id }))
          : coupon.appliesToObjectIds ? [{ id: coupon.appliesToObjectIds }] : [])
      : [],
  };

  // Parse customer selection
  const customerSelection = {
    all: coupon.availableTo === C7AvailableTo.EVERYONE,
    customers: [],
    segments: coupon.availableTo === C7AvailableTo.TAG
      ? (Array.isArray(coupon.availableToObjectIds)
          ? coupon.availableToObjectIds.map(id => ({ id, name: "" }))
          : coupon.availableToObjectIds ? [{ id: coupon.availableToObjectIds, name: "" }] : [])
      : [],
  };

  // Parse minimum requirement
  let minimumRequirement = {
    type: "none" as const,
    quantity: undefined,
    amount: undefined,
  };
  
  if (coupon.cartRequirementType === C7CartRequirementType.MINIMUM_QUANTITY) {
    minimumRequirement = {
      type: "quantity",
      quantity: coupon.cartRequirement || undefined,
    };
  } else if (coupon.cartRequirementType === C7CartRequirementType.MINIMUM_PURCHASE) {
    minimumRequirement = {
      type: "amount",
      // Convert dollars to cents
      amount: coupon.cartRequirement ? coupon.cartRequirement * 100 : undefined,
    };
  }

  // Parse usage limits
  const usageLimits = {
    total: coupon.usageLimitType === C7UsageLimitType.STORE ? coupon.usageLimit : null,
    perCustomer: coupon.usageLimitType === C7UsageLimitType.CUSTOMER ? coupon.usageLimit : null,
    appliesOncePerCustomer: coupon.usageLimitType === C7UsageLimitType.CUSTOMER && coupon.usageLimit === 1,
  };

  // Parse discount value
  const value = {
    type: coupon.discountType === C7DiscountType.PERCENTAGE_OFF ? "percentage" as const : "fixed-amount" as const,
    percentage: coupon.discountType === C7DiscountType.PERCENTAGE_OFF ? coupon.discount : undefined,
    // Convert dollars to cents for fixed amount
    amount: coupon.discountType === C7DiscountType.DOLLAR_OFF ? coupon.discount * 100 : undefined,
  };

  return {
    id: coupon.id,
    code: coupon.code,
    title: coupon.title,
    platform: "commerce7",
    status: fromC7Status(coupon.status),
    startsAt: new Date(coupon.startDate),
    // No endsAt - discounts never expire
    value,
    appliesTo,
    customerSelection,
    minimumRequirement,
    usageLimits,
    combinesWith: {
      productDiscounts: false,
      orderDiscounts: false,
      shippingDiscounts: false,
    },
  };
};

