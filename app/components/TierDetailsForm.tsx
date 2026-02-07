import {
  TextField,
  Checkbox,
  Select,
  Button,
  Text,
  BlockStack,
  InlineStack,
  Box,
} from '@shopify/polaris';

interface TierDetailsFormProps {
  // Form values
  tierName: string;
  durationMonths: string;
  minLtvAmount: string;
  upgradable: boolean;
  initialQualificationAllowed: boolean;
  minPurchaseOverride: string;
  calculatedMinPurchase: string;
  tierType?: string;
  
  // Change handlers
  onTierNameChange: (value: string) => void;
  onDurationMonthsChange: (value: string) => void;
  onMinLtvAmountChange: (value: string) => void;
  onUpgradableChange: (value: boolean) => void;
  onInitialQualificationAllowedChange: (value: boolean) => void;
  onMinPurchaseOverrideChange: (value: string) => void;
  onTierTypeChange?: (value: string) => void;
  
  // Configuration
  actionName: string;
  disabled?: boolean;
  showTierType?: boolean;
  showMinPurchaseInline?: boolean;
  useHiddenInputs?: boolean; // Settings route uses hidden inputs, setup uses direct form fields
  
  // Button configuration
  submitButtonLabel?: string;
  submitButtonDisabled?: boolean;
  submitButtonLoading?: boolean;
  showCancelButton?: boolean;
  cancelButtonUrl?: string;
  cancelButtonLabel?: string;
  
  // Help text customization
  tierNameHelpText?: string;

  // Validation errors (optional, for inline field errors)
  tierNameError?: string;
  durationMonthsError?: string;
  minLtvAmountError?: string;
  minPurchaseOverrideError?: string;
}

export default function TierDetailsForm({
  tierName,
  durationMonths,
  minLtvAmount,
  upgradable,
  initialQualificationAllowed,
  minPurchaseOverride,
  calculatedMinPurchase,
  tierType = 'discount',
  onTierNameChange,
  onDurationMonthsChange,
  onMinLtvAmountChange,
  onUpgradableChange,
  onInitialQualificationAllowedChange,
  onMinPurchaseOverrideChange,
  onTierTypeChange,
  actionName,
  disabled = false,
  showTierType = false,
  showMinPurchaseInline = false,
  useHiddenInputs = false,
  submitButtonLabel = 'Save Changes',
  submitButtonDisabled = false,
  submitButtonLoading = false,
  showCancelButton = false,
  cancelButtonUrl,
  cancelButtonLabel = 'Cancel',
  tierNameHelpText = "Enter a descriptive name for this membership tier",
  tierNameError,
  durationMonthsError,
  minLtvAmountError,
  minPurchaseOverrideError,
}: TierDetailsFormProps) {
  return (
    <>
      <input type="hidden" name="action" value={actionName} />
      {useHiddenInputs && (
        <>
          <input type="hidden" name="tier_name" value={tierName} />
          <input type="hidden" name="duration_months" value={durationMonths === '' ? '3' : durationMonths} />
          <input type="hidden" name="min_ltv_amount" value={minLtvAmount === '' ? '600' : minLtvAmount} />
          <input type="hidden" name="min_purchase_amount_override" value={initialQualificationAllowed ? minPurchaseOverride : ''} />
          <input type="hidden" name="initial_qualification_allowed" value={initialQualificationAllowed ? 'true' : 'false'} />
          <input type="hidden" name="upgradable" value={upgradable ? 'true' : 'false'} />
        </>
      )}
      
      <BlockStack gap="400">
        <Text variant="headingMd" as="h3">
          Tier Details
        </Text>
        
        <TextField
          label="Tier Name"
          id="tier_name"
          name={useHiddenInputs ? undefined : 'tier_name'}
          value={tierName}
          onChange={onTierNameChange}
          autoComplete="off"
          helpText={tierNameHelpText}
          disabled={disabled}
          error={tierNameError}
        />
        
        {showMinPurchaseInline ? (
          <InlineStack gap="400">
            <div style={{ flex: 1 }}>
              <TextField
                label="Duration (months)"
                name={useHiddenInputs ? undefined : 'duration_months'}
                value={durationMonths}
                onChange={onDurationMonthsChange}
                type="number"
                autoComplete="off"
                disabled={disabled}
                error={durationMonthsError}
              />
            </div>
            
            <div style={{ flex: 1 }}>
              <TextField
                label="Min Annual LTV ($)"
                name={useHiddenInputs ? undefined : 'min_ltv_amount'}
                value={minLtvAmount}
                onChange={onMinLtvAmountChange}
                type="number"
                autoComplete="off"
                helpText="Minimum annualized lifetime value required for this tier"
                disabled={disabled}
                error={minLtvAmountError}
              />
            </div>
          </InlineStack>
        ) : (
          <>
            <TextField
              label="Duration (months)"
              id="duration_months"
              name={useHiddenInputs ? undefined : 'duration_months'}
              value={durationMonths ?? ''}
              onChange={(value) => onDurationMonthsChange(value == null ? '' : String(value))}
              type="number"
              autoComplete="off"
              helpText="How long the membership lasts (1-12 months). Whole numbers only."
              disabled={disabled}
              error={durationMonthsError}
            />
            
            <TextField
              label="Minimum Annual LTV"
              id="min_ltv_amount"
              name={useHiddenInputs ? undefined : 'min_ltv_amount'}
              value={minLtvAmount ?? ''}
              onChange={(value) => onMinLtvAmountChange(value == null ? '' : String(value))}
              type="number"
              autoComplete="off"
              prefix="$"
              helpText="Minimum annual lifetime value required for this tier"
              disabled={disabled}
              error={minLtvAmountError}
            />
          </>
        )}
        
        {showTierType && onTierTypeChange && (
          <>
            <Select
              label="Tier Type"
              options={[
                { label: 'Discount', value: 'discount' },
                { label: 'Allocation', value: 'allocation' },
              ]}
              value={tierType}
              onChange={onTierTypeChange}
              name={useHiddenInputs ? undefined : 'tier_type'}
              helpText="Discount: Discount-based benefits (may have product restrictions). Allocation: Product access only (0% discount, cumulative products)."
              disabled={disabled}
            />
            {!useHiddenInputs && <input type="hidden" name="tier_type" value={tierType} />}
          </>
        )}
        
        <Checkbox
          label="Available for initial purchase"
          checked={initialQualificationAllowed}
          onChange={onInitialQualificationAllowedChange}
          disabled={!upgradable || disabled}
          helpText={!upgradable
            ? 'Must be checked when tier is not upgradable (so members can join at initial purchase).'
            : 'When unchecked, this tier can only be applied via upgrade, not at initial purchase.'}
        />
        
        {initialQualificationAllowed && (
          <TextField
            label="Initial purchase amount"
            id="min_purchase_amount_override"
            name={useHiddenInputs ? undefined : 'min_purchase_amount_override'}
            value={minPurchaseOverride}
            onChange={(value) => onMinPurchaseOverrideChange(value == null ? '' : String(value))}
            autoComplete="off"
            prefix="$"
            placeholder={calculatedMinPurchase}
            helpText="Leave blank to use suggested value (ALTV ÷ 12). Must be ≤ Minimum Annual LTV."
            disabled={disabled}
            error={minPurchaseOverrideError}
          />
        )}
        
        {!useHiddenInputs && (
          <>
            <input type="hidden" name="initial_qualification_allowed" value={initialQualificationAllowed ? 'true' : 'false'} />
            <input type="hidden" name="min_purchase_amount_override" value={initialQualificationAllowed ? minPurchaseOverride : ''} />
          </>
        )}
        
        <Checkbox
          label="Upgradable"
          checked={upgradable}
          onChange={onUpgradableChange}
          disabled={!initialQualificationAllowed || disabled}
          helpText={!initialQualificationAllowed
            ? 'Must be checked for upgrade-only tiers (so members can reach this tier).'
            : 'When checked, members in lower tiers can upgrade to this tier. Uncheck for top-tier only.'}
        />
        
        {!useHiddenInputs && <input type="hidden" name="upgradable" value={upgradable.toString()} />}
        
        <Box paddingBlockStart="200">
          <InlineStack gap="200" align={showCancelButton ? "start" : "end"}>
            <Button 
              variant="primary" 
              submit
              disabled={submitButtonDisabled}
              loading={submitButtonLoading}
            >
              {submitButtonLabel}
            </Button>
            {showCancelButton && cancelButtonUrl && (
              <Button url={cancelButtonUrl}>
                {cancelButtonLabel}
              </Button>
            )}
          </InlineStack>
        </Box>
      </BlockStack>
    </>
  );
}
