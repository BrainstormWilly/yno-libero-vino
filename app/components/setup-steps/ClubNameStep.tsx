import { Card, BlockStack, Text, TextField, Banner } from '@shopify/polaris';

interface ClubNameStepProps {
  clubName: string;
  clubDescription: string;
  onClubNameChange: (value: string) => void;
  onClubDescriptionChange: (value: string) => void;
}

export default function ClubNameStep({
  clubName,
  clubDescription,
  onClubNameChange,
  onClubDescriptionChange,
}: ClubNameStepProps) {
  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingLg" as="h2">
          Name Your Club
        </Text>
        
        <Text variant="bodyMd" as="p" tone="subdued">
          Give your club a name that reflects your winery's personality. This is what members will see when they join.
        </Text>
        
        <TextField
          label="Club Name"
          value={clubName}
          onChange={onClubNameChange}
          autoComplete="off"
          helpText="Example: Sunset Ridge Wine Club, The Reserve Society"
        />
        
        <TextField
          label="Club Description"
          value={clubDescription}
          onChange={onClubDescriptionChange}
          multiline={4}
          autoComplete="off"
          helpText="Describe the liberation experience. This appears on your club page and member communications."
        />
        
        <Banner tone="info">
          <Text as="p">
            <strong>Pro Tip:</strong> Emphasize freedom and benefits. Example: "Enjoy premium wines on your schedule. No forced shipments, just great wine when you want it."
          </Text>
        </Banner>
      </BlockStack>
    </Card>
  );
}

