import { type LoaderFunctionArgs, type ActionFunctionArgs, Form, useLoaderData, useNavigation, useNavigate } from 'react-router';
import { useState, useEffect, useCallback } from 'react';
import { Card, BlockStack, Text, Button, InlineStack, Box, TextField, Banner, Tabs } from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';
import { addSessionToUrl } from '~/util/session';
import type { TemplateType } from '~/lib/communication/template-variables';

const VALID_PROVIDERS = ['klaviyo', 'mailchimp', 'sendgrid'] as const;
type ValidProvider = typeof VALID_PROVIDERS[number];

const TEMPLATE_TYPES: Array<{ key: TemplateType; label: string; dbType: string }> = [
  { key: 'monthly-status', label: 'Monthly Status', dbType: 'monthly_status' },
  { key: 'expiration-warning', label: 'Expiration Warning', dbType: 'expiration_warning' },
  { key: 'expiration', label: 'Expiration Notice', dbType: 'expiration' },
  { key: 'upgrade', label: 'Tier Upgrade', dbType: 'upgrade_available' },
];

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

  // Load templates if SendGrid
  const templates: Array<{ templateType: TemplateType; customContent: string | null }> = [];
  if (provider === 'sendgrid') {
    for (const template of TEMPLATE_TYPES) {
      const dbTemplate = await db.getCommunicationTemplate(session.clientId, template.dbType, 'email');
      templates.push({
        templateType: template.key,
        customContent: dbTemplate?.custom_content ?? null,
      });
    }
  }
  
  return {
    session,
    client,
    provider,
    existingConfig,
    templates,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const formData = await request.formData();
  const intent = formData.get('intent');
  const templateType = formData.get('templateType') as TemplateType | null;
  const customContent = formData.get('customContent') as string | null;

  if (intent === 'save_custom_content' && templateType) {
    const template = TEMPLATE_TYPES.find(t => t.key === templateType);
    if (!template) {
      return { success: false, error: 'Invalid template type' };
    }

    try {
      // Get existing template or initialize from base
      const { loadBaseTemplate } = await import('~/lib/communication/templates.server');
      const existingTemplate = await db.getCommunicationTemplate(session.clientId, template.dbType, 'email');
      const htmlBody = existingTemplate?.html_body || loadBaseTemplate(templateType);

      await db.upsertCommunicationTemplate(session.clientId, template.dbType, 'email', {
        htmlBody,
        customContent: customContent || null,
        isActive: true,
      });

      return { success: true, message: 'Custom content saved successfully' };
    } catch (error) {
      console.error('Error saving custom content:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to save' };
    }
  }

  return { success: false, error: 'Invalid action' };
}

export default function ProviderTemplates() {
  const { session, provider, templates } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);
  const [customContent, setCustomContent] = useState<string>('');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const selectedTemplate = TEMPLATE_TYPES[selectedTemplateIndex];
  const templateData = provider === 'sendgrid' ? templates.find(t => t.templateType === selectedTemplate.key) : null;

  // Load custom content when template changes
  useEffect(() => {
    if (templateData) {
      setCustomContent(templateData.customContent || '');
    }
  }, [selectedTemplateIndex, templateData]);

  // Load preview when template or custom content changes (for SendGrid)
  const loadPreview = useCallback(async () => {
    if (!selectedTemplate || provider !== 'sendgrid') return;
    
    setPreviewLoading(true);
    try {
      const url = `/api/templates/preview?templateType=${selectedTemplate.key}&customContent=${encodeURIComponent(customContent || '')}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.html) {
        setPreviewHtml(data.html);
      }
    } catch (error) {
      console.error('Error loading preview:', error);
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedTemplate, provider, customContent]);

  useEffect(() => {
    if (provider === 'sendgrid' && selectedTemplate) {
      loadPreview();
    }
  }, [selectedTemplate, provider, loadPreview]);

  const tabs = TEMPLATE_TYPES.map((template, index) => ({
    id: template.key,
    content: template.label,
    panelID: template.key,
  }));

  if (provider === 'sendgrid') {
    return (
      <BlockStack gap="400">
        {/* Navigation */}
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

        {/* Template Tabs */}
        <Card>
          <Tabs
            tabs={tabs}
            selected={selectedTemplateIndex}
            onSelect={setSelectedTemplateIndex}
          >
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  {selectedTemplate?.label} Template
                </Text>

                {/* Custom Content Editor */}
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingSm" as="h3">
                      Custom Content (Optional)
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      Add optional text-only content that will appear in your email templates. This content is inserted into a dedicated section of the template.
                    </Text>
                    <TextField
                      label="Custom Content"
                      value={customContent}
                      onChange={setCustomContent}
                      multiline={4}
                      placeholder="Enter custom text content here (plain text only)..."
                      autoComplete="off"
                    />
                    <Form method="post">
                      <input type="hidden" name="intent" value="save_custom_content" />
                      <input type="hidden" name="templateType" value={selectedTemplate?.key} />
                      <input type="hidden" name="customContent" value={customContent} />
                      <Button submit variant="primary" loading={isSubmitting}>
                        Save Custom Content
                      </Button>
                    </Form>
                  </BlockStack>
                </Card>

                {/* Preview */}
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingSm" as="h3">
                      Preview
                    </Text>
                    {previewLoading ? (
                      <Text>Loading preview...</Text>
                    ) : (
                      <Box
                        padding="400"
                        background="bg-surface-secondary"
                        borderRadius="200"
                        borderWidth="025"
                        borderColor="border"
                      >
                        <div
                          dangerouslySetInnerHTML={{ __html: previewHtml }}
                          style={{
                            maxWidth: '600px',
                            margin: '0 auto',
                            backgroundColor: '#ffffff',
                            padding: '20px',
                          }}
                        />
                      </Box>
                    )}
                  </BlockStack>
                </Card>
              </BlockStack>
            </Card>
          </Tabs>
        </Card>
      </BlockStack>
    );
  }

  // Klaviyo/Mailchimp - Show download buttons
  return (
    <BlockStack gap="400">
      {/* Navigation */}
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

      {/* Download Templates */}
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Email Templates
          </Text>
          <Text variant="bodyMd" as="p">
            Download email templates for {provider}. These templates use default LiberoVino branding and can be edited in your {provider} account.
          </Text>
          <Text variant="bodySm" as="p" tone="subdued">
            Templates are provided as HTML files with {provider === 'klaviyo' ? 'Klaviyo' : 'Mailchimp'} merge tag syntax.
          </Text>

          <BlockStack gap="300">
            {TEMPLATE_TYPES.map((template) => (
              <Card key={template.key}>
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="200">
                    <Text variant="headingSm" as="h3">
                      {template.label}
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      {template.label} email template for {provider}
                    </Text>
                  </BlockStack>
                  <Button
                    url={`/api/templates/download/${template.key}?provider=${provider}`}
                    download
                  >
                    Download Template
                  </Button>
                </InlineStack>
              </Card>
            ))}
          </BlockStack>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
