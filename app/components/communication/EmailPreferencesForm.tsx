import { BlockStack, Text, TextField, Banner } from '@shopify/polaris';

interface EmailPreferencesFormProps {
  warningDays: string;
  onWarningDaysChange: (value: string) => void;
}

export default function EmailPreferencesForm({
  warningDays,
  onWarningDaysChange,
}: EmailPreferencesFormProps) {
  return (
    <BlockStack gap="300">
      <Text variant="headingMd" as="h3">
        Email Preferences
      </Text>
      
      <Banner tone="info">
        <Text variant="bodySm" as="p">
          Transactional notifications (monthly status and expiration warnings) are automatically enabled for all members. 
          Marketing communications are controlled by individual member preferences.
        </Text>
      </Banner>

      <TextField
        label="Warning days before duration end"
        type="text"
        value={warningDays}
        onChange={(value) => {
          // Only allow digits
          const digitsOnly = value.replace(/\D/g, '');
          // Limit to 2 digits (max 30)
          const limited = digitsOnly.slice(0, 2);
          // Always update - allow empty for editing, validation happens on blur/submit
          onWarningDaysChange(limited);
        }}
        onBlur={() => {
          // Validate on blur - ensure value is between 1-30
          const num = parseInt(warningDays, 10);
          if (isNaN(num) || num < 1) {
            onWarningDaysChange('7'); // Default to 7 if invalid
          } else if (num > 30) {
            onWarningDaysChange('30'); // Cap at 30
          }
        }}
        autoComplete="off"
        helpText="How many days before duration ends to send warning email (1-30 days)"
      />
    </BlockStack>
  );
}
