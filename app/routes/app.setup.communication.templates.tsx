import { type LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useNavigate } from 'react-router';
import { Card, BlockStack, Text, Button, InlineStack, Box } from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';
import { addSessionToUrl } from '~/util/session';

const VALID_PROVIDERS = ['klaviyo', 'mailchimp', 'sendgrid'] as const;
type ValidProvider = typeof VALID_PROVIDERS[number];

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const client = await db.getClient(session.clientId);
  const existingConfig = await db.getCommunicationConfig(session.clientId);
  
  if (!client) {
    throw new Response('Client not found', { status: 404 });
  }

  if (!existingConfig?.email_provider) {
    throw new Response('No email provider configured. Please set up a provider first.', { status: 404 });
  }

  const provider = existingConfig.email_provider.toLowerCase() as ValidProvider;
  if (!VALID_PROVIDERS.includes(provider)) {
    throw new Response('Invalid provider configured', { status: 404 });
  }
  
  return {
    session,
    client,
    provider,
    existingConfig,
  };
}

export default function ProviderTemplates() {
  const { session, client, provider } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <BlockStack gap="400">
      {/* Navigation Buttons at Top */}
      <Box paddingBlockEnd="400">
        <InlineStack align="space-between">
          <Button
            onClick={() => navigate(addSessionToUrl(`/app/setup/communication/${provider}`, session.id))}
          >
            ← Back to Provider Setup
          </Button>
          
          <Button
            variant="primary"
            size="large"
            onClick={() => navigate(addSessionToUrl('/app/setup/review', session.id))}
          >
            Continue to Review →
          </Button>
        </InlineStack>
      </Box>

      {/* Content */}
      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd" as="h3">
            Templates
          </Text>
          <Text variant="bodyMd" as="p">
            Template preview and customization for {provider} will be available here.
          </Text>
          <Text variant="bodySm" as="p" tone="subdued">
            This section is under development.
          </Text>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

