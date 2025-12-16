/**
 * Shopify-specific discount conversions
 * Converts between unified Discount type and Shopify Discount API format
 */

import type { Discount, DiscountStatus, DiscountMinimumRequirement } from "./discount";

/**
 * Shopify Discount API types (based on yno-neighborly-s)
 */
export type ShopifyMoney = {
  amount: string;
  currencyCode?: string;
};

export enum ShopifyDiscountStatus {
  ACTIVE = "ACTIVE",
  EXPIRED = "EXPIRED",
  SCHEDULED = "SCHEDULED",
}

/**
 * Shopify Discount Items Input
 */
export type ShopifyDiscountItemsInput = {
  all?: boolean;
  collections?: {
    add?: string[];
    remove?: string[];
  };
  products?: {
    productsToAdd?: string[];
    productsToRemove?: string[];
    productVariantsToAdd?: string[];
    productVariantsToRemove?: string[];
  };
};

/**
 * Shopify Customer Selection Input
 */
export type ShopifyCustomerSelectionInput = {
  all: boolean;
  customerSegments?: {
    add?: string[];
    remove?: string[];
  };
  customers?: {
    add?: string[];
    remove?: string[];
  };
};

/**
 * Shopify Minimum Requirement Input
 */
export type ShopifyMinimumRequirementInput = {
  quantity?: {
    greaterThanOrEqualToQuantity: string;
  };
  subtotal?: {
    greaterThanOrEqualToSubtotal: number;
  };
};

/**
 * Shopify Customer Gets Value Input
 */
export type ShopifyCustomerGetsValueInput = {
  discountAmount?: {
    amount: number;
    appliesOnEachItem: boolean;
  };
  percentage?: number; // 0-1 (e.g., 0.15 for 15%)
};

/**
 * Shopify Customer Gets Input
 */
export type ShopifyCustomerGetsInput = {
  items: ShopifyDiscountItemsInput;
  value: ShopifyCustomerGetsValueInput;
};

/**
 * Shopify Combines With Input
 */
export type ShopifyCombinesWithInput = {
  orderDiscounts: boolean;
  productDiscounts: boolean;
  shippingDiscounts?: boolean;
};

/**
 * Shopify Discount Code Input (for creating/updating)
 */
export type ShopifyDiscountCodeInput = {
  appliesOncePerCustomer: boolean;
  code: string;
  combinesWith?: ShopifyCombinesWithInput;
  customerGets: ShopifyCustomerGetsInput;
  customerSelection: ShopifyCustomerSelectionInput;
  endsAt: string | null;
  minimumRequirement?: ShopifyMinimumRequirementInput;
  startsAt: string;
  title: string;
  usageLimit: number | null;
};

/**
 * Convert unified DiscountStatus to Shopify status
 * Note: Discounts never expire, so no EXPIRED status
 */
const toShopifyStatus = (status: DiscountStatus, startsAt: Date): ShopifyDiscountStatus => {
  const now = new Date();
  
  if (startsAt > now) {
    return ShopifyDiscountStatus.SCHEDULED;
  }
  
  return status === "active" ? ShopifyDiscountStatus.ACTIVE : ShopifyDiscountStatus.SCHEDULED;
};

/**
 * Convert Shopify status to unified DiscountStatus
 */
const fromShopifyStatus = (status: ShopifyDiscountStatus): DiscountStatus => {
  switch (status) {
    case ShopifyDiscountStatus.ACTIVE:
      return "active";
    case ShopifyDiscountStatus.EXPIRED:
      return "inactive" as DiscountStatus; // DiscountStatus doesn't include "expired", use "inactive"
    case ShopifyDiscountStatus.SCHEDULED:
      return "scheduled";
    default:
      return "inactive";
  }
};

/**
 * Convert unified Discount to Shopify Discount Code Input
 */
export const toShopifyDiscount = (discount: Discount): ShopifyDiscountCodeInput => {
  // Build items input
  const items: ShopifyDiscountItemsInput = {
    all: discount.appliesTo.scope === "all" || discount.appliesTo.all === true,
  };

  if (discount.appliesTo.collections.length > 0) {
    items.collections = {
      add: discount.appliesTo.collections.map(c => c.id),
    };
  }

  if (discount.appliesTo.products.length > 0) {
    items.products = {
      productsToAdd: discount.appliesTo.products.map(p => p.id),
    };
  }

  // Build customer selection
  const customerSelection: ShopifyCustomerSelectionInput = {
    all: discount.customerSelection?.all || false,
  };

  if (discount.customerSelection?.segments && discount.customerSelection.segments.length > 0) {
    customerSelection.customerSegments = {
      add: discount.customerSelection.segments.map((s: any) => s.id),
    };
  }

  if (discount.customerSelection?.customers && discount.customerSelection.customers.length > 0) {
    customerSelection.customers = {
      add: discount.customerSelection.customers.map((c: any) => c.id),
    };
  }

  // Build minimum requirement
  let minimumRequirement: ShopifyMinimumRequirementInput | undefined;
  
  if (discount.minimumRequirement.type === "quantity" && discount.minimumRequirement.quantity) {
    minimumRequirement = {
      quantity: {
        greaterThanOrEqualToQuantity: discount.minimumRequirement.quantity.toString(),
      },
    };
  } else if (discount.minimumRequirement.type === "amount" && discount.minimumRequirement.amount) {
    minimumRequirement = {
      subtotal: {
        // Shopify expects amount in dollars, convert from cents
        greaterThanOrEqualToSubtotal: discount.minimumRequirement.amount / 100,
      },
    };
  }

  // Build customer gets value
  const value: ShopifyCustomerGetsValueInput = {};
  
  if (discount.value.type === "percentage" && discount.value.percentage !== undefined) {
    // Convert percentage from 0-100 to 0-1
    value.percentage = discount.value.percentage / 100;
  } else if (discount.value.type === "fixed-amount" && discount.value.amount !== undefined) {
    value.discountAmount = {
      // Shopify expects amount in dollars, convert from cents
      amount: discount.value.amount / 100,
      appliesOnEachItem: false,
    };
  }

  const input: ShopifyDiscountCodeInput = {
    appliesOncePerCustomer: (discount as any).usageLimits?.appliesOncePerCustomer || false,
    code: discount.code || "",
    combinesWith: (discount as any).combinesWith || {
      orderDiscounts: false,
      productDiscounts: false,
      shippingDiscounts: false,
    },
    customerGets: {
      items,
      value,
    },
    customerSelection,
    endsAt: null, // Discounts never expire
    minimumRequirement,
    startsAt: discount.startsAt.toISOString(),
    title: discount.title,
    usageLimit: (discount as any).usageLimits?.total || null,
  };

  return input;
};

/**
 * Shopify Discount Output (what we receive from API)
 */
export type ShopifyDiscountOutput = {
  discountId: string;
  appliesOncePerCustomer: boolean;
  asyncUsageCount: number;
  codes: {
    nodes: { code: string }[];
  };
  codesCount: number;
  combinesWith?: ShopifyCombinesWithInput;
  createdAt: string;
  customerGets: {
    items: ShopifyDiscountItemsOutput;
    value: ShopifyCustomerGetsValueOutput;
  };
  customerSelection: ShopifyCustomerSelectionOutput;
  endsAt: string | null;
  minimumRequirement?: ShopifyMinimumRequirementOutput;
  startsAt: string;
  status: ShopifyDiscountStatus;
  title: string;
  totalSales: ShopifyMoney;
  updatedAt: string;
  usageLimit: number | null;
};

/**
 * Shopify Discount Items Output
 */
export type ShopifyDiscountItemsOutput = {
  allItems?: boolean;
  collections?: {
    nodes: { id: string; title: string }[];
  };
  products?: {
    nodes: { id: string; title: string }[];
  };
  productVariants?: {
    nodes: { id: string; title: string }[];
  };
};

/**
 * Shopify Customer Gets Value Output
 */
export type ShopifyCustomerGetsValueOutput = {
  amount?: ShopifyMoney;
  appliesOnEachItem?: boolean;
  percentage?: number; // 0-1
};

/**
 * Shopify Customer Selection Output
 */
export type ShopifyCustomerSelectionOutput = {
  allCustomers?: boolean;
  segments?: {
    nodes: { id: string; name: string }[];
  };
  customers?: {
    nodes: { id: string; email: string; displayName: string }[];
  };
};

/**
 * Shopify Minimum Requirement Output
 */
export type ShopifyMinimumRequirementOutput = {
  greaterThanOrEqualToQuantity?: number;
  greaterThanOrEqualToSubtotal?: ShopifyMoney;
};

/**
 * Convert Shopify Discount Output to unified Discount
 */
export const fromShopifyDiscount = (shopifyDiscount: ShopifyDiscountOutput): Discount => {
  // Parse items
  const items = shopifyDiscount.customerGets.items;
  const appliesTo = {
    all: items.allItems || false,
    products: items.products?.nodes.map(p => ({ id: p.id, title: p.title })) || [],
    collections: items.collections?.nodes.map(c => ({ id: c.id, title: c.title })) || [],
  };

  // Parse customer selection
  const selection = shopifyDiscount.customerSelection || {};
  const customerSelection = {
    all: selection.allCustomers || false,
    customers: selection.customers?.nodes?.map((c: any) => ({
      id: c.id,
    })) || [],
    segments: selection.segments?.nodes?.map((s: any) => ({ id: s.id, name: s.name || "" })) || [],
  };

  // Parse minimum requirement
  let minimumRequirement: DiscountMinimumRequirement;
  
  if (shopifyDiscount.minimumRequirement?.greaterThanOrEqualToQuantity) {
    minimumRequirement = {
      type: "quantity" as const,
      quantity: shopifyDiscount.minimumRequirement.greaterThanOrEqualToQuantity,
    };
  } else if (shopifyDiscount.minimumRequirement?.greaterThanOrEqualToSubtotal) {
    minimumRequirement = {
      type: "amount" as const,
      // Convert dollars to cents
      amount: parseFloat(shopifyDiscount.minimumRequirement.greaterThanOrEqualToSubtotal.amount) * 100,
    };
  } else {
    minimumRequirement = {
      type: "none" as const,
    };
  }

  // Parse discount value
  const valueOutput = shopifyDiscount.customerGets.value;
  const value = {
    type: valueOutput.percentage !== undefined ? "percentage" as const : "fixed-amount" as const,
    // Convert from 0-1 to 0-100
    percentage: valueOutput.percentage !== undefined ? valueOutput.percentage * 100 : undefined,
    // Convert dollars to cents
    amount: valueOutput.amount ? parseFloat(valueOutput.amount.amount) * 100 : undefined,
  };

  // Parse customer segments from customer selection
  const customerSegments = customerSelection.segments.map(s => ({ id: s.id, name: s.name || "" }));

  // Extract appliesTo values
  const appliesToAll = appliesTo.all;
  const appliesToProducts = appliesTo.products;
  const appliesToCollections = appliesTo.collections;

  return {
    id: shopifyDiscount.discountId,
    code: shopifyDiscount.codes.nodes[0]?.code || "",
    title: shopifyDiscount.title,
    platform: "shopify",
    status: fromShopifyStatus(shopifyDiscount.status),
    startsAt: new Date(shopifyDiscount.startsAt),
    // No endsAt - discounts never expire
    value,
    appliesTo: {
      target: "product", // Default to product, could be shipping
      scope: appliesToAll ? "all" : "specific",
      products: appliesToProducts,
      collections: appliesToCollections,
      all: appliesToAll,
    },
    customerSegments,
    minimumRequirement,
    customerSelection: {
      all: customerSelection.all,
      customers: customerSelection.customers.map(c => ({ id: c.id })),
      segments: customerSegments,
    },
    createdAt: new Date(shopifyDiscount.createdAt),
    updatedAt: new Date(shopifyDiscount.updatedAt),
    // Legacy fields stored in platformData
    platformData: {
      usageLimits: {
        total: shopifyDiscount.usageLimit,
        perCustomer: shopifyDiscount.appliesOncePerCustomer ? 1 : null,
        appliesOncePerCustomer: shopifyDiscount.appliesOncePerCustomer,
      },
      combinesWith: shopifyDiscount.combinesWith || {
        productDiscounts: false,
        orderDiscounts: false,
        shippingDiscounts: false,
      },
      usageCount: shopifyDiscount.asyncUsageCount,
    },
  };
};

