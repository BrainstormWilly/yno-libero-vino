/**
 * Communication Templates Page (Settings)
 * 
 * Allows clients to preview and download email templates for their provider.
 * - Klaviyo/Mailchimp: Preview templates and download zip files
 * - SendGrid: Edit templates (reuses setup route functionality)
 */

import { type LoaderFunctionArgs, type ActionFunctionArgs, Form, useLoaderData, useActionData, useLocation, useNavigation } from 'react-router';
import { useState, useEffect, useCallback } from 'react';
import { 
  Page,
  Card, 
  BlockStack, 
  Text, 
  Button, 
  InlineStack, 
  Box,
  Tabs,
  Banner,
  TextField,
} from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import { getMainNavigationActions } from '~/util/navigation';
import { addSessionToUrl } from '~/util/session';
import * as db from '~/lib/db/supabase.server';
import { getSupabaseClient } from '~/lib/db/supabase.server';
import type { TemplateType } from '~/lib/communication/template-variables';

const VALID_PROVIDERS = ['klaviyo', 'mailchimp', 'sendgrid'] as const;
type ValidProvider = typeof VALID_PROVIDERS[number];

const TEMPLATE_TYPES: Array<{ key: TemplateType; label: string; dbType: string }> = [
  { key: 'monthly-status', label: 'Monthly Status', dbType: 'monthly_status' },
  { key: 'expiration-warning', label: 'Expiration Warning', dbType: 'expiration_warning' },
  { key: 'expiration', label: 'Expiration Notice', dbType: 'expiration' },
  { key: 'upgrade', label: 'Tier Upgrade', dbType: 'upgrade_available' },
  { key: 'club-signup', label: 'Club Signup', dbType: 'welcome' },
];

const STORAGE_BUCKET = 'sendgrid-email-images';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Response('Unauthorized', { status: 401 });
  }
  
  const client = await db.getClient(session.clientId);
  if (!client) {
    throw new Response('Client not found', { status: 404 });
  }

  const communicationConfig = await db.getCommunicationConfig(session.clientId);
  if (!communicationConfig?.email_provider) {
    throw new Response('No email provider configured', { status: 404 });
  }

  const provider = communicationConfig.email_provider.toLowerCase() as ValidProvider;
  if (!VALID_PROVIDERS.includes(provider)) {
    throw new Response('Invalid provider configured', { status: 404 });
  }

  // Get zip file URLs for Klaviyo and Mailchimp
  let zipFileUrl: string | null = null;
  if (provider === 'klaviyo' || provider === 'mailchimp') {
    const supabase = getSupabaseClient();
    const zipFileName = `liberovino-${provider}-templates.zip`;
    const storagePath = `templates/${zipFileName}`;
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);
    zipFileUrl = publicUrl;
  }

  // Load templates if SendGrid (for editing)
  const templates: Array<{ templateType: TemplateType; customContent: string | null }> = [];
  if (provider === 'sendgrid') {
    const TEMPLATE_DB_TYPES = [
      { key: 'monthly-status' as TemplateType, dbType: 'monthly_status' },
      { key: 'expiration-warning' as TemplateType, dbType: 'expiration_warning' },
      { key: 'expiration' as TemplateType, dbType: 'expiration' },
      { key: 'upgrade' as TemplateType, dbType: 'upgrade_available' },
      { key: 'club-signup' as TemplateType, dbType: 'welcome' },
    ];
    
    for (const template of TEMPLATE_DB_TYPES) {
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
    zipFileUrl,
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

export default function CommunicationTemplates() {
  const { session, provider, zipFileUrl, templates, client } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const location = useLocation();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [monthlyStatusVariation, setMonthlyStatusVariation] = useState<
    'active-no-upgrade' | 'active-with-upgrade' | 'expiring-soon' | 'expired'
  >('active-no-upgrade');
  const [includeMarketingProducts, setIncludeMarketingProducts] = useState(false);

  const selectedTemplate = TEMPLATE_TYPES[selectedTemplateIndex];
  const templateData = provider === 'sendgrid' ? templates?.find(t => t.templateType === selectedTemplate.key) : null;
  const isMonthlyStatus = selectedTemplate?.key === 'monthly-status';
  
  // SendGrid-specific state
  const [customContent, setCustomContent] = useState<string>('');
  const [previewedCustomContent, setPreviewedCustomContent] = useState<string>('');

  // Load custom content when template changes (SendGrid)
  useEffect(() => {
    if (templateData) {
      setCustomContent(templateData.customContent || '');
    }
  }, [selectedTemplateIndex, templateData]);

  // Load preview for Klaviyo/Mailchimp
  const loadPreview = useCallback(async () => {
    if (provider === 'sendgrid') return; // SendGrid uses different preview mechanism
    
    setPreviewLoading(true);
    try {
      // Determine template type: use expiration-warning for expiring-soon variation, otherwise use selected template
      const previewTemplateType: TemplateType = 
        (selectedTemplate.key === 'monthly-status' && monthlyStatusVariation === 'expiring-soon')
          ? 'expiration-warning'
          : (selectedTemplate.key || 'monthly-status');
      
      // Include session ID in URL (sessions are passed via URL, not cookies)
      const url = `/api/templates/preview?session=${session.id}&templateType=${previewTemplateType}&provider=${provider}&variation=${monthlyStatusVariation}&includeMarketing=${includeMarketingProducts ? 'true' : 'false'}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to load preview' }));
        console.error('Error loading preview:', errorData.error || `HTTP ${response.status}`);
        setPreviewHtml('');
        return;
      }
      
      const data = await response.json();
      if (data.html) {
        setPreviewHtml(data.html);
      }
    } catch (error) {
      console.error('Error loading preview:', error);
      setPreviewHtml('');
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedTemplate, provider, session.id, monthlyStatusVariation, includeMarketingProducts]);

  // Load preview for SendGrid with custom content
  const loadSendGridPreview = useCallback(async (contentToPreview: string) => {
    if (!selectedTemplate || provider !== 'sendgrid') return;
    
    setPreviewLoading(true);
    try {
      const previewTemplateType: TemplateType = 
        (selectedTemplate.key === 'monthly-status' && monthlyStatusVariation === 'expiring-soon')
          ? 'expiration-warning'
          : (selectedTemplate.key || 'monthly-status');
      
      const url = `/api/templates/preview?session=${session.id}&templateType=${previewTemplateType}&customContent=${encodeURIComponent(contentToPreview || '')}&variation=${monthlyStatusVariation}&includeMarketing=${includeMarketingProducts ? 'true' : 'false'}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to load preview' }));
        console.error('Error loading preview:', errorData.error || `HTTP ${response.status}`);
        setPreviewHtml('');
        return;
      }
      
      const data = await response.json();
      if (data.html) {
        setPreviewHtml(data.html);
        setPreviewedCustomContent(contentToPreview);
      }
    } catch (error) {
      console.error('Error loading preview:', error);
      setPreviewHtml('');
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedTemplate, provider, session.id, monthlyStatusVariation, includeMarketingProducts]);

  // Load preview when template or variation changes
  useEffect(() => {
    if (provider === 'sendgrid' && selectedTemplate && templateData) {
      loadSendGridPreview(templateData.customContent || '');
    } else if (provider !== 'sendgrid' && selectedTemplate) {
      loadPreview();
    }
  }, [selectedTemplateIndex, monthlyStatusVariation, provider, loadPreview, loadSendGridPreview, selectedTemplate, includeMarketingProducts, templateData]);

  const backUrl = addSessionToUrl('/app/settings/communication', session.id);

  return (
    <Page
      title="Email Templates"
      backAction={{
        content: 'Communication Settings',
        url: backUrl,
      }}
      primaryAction={zipFileUrl ? {
        content: 'Download Templates',
        url: zipFileUrl,
        external: true,
        download: true,
      } : undefined}
      secondaryActions={getMainNavigationActions({
        sessionId: session.id,
        currentPath: location.pathname,
      })}
    >
      <BlockStack gap="400">
        {actionData?.success && (
          <Banner tone="success">
            <Text as="p">{actionData.message}</Text>
          </Banner>
        )}
        {actionData?.error && (
          <Banner tone="critical">
            <Text as="p">{actionData.error}</Text>
          </Banner>
        )}
        
        {provider === 'sendgrid' ? (
          <Banner>
            <Text as="p">
              Edit your email templates below. Add custom content to personalize your emails.
            </Text>
          </Banner>
        ) : (
          <Banner>
            <Text as="p">
              Preview your email templates below. Download the complete template package (including README) 
              to upload to your {provider === 'klaviyo' ? 'Klaviyo' : 'Mailchimp'} account.
            </Text>
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <Tabs
              tabs={TEMPLATE_TYPES.map((template) => ({
                content: template.label,
                id: String(template.key),
              }))}
              selected={selectedTemplateIndex}
              onSelect={(id) => {
                // const index = TEMPLATE_TYPES.findIndex(t => t.key === id);
                // if (index !== -1) {
                  setSelectedTemplateIndex(id);
                // }
              }}
            />

            {isMonthlyStatus && (
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">Preview Variation</Text>
                <InlineStack gap="200">
                  <Button
                    variant={monthlyStatusVariation === 'active-no-upgrade' ? 'primary' : 'secondary'}
                    onClick={() => setMonthlyStatusVariation('active-no-upgrade')}
                  >
                    Active (No Upgrade)
                  </Button>
                  <Button
                    variant={monthlyStatusVariation === 'active-with-upgrade' ? 'primary' : 'secondary'}
                    onClick={() => setMonthlyStatusVariation('active-with-upgrade')}
                  >
                    Active (With Upgrade)
                  </Button>
                  <Button
                    variant={monthlyStatusVariation === 'expiring-soon' ? 'primary' : 'secondary'}
                    onClick={() => setMonthlyStatusVariation('expiring-soon')}
                  >
                    Expiring Soon
                  </Button>
                  <Button
                    variant={monthlyStatusVariation === 'expired' ? 'primary' : 'secondary'}
                    onClick={() => setMonthlyStatusVariation('expired')}
                  >
                    Expired
                  </Button>
                </InlineStack>
              </BlockStack>
            )}

            {isMonthlyStatus && (
              <Box>
                <label>
                  <input
                    type="checkbox"
                    checked={includeMarketingProducts}
                    onChange={(e) => setIncludeMarketingProducts(e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  Include Marketing Products
                </label>
              </Box>
            )}

            {provider === 'sendgrid' && (
              <Box>
                <Text as="h3" variant="headingMd">Custom Content</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Add custom content that will appear in your email templates. This content will be displayed in a highlighted box within the email.
                </Text>
                <Box paddingBlockStart="300">
                  <TextField
                    label=""
                    value={customContent}
                    onChange={setCustomContent}
                    multiline={4}
                    placeholder="Enter custom content for this template..."
                    autoComplete="off"
                  />
                </Box>
                <Box paddingBlockStart="300">
                  <Form method="post">
                    <input type="hidden" name="intent" value="save_custom_content" />
                    <input type="hidden" name="templateType" value={selectedTemplate.key} />
                    <input type="hidden" name="customContent" value={customContent} />
                    <Button
                      submit
                      loading={isSubmitting}
                      variant="primary"
                    >
                      Save Custom Content
                    </Button>
                  </Form>
                </Box>
              </Box>
            )}

            <Box>
              <Text as="h3" variant="headingMd">Preview</Text>
              {provider === 'sendgrid' && (
                <Box paddingBlockStart="200" paddingBlockEnd="300">
                  <Button
                    onClick={() => loadSendGridPreview(customContent)}
                    loading={previewLoading}
                  >
                    Update Preview
                  </Button>
                </Box>
              )}
              {previewLoading ? (
                <Box padding="400">
                  <Text as="p">Loading preview...</Text>
                </Box>
              ) : previewHtml ? (
                <Box
                  padding="400"
                  background="bg-surface-secondary"
                  borderColor="border"
                  borderWidth="025"
                  borderRadius="200"
                >
                  <div
                    className="email-preview-content"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                    style={{
                      maxWidth: '600px',
                      margin: '0 auto',
                      backgroundColor: '#ffffff',
                      color: '#202124',
                    }}
                  />
                </Box>
              ) : (
                <Box padding="400">
                  <Text as="p" tone="subdued">No preview available</Text>
                </Box>
              )}
            </Box>

            {zipFileUrl && (
              <Box>
                <Button
                  url={zipFileUrl}
                  external
                  download
                  variant="primary"
                >
                  Download Template Package
                </Button>
                <Text as="p" tone="subdued" variant="bodySm">
                  Includes all templates and README with setup instructions
                </Text>
              </Box>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
