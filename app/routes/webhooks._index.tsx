import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { json, redirect } from 'react-router';
import { useLoaderData, useActionData, Form } from 'react-router';
import { 
  Page, 
  Layout, 
  Card, 
  Button, 
  Text, 
  BlockStack,
  InlineStack,
  Banner,
  Badge,
  DataTable,
  Select,
  TextField
} from '@shopify/polaris';
import { crmManager } from '~/lib/crm';
import { getWebhookEndpoint, getAvailableWebhookTopics, formatWebhookTopic } from '~/util/webhook';
import type { WebhookTopic } from '~/types/crm';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const crmType = url.searchParams.get('crm') || 'shopify';

  if (crmType !== 'shopify' && crmType !== 'commerce7') {
    throw new Response('Invalid CRM type', { status: 400 });
  }

  try {
    const provider = crmManager.getProvider(crmType);
    const webhooks = await provider.listWebhooks().catch(() => []);
    const webhookEndpoint = getWebhookEndpoint(crmType as 'shopify' | 'commerce7');
    const availableTopics = getAvailableWebhookTopics();

    return json({
      crmType,
      webhooks,
      webhookEndpoint,
      availableTopics
    });
  } catch (error) {
    console.error('Error loading webhooks:', error);
    return json({
      crmType,
      webhooks: [],
      webhookEndpoint: getWebhookEndpoint(crmType as 'shopify' | 'commerce7'),
      availableTopics: getAvailableWebhookTopics(),
      error: error instanceof Error ? error.message : 'Failed to load webhooks'
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get('_action');
  const crmType = formData.get('crmType') as 'shopify' | 'commerce7';

  if (!crmType || (crmType !== 'shopify' && crmType !== 'commerce7')) {
    return json({ error: 'Invalid CRM type' }, { status: 400 });
  }

  const provider = crmManager.getProvider(crmType);

  try {
    if (action === 'register') {
      const topic = formData.get('topic') as WebhookTopic;
      const address = formData.get('address') as string;

      if (!topic || !address) {
        return json({ error: 'Missing required fields' }, { status: 400 });
      }

      await provider.registerWebhook(topic, address);
      return json({ success: true, message: 'Webhook registered successfully' });

    } else if (action === 'delete') {
      const webhookId = formData.get('webhookId') as string;

      if (!webhookId) {
        return json({ error: 'Missing webhook ID' }, { status: 400 });
      }

      await provider.deleteWebhook(webhookId);
      return json({ success: true, message: 'Webhook deleted successfully' });
    }

    return json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Webhook action error:', error);
    return json({ 
      error: error instanceof Error ? error.message : 'Action failed' 
    }, { status: 500 });
  }
}

export default function WebhooksIndex() {
  const { crmType, webhooks, webhookEndpoint, availableTopics, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const crmOptions = [
    { label: 'Shopify', value: 'shopify' },
    { label: 'Commerce7', value: 'commerce7' }
  ];

  const topicOptions = availableTopics.map(topic => ({
    label: formatWebhookTopic(topic),
    value: topic
  }));

  // Prepare data for the table
  const webhookRows = webhooks.map(webhook => [
    webhook.topic,
    formatWebhookTopic(webhook.topic),
    webhook.address,
    webhook.createdAt ? new Date(webhook.createdAt).toLocaleDateString() : 'N/A',
    webhook.id ? (
      <Form method="post" key={webhook.id}>
        <input type="hidden" name="crmType" value={crmType} />
        <input type="hidden" name="webhookId" value={webhook.id} />
        <Button
          variant="primary"
          tone="critical"
          size="slim"
          submit
          name="_action"
          value="delete"
        >
          Delete
        </Button>
      </Form>
    ) : null
  ]);

  return (
    <Page
      title="Webhook Management"
      subtitle="Manage CRM webhooks for real-time data synchronization"
    >
      <Layout>
        {/* Status Messages */}
        {(error || actionData?.error) && (
          <Layout.Section>
            <Banner tone="critical">
              {error || actionData?.error}
            </Banner>
          </Layout.Section>
        )}

        {actionData?.success && (
          <Layout.Section>
            <Banner tone="success">
              {actionData.message}
            </Banner>
          </Layout.Section>
        )}

        {/* CRM Selection */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Select CRM
              </Text>
              <Form method="get">
                <InlineStack gap="400" align="start">
                  <div style={{ minWidth: '200px' }}>
                    <Select
                      label="CRM Type"
                      options={crmOptions}
                      value={crmType}
                      onChange={(value) => {
                        const form = document.createElement('form');
                        form.method = 'get';
                        const input = document.createElement('input');
                        input.type = 'hidden';
                        input.name = 'crm';
                        input.value = value;
                        form.appendChild(input);
                        document.body.appendChild(form);
                        form.submit();
                      }}
                    />
                  </div>
                  <Badge tone="info">
                    {crmType === 'shopify' ? 'Shopify' : 'Commerce7'}
                  </Badge>
                </InlineStack>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Webhook Endpoint Info */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Webhook Endpoint
              </Text>
              <Banner tone="info">
                Configure your CRM to send webhooks to this endpoint
              </Banner>
              <TextField
                label="Webhook URL"
                value={webhookEndpoint}
                readOnly
                autoComplete="off"
                helpText="Use this URL when configuring webhooks in your CRM"
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Register New Webhook */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Register New Webhook
              </Text>
              <Form method="post">
                <input type="hidden" name="crmType" value={crmType} />
                <BlockStack gap="400">
                  <Select
                    label="Webhook Topic"
                    options={topicOptions}
                    name="topic"
                  />
                  <TextField
                    label="Webhook Address"
                    name="address"
                    value={webhookEndpoint}
                    autoComplete="off"
                    helpText="The URL where webhooks will be sent"
                  />
                  <Button
                    variant="primary"
                    submit
                    name="_action"
                    value="register"
                  >
                    Register Webhook
                  </Button>
                </BlockStack>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Registered Webhooks */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Registered Webhooks
              </Text>
              {webhooks.length === 0 ? (
                <Banner tone="warning">
                  No webhooks registered yet. Register a webhook above to get started.
                </Banner>
              ) : (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                  headings={['Topic ID', 'Topic', 'Address', 'Created At', 'Actions']}
                  rows={webhookRows}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Setup Instructions */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Setup Instructions
              </Text>
              
              {crmType === 'shopify' ? (
                <BlockStack gap="300">
                  <Text variant="bodyMd" as="p">
                    <strong>Shopify Webhook Setup:</strong>
                  </Text>
                  <ol style={{ marginLeft: '20px' }}>
                    <li>Go to your Shopify Admin Settings → Notifications → Webhooks</li>
                    <li>Click "Create webhook"</li>
                    <li>Select the event you want to subscribe to</li>
                    <li>Set the format to JSON</li>
                    <li>Use the webhook URL provided above</li>
                    <li>Click "Save webhook"</li>
                  </ol>
                  <Banner tone="info">
                    Make sure your SHOPIFY_API_SECRET environment variable is configured for webhook validation.
                  </Banner>
                </BlockStack>
              ) : (
                <BlockStack gap="300">
                  <Text variant="bodyMd" as="p">
                    <strong>Commerce7 Webhook Setup:</strong>
                  </Text>
                  <ol style={{ marginLeft: '20px' }}>
                    <li>Register webhooks using the form above</li>
                    <li>Or use the Commerce7 API to register webhooks programmatically</li>
                    <li>Commerce7 will send POST requests to your webhook endpoint</li>
                    <li>Webhooks will include tenant information in headers</li>
                  </ol>
                  <Banner tone="info">
                    Configure COMMERCE7_WEBHOOK_SECRET environment variable for enhanced security.
                  </Banner>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

