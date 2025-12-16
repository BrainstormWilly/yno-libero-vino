/**
 * Example usage component for DiscountForm
 * Shows how to integrate the discount form into a tier creation flow
 */

import React, { useCallback } from "react";
import { Page, Layout, Card, Text, BlockStack } from "@shopify/polaris";
import DiscountForm from "./DiscountForm";
import { useDiscount } from "~/hooks/useDiscount";
import type { PlatformType } from "~/types/discount";
import { toC7Coupon } from "~/types/discount-commerce7";
import { toShopifyDiscount } from "~/types/discount-shopify";

interface DiscountFormExampleProps {
  platform: PlatformType;
  onSave?: (discount: any) => void;
}

/**
 * Example component showing how to use DiscountForm in tier setup
 * 
 * Usage:
 * ```tsx
 * <DiscountFormExample 
 *   platform="commerce7" 
 *   onSave={(discount) => {
 *     // Send to API to create discount in Commerce7/Shopify
 *     createDiscount(discount);
 *   }}
 * />
 * ```
 */
export default function DiscountFormExample({ 
  platform,
  onSave 
}: DiscountFormExampleProps) {
  const { discount, setDiscount, resetDiscount } = useDiscount(platform);

  const handleSave = useCallback(() => {
    // Convert unified discount to platform-specific format
    if (platform === "commerce7") {
      const c7Coupon = toC7Coupon(discount);
      console.log("Commerce7 Coupon:", c7Coupon);
      onSave?.(c7Coupon);
    } else if (platform === "shopify") {
      const shopifyDiscount = toShopifyDiscount(discount);
      console.log("Shopify Discount:", shopifyDiscount);
      onSave?.(shopifyDiscount);
    }
  }, [discount, platform, onSave]);

  const handleCancel = useCallback(() => {
    resetDiscount();
  }, [resetDiscount]);

  return (
    <Page
      title="Create Tier Discount"
      subtitle={`Creating discount for ${platform === "commerce7" ? "Commerce7" : "Shopify"}`}
    >
      <Layout>
        <Layout.Section>
          <DiscountForm
            discount={discount}
            onChangeDiscount={setDiscount}
            onSubmit={handleSave}
            onCancel={handleCancel}
            submitLabel="Create Discount"
          />
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h3">
                Discount Preview
              </Text>
              <BlockStack gap="100">
                <Text as="p" variant="bodyMd">
                  <strong>Code:</strong> {discount.code || "(not set)"}
                </Text>
                <Text as="p" variant="bodyMd">
                  <strong>Title:</strong> {discount.title || "(not set)"}
                </Text>
                <Text as="p" variant="bodyMd">
                  <strong>Value:</strong>{" "}
                  {discount.value.type === "percentage"
                    ? `${discount.value.percentage || 0}% off`
                    : `$${((discount.value.amount || 0) / 100).toFixed(2)} off`}
                </Text>
                <Text as="p" variant="bodyMd">
                  <strong>Minimum:</strong>{" "}
                  {discount.minimumRequirement.type === "none"
                    ? "None"
                    : discount.minimumRequirement.type === "quantity"
                    ? `${discount.minimumRequirement.quantity} items`
                    : `$${((discount.minimumRequirement.amount || 0) / 100).toFixed(2)}`}
                </Text>
                <Text as="p" variant="bodyMd">
                  <strong>Platform:</strong> {platform}
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

