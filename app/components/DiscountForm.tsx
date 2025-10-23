import React, { useCallback, useState } from "react";
import {
  Card,
  FormLayout,
  TextField,
  Select,
  Button,
  ButtonGroup,
  Text,
  BlockStack,
  InlineStack,
  Divider,
} from "@shopify/polaris";
import type { Discount, DiscountValueType, MinimumRequirementType } from "~/types/discount";

interface DiscountFormProps {
  discount: Discount;
  onChangeDiscount: (discount: Discount) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel?: string;
  cancelLabel?: string;
}

export default function DiscountForm({
  discount,
  onChangeDiscount,
  onSubmit,
  onCancel,
  submitLabel = "Save Discount",
  cancelLabel = "Cancel",
}: DiscountFormProps) {
  const [codeError, setCodeError] = useState<string>();
  const [titleError, setTitleError] = useState<string>();
  const [valueError, setValueError] = useState<string>();

  // Handle code change
  const handleCodeChange = useCallback(
    (value: string) => {
      const upperValue = value.toUpperCase().replace(/\s/g, "");
      onChangeDiscount({
        ...discount,
        code: upperValue,
      });
      if (upperValue.length > 0) {
        setCodeError(undefined);
      }
    },
    [discount, onChangeDiscount]
  );

  // Handle title change
  const handleTitleChange = useCallback(
    (value: string) => {
      onChangeDiscount({
        ...discount,
        title: value,
      });
      if (value.length > 0) {
        setTitleError(undefined);
      }
    },
    [discount, onChangeDiscount]
  );

  // Handle discount type change (percentage vs fixed-amount)
  const handleDiscountTypeChange = useCallback(
    (value: string) => {
      const newType = value as DiscountValueType;
      onChangeDiscount({
        ...discount,
        value: {
          type: newType,
          percentage: newType === "percentage" ? discount.value.percentage || 0 : undefined,
          amount: newType === "fixed-amount" ? discount.value.amount || 0 : undefined,
        },
      });
    },
    [discount, onChangeDiscount]
  );

  // Handle discount value change
  const handleDiscountValueChange = useCallback(
    (value: string) => {
      const numValue = parseFloat(value) || 0;
      
      if (discount.value.type === "percentage") {
        onChangeDiscount({
          ...discount,
          value: {
            ...discount.value,
            percentage: numValue,
          },
        });
      } else {
        // Convert dollars to cents
        onChangeDiscount({
          ...discount,
          value: {
            ...discount.value,
            amount: Math.round(numValue * 100),
          },
        });
      }
      
      if (numValue > 0) {
        setValueError(undefined);
      }
    },
    [discount, onChangeDiscount]
  );

  // Handle minimum requirement type change
  const handleMinRequirementTypeChange = useCallback(
    (value: string) => {
      const newType = value as MinimumRequirementType;
      onChangeDiscount({
        ...discount,
        minimumRequirement: {
          type: newType,
          quantity: newType === "quantity" ? 1 : undefined,
          amount: newType === "amount" ? 0 : undefined,
        },
      });
    },
    [discount, onChangeDiscount]
  );

  // Handle minimum quantity change
  const handleMinQuantityChange = useCallback(
    (value: string) => {
      const numValue = parseInt(value) || 0;
      onChangeDiscount({
        ...discount,
        minimumRequirement: {
          ...discount.minimumRequirement,
          quantity: numValue,
        },
      });
    },
    [discount, onChangeDiscount]
  );

  // Handle minimum amount change
  const handleMinAmountChange = useCallback(
    (value: string) => {
      const numValue = parseFloat(value) || 0;
      // Convert dollars to cents
      onChangeDiscount({
        ...discount,
        minimumRequirement: {
          ...discount.minimumRequirement,
          amount: Math.round(numValue * 100),
        },
      });
    },
    [discount, onChangeDiscount]
  );

  // Validate form
  const validateForm = () => {
    let isValid = true;

    if (!discount.code || discount.code.length === 0) {
      setCodeError("Discount code is required");
      isValid = false;
    }

    if (!discount.title || discount.title.length === 0) {
      setTitleError("Discount title is required");
      isValid = false;
    }

    const value = discount.value.type === "percentage" 
      ? discount.value.percentage 
      : discount.value.amount;
    
    if (!value || value <= 0) {
      setValueError("Discount value must be greater than 0");
      isValid = false;
    }

    if (discount.value.type === "percentage" && discount.value.percentage! > 100) {
      setValueError("Percentage cannot exceed 100%");
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit();
    }
  };

  // Get display value for discount amount
  const getDiscountValue = () => {
    if (discount.value.type === "percentage") {
      return discount.value.percentage?.toString() || "0";
    } else {
      // Convert cents to dollars
      return ((discount.value.amount || 0) / 100).toFixed(2);
    }
  };

  // Get display value for minimum amount
  const getMinAmountValue = () => {
    return ((discount.minimumRequirement.amount || 0) / 100).toFixed(2);
  };

  const discountTypeOptions = [
    { label: "Percentage Off", value: "percentage" },
    { label: "Fixed Amount Off", value: "fixed-amount" },
  ];

  const minRequirementOptions = [
    { label: "No minimum requirement", value: "none" },
    { label: "Minimum purchase amount", value: "amount" },
    { label: "Minimum quantity of items", value: "quantity" },
  ];

  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Basic Information
          </Text>
          
          <FormLayout>
            <FormLayout.Group>
              <TextField
                label="Discount Code"
                value={discount.code}
                onChange={handleCodeChange}
                placeholder="SUMMER15"
                helpText="Code customers will use at checkout (automatically uppercase)"
                autoComplete="off"
                error={codeError}
                requiredIndicator
              />

              <TextField
                label="Internal Title"
                value={discount.title}
                onChange={handleTitleChange}
                placeholder="Summer Sale 15% Off"
                helpText="Internal name for this discount (not shown to customers)"
                autoComplete="off"
                error={titleError}
                requiredIndicator
              />
            </FormLayout.Group>
          </FormLayout>
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Discount Value
          </Text>

          <FormLayout>
            <FormLayout.Group>
              <Select
                label="Discount Type"
                options={discountTypeOptions}
                value={discount.value.type}
                onChange={handleDiscountTypeChange}
              />

              <TextField
                label="Discount Amount"
                type="number"
                value={getDiscountValue()}
                onChange={handleDiscountValueChange}
                prefix={discount.value.type === "fixed-amount" ? "$" : undefined}
                suffix={discount.value.type === "percentage" ? "%" : undefined}
                placeholder={discount.value.type === "percentage" ? "15" : "10.00"}
                min="0"
                max={discount.value.type === "percentage" ? "100" : undefined}
                step={discount.value.type === "percentage" ? "1" : "0.01"}
                autoComplete="off"
                error={valueError}
                requiredIndicator
              />
            </FormLayout.Group>
          </FormLayout>
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Minimum Requirements
          </Text>

          <FormLayout>
            <Select
              label="Minimum purchase requirement"
              options={minRequirementOptions}
              value={discount.minimumRequirement.type}
              onChange={handleMinRequirementTypeChange}
            />

            {discount.minimumRequirement.type === "amount" && (
              <TextField
                label="Minimum purchase amount"
                type="number"
                value={getMinAmountValue()}
                onChange={handleMinAmountChange}
                prefix="$"
                placeholder="50.00"
                min="0"
                step="0.01"
                autoComplete="off"
                helpText="Minimum order subtotal required to use this discount"
              />
            )}

            {discount.minimumRequirement.type === "quantity" && (
              <TextField
                label="Minimum quantity of items"
                type="number"
                value={discount.minimumRequirement.quantity?.toString() || "1"}
                onChange={handleMinQuantityChange}
                placeholder="1"
                min="1"
                step="1"
                autoComplete="off"
                helpText="Minimum number of items required to use this discount"
              />
            )}
          </FormLayout>
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Products & Collections
          </Text>

          <Text as="p" variant="bodyMd" tone="subdued">
            Products and collections can be configured after creating the discount.
            {discount.appliesTo.all && " Currently applies to all products."}
            {discount.appliesTo.products.length > 0 && 
              ` Currently applies to ${discount.appliesTo.products.length} product(s).`}
            {discount.appliesTo.collections.length > 0 && 
              ` Currently applies to ${discount.appliesTo.collections.length} collection(s).`}
          </Text>
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Customer Eligibility
          </Text>

          <Text as="p" variant="bodyMd" tone="subdued">
            Customers will be added to this discount as they join tiers.
            {discount.customerSelection.all && " Currently available to all customers."}
            {discount.customerSelection.customers.length > 0 && 
              ` Currently available to ${discount.customerSelection.customers.length} customer(s).`}
            {discount.customerSelection.segments.length > 0 && 
              ` Currently available to ${discount.customerSelection.segments.length} segment(s).`}
          </Text>
        </BlockStack>
      </Card>

      <InlineStack align="end" gap="200">
        <Button onClick={onCancel}>{cancelLabel}</Button>
        <Button variant="primary" onClick={handleSubmit}>
          {submitLabel}
        </Button>
      </InlineStack>
    </BlockStack>
  );
}

