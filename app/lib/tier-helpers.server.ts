/**
 * Helper functions for tier/stage management
 * Handles tag and coupon creation with proper naming conventions
 */

import { Commerce7Provider } from "./crm/commerce7.server";
import { toC7Coupon } from "./discount-converters";
import { formatTagName, formatCouponTitle, formatCouponCode } from "./naming";
import type { Discount } from "~/types/discount";
import type { C7Tag } from "~/types/tag";

export type TierWithTagAndCoupon = {
  tagId: string;
  tagTitle: string;
  couponId: string;
  couponCode: string;
  couponTitle: string;
};

/**
 * Create a tag and coupon for a club tier
 * This is the primary function to use when setting up a new tier
 * 
 * @param provider - Commerce7 provider instance
 * @param tierName - Name of the tier (e.g., "Gold Tier")
 * @param discount - The discount configuration for this tier
 * @returns Object containing the created tag and coupon details
 */
export async function createTierTagAndCoupon(
  provider: Commerce7Provider,
  tierName: string,
  discount: Discount
): Promise<TierWithTagAndCoupon> {
  // 1. Create the customer tag with Yno prefix
  const tagTitle = formatTagName(tierName);
  const tag = await provider.createCustomerTag(tagTitle, "Manual");

  try {
    // 2. Apply naming conventions to the discount
    const discountWithNaming = {
      ...discount,
      title: formatCouponTitle(discount.title || tierName),
      code: formatCouponCode(discount.code || tierName),
      // Set customer selection to use the tag
      customerSelection: {
        all: false,
        customers: [],
        segments: [{ id: tag.id, name: tag.title }],
      },
    };

    // 3. Create the coupon with the tag applied
    const c7Coupon = toC7Coupon(discountWithNaming);
    const createdCoupon = await provider.createC7Coupon(c7Coupon);

    return {
      tagId: tag.id,
      tagTitle: tag.title,
      couponId: createdCoupon.id,
      couponCode: createdCoupon.code,
      couponTitle: createdCoupon.title,
    };
  } catch (error) {
    // If coupon creation fails, clean up the tag
    try {
      await provider.deleteTag(tag.id);
      console.error(`Failed to create coupon for tier ${tierName}, cleaned up tag ${tag.id}`);
    } catch (cleanupError) {
      console.error(`Failed to create coupon for tier ${tierName}, and failed to clean up tag ${tag.id}:`, cleanupError);
    }
    throw error;
  }
}

/**
 * Update a tier's coupon (tag remains the same)
 * 
 * @param provider - Commerce7 provider instance
 * @param tagId - The existing tag ID for this tier
 * @param discount - The updated discount configuration
 * @returns Updated coupon details
 */
export async function updateTierCoupon(
  provider: Commerce7Provider,
  couponId: string,
  tagId: string,
  tagTitle: string,
  discount: Discount
): Promise<{ couponId: string; couponCode: string; couponTitle: string }> {
  // Ensure the discount uses the tier's tag
  const discountWithTag = {
    ...discount,
    customerSelection: {
      all: false,
      customers: [],
      segments: [{ id: tagId, name: tagTitle }],
    },
  };

  const c7Coupon = toC7Coupon(discountWithTag);
  const updatedCoupon = await provider.updateC7Coupon(couponId, c7Coupon);

  return {
    couponId: updatedCoupon.id,
    couponCode: updatedCoupon.code,
    couponTitle: updatedCoupon.title,
  };
}

/**
 * Add a customer to a tier by applying the tier's tag
 * 
 * @param provider - Commerce7 provider instance
 * @param customerId - The customer's ID in Commerce7
 * @param tagId - The tier's tag ID
 */
export async function addCustomerToTier(
  provider: Commerce7Provider,
  customerId: string,
  tagId: string
): Promise<void> {
  await provider.tagCustomer(customerId, tagId);
}

/**
 * Remove a customer from a tier by removing the tier's tag
 * 
 * @param provider - Commerce7 provider instance
 * @param customerId - The customer's ID in Commerce7
 * @param tagId - The tier's tag ID
 */
export async function removeCustomerFromTier(
  provider: Commerce7Provider,
  customerId: string,
  tagId: string
): Promise<void> {
  await provider.untagCustomer(customerId, tagId);
}

/**
 * Sync/repair a tier's tag and coupon
 * Handles all edge cases where users may have deleted things in C7 admin
 * 
 * @param provider - Commerce7 provider instance
 * @param tierName - Name of the tier
 * @param discount - The discount configuration
 * @param existingTagId - The tag ID from database (may be invalid)
 * @param existingCouponId - The coupon ID from database (may be invalid)
 * @returns Object with current tag and coupon details
 */
export async function syncTierTagAndCoupon(
  provider: Commerce7Provider,
  tierName: string,
  discount: Discount,
  existingTagId?: string | null,
  existingCouponId?: string | null
): Promise<TierWithTagAndCoupon> {
  let tagId: string | null = null;
  let tagTitle: string | null = null;
  let couponId: string | null = null;

  // 1. Verify tag exists in C7
  if (existingTagId) {
    try {
      const tag = await provider.getTag(existingTagId);
      tagId = tag.id;
      tagTitle = tag.title;
      console.log(`✓ Found existing tag: ${tag.title}`);
    } catch (error) {
      console.warn(`Tag ${existingTagId} not found in C7, will create new one`);
      tagId = null;
    }
  }

  // 2. Create tag if it doesn't exist
  if (!tagId) {
    const formattedTagTitle = formatTagName(tierName);
    const newTag = await provider.createCustomerTag(formattedTagTitle, "Manual");
    tagId = newTag.id;
    tagTitle = newTag.title;
    console.log(`✓ Created new tag: ${newTag.title}`);
  }

  // 3. Verify coupon exists in C7
  if (existingCouponId) {
    try {
      // Try to get the coupon (this will throw if it doesn't exist)
      await provider.getDiscount(existingCouponId);
      couponId = existingCouponId;
      console.log(`✓ Found existing coupon: ${existingCouponId}`);
    } catch (error) {
      console.warn(`Coupon ${existingCouponId} not found in C7, will create new one`);
      couponId = null;
    }
  }

  // 4. Apply naming conventions and tag to discount
  const discountWithNaming = {
    ...discount,
    title: formatCouponTitle(discount.title || tierName),
    code: formatCouponCode(discount.code || tierName),
    customerSelection: {
      all: false,
      customers: [],
      segments: [{ id: tagId!, name: tagTitle! }],
    },
  };

  // 5. Update or create coupon
  if (couponId) {
    // Update existing coupon
    const c7Coupon = toC7Coupon(discountWithNaming);
    const updated = await provider.updateC7Coupon(couponId, c7Coupon);
    console.log(`✓ Updated existing coupon: ${updated.code}`);
    
    return {
      tagId: tagId!,
      tagTitle: tagTitle!,
      couponId: updated.id,
      couponCode: updated.code,
      couponTitle: updated.title,
    };
  } else {
    // Create new coupon
    const c7Coupon = toC7Coupon(discountWithNaming);
    const created = await provider.createC7Coupon(c7Coupon);
    console.log(`✓ Created new coupon: ${created.code}`);
    
    return {
      tagId: tagId!,
      tagTitle: tagTitle!,
      couponId: created.id,
      couponCode: created.code,
      couponTitle: created.title,
    };
  }
}

