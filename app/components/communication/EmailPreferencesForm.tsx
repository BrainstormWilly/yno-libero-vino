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
        type="number"
        value={warningDays}
        onChange={onWarningDaysChange}
        autoComplete="off"
        min={1}
        max={30}
        helpText="How many days before duration ends to send warning email (1-30 days)"
      />
    </BlockStack>
  );
}
