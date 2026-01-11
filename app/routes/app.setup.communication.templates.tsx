import { type LoaderFunctionArgs, type ActionFunctionArgs, Form, useLoaderData, useNavigation, useNavigate } from 'react-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, BlockStack, Text, Button, InlineStack, Box, TextField, Tabs, Thumbnail, Checkbox } from '@shopify/polaris';

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
  { key: 'club-signup', label: 'Club Signup', dbType: 'welcome' },
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
  const { session, provider, templates, client } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);
  const [customContent, setCustomContent] = useState<string>('');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [imagesCollapsed, setImagesCollapsed] = useState(true);
  const [headerImageUrl, setHeaderImageUrl] = useState(client?.email_header_image_url || '');
  const [footerImageUrl, setFooterImageUrl] = useState(client?.email_footer_image_url || '');
  const [uploading, setUploading] = useState<'header' | 'footer' | null>(null);
  const [monthlyStatusVariation, setMonthlyStatusVariation] = useState<
    'active-no-upgrade' | 'active-with-upgrade' | 'expiring-soon' | 'expired'
  >('active-no-upgrade');
  const [includeMarketingProducts, setIncludeMarketingProducts] = useState(false);
  
  const headerInputRef = useRef<HTMLInputElement>(null);
  const footerInputRef = useRef<HTMLInputElement>(null);

  const selectedTemplate = TEMPLATE_TYPES[selectedTemplateIndex];
  const templateData = provider === 'sendgrid' ? templates.find(t => t.templateType === selectedTemplate.key) : null;
  const isMonthlyStatus = selectedTemplate?.key === 'monthly-status';

  // Load custom content when template changes
  useEffect(() => {
    if (templateData) {
      setCustomContent(templateData.customContent || '');
    }
  }, [selectedTemplateIndex, templateData]);

  // Track the custom content that is currently previewed (saved content from DB)
  const [previewedCustomContent, setPreviewedCustomContent] = useState<string>('');

  // Load preview with specific custom content (for SendGrid)
  const loadPreview = useCallback(async (contentToPreview: string) => {
    if (!selectedTemplate || provider !== 'sendgrid') return;
    
    setPreviewLoading(true);
    try {
      // Determine template type: use expiration-warning for expiring-soon variation, otherwise use selected template
      const previewTemplateType: TemplateType = 
        (selectedTemplate.key === 'monthly-status' && monthlyStatusVariation === 'expiring-soon')
          ? 'expiration-warning'
          : (selectedTemplate.key || 'monthly-status');
      
      // Include session ID in URL (sessions are passed via URL, not cookies)
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

  // Load preview when template or variation changes (using saved content)
  useEffect(() => {
    if (provider === 'sendgrid' && selectedTemplate && templateData) {
      loadPreview(templateData.customContent || '');
    }
  }, [selectedTemplateIndex, monthlyStatusVariation, provider, loadPreview, templateData, selectedTemplate]);

  // Handle manual preview button click
  const handlePreviewClick = () => {
    loadPreview(customContent);
  };

  const handleImageUpload = async (imageType: 'header' | 'footer', file: File) => {
    setUploading(imageType);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('imageType', imageType);
      
      const response = await fetch(`/api/upload-sendgrid-image?session=${session.id}`, {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      if (result.success) {
        if (imageType === 'header') {
          setHeaderImageUrl(result.url || '');
        } else {
          setFooterImageUrl(result.url || '');
        }
        // Reload preview to show updated images (using currently previewed content)
        if (provider === 'sendgrid' && selectedTemplate) {
          loadPreview(previewedCustomContent);
        }
      } else {
        console.error('Upload failed:', result.error);
        alert(result.error || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(null);
    }
  };

  const handleRemoveImage = async (imageType: 'header' | 'footer') => {
    setUploading(imageType);
    try {
      const formData = new FormData();
      formData.append('imageType', imageType);
      formData.append('remove', 'true');
      
      const response = await fetch(`/api/upload-sendgrid-image?session=${session.id}`, {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      if (result.success) {
        if (imageType === 'header') {
          setHeaderImageUrl('');
        } else {
          setFooterImageUrl('');
        }
        // Reload preview to show default images (using currently previewed content)
        if (provider === 'sendgrid' && selectedTemplate) {
          loadPreview(previewedCustomContent);
        }
      } else {
        console.error('Remove failed:', result.error);
        alert(result.error || 'Failed to remove image');
      }
    } catch (error) {
      console.error('Remove error:', error);
      alert('Failed to remove image. Please try again.');
    } finally {
      setUploading(null);
    }
  };

  // Convert image URLs to proxy URLs for thumbnails (fix CORS)
  const getProxiedImageUrl = (imageUrl: string | null | undefined): string | undefined => {
    if (!imageUrl) return undefined;
    if (imageUrl.includes('127.0.0.1') || imageUrl.includes('localhost')) {
      const baseUrl = window.location.origin;
      return `${baseUrl}/api/images/proxy?session=${session.id}&url=${encodeURIComponent(imageUrl)}`;
    }
    return imageUrl;
  };
  
  const handleImageFileSelect = (imageType: 'header' | 'footer', event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please select a JPEG, PNG, GIF, or WebP image');
      return;
    }
    
    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Image size must be less than 5MB');
      return;
    }
    
    handleImageUpload(imageType, file);
  };

  const tabs = TEMPLATE_TYPES.map((template) => ({
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
              onClick={() => navigate(addSessionToUrl('/app/setup/review', session.id))}
            >
              Continue to Review →
            </Button>
          </InlineStack>
        </Box>

        {/* Email Images - Collapsible */}
        <Card>
          <BlockStack gap="300">
            <Box paddingInlineEnd="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text variant="headingMd" as="h2">
                    Email Images
                  </Text>
                  <Text variant="bodySm" tone="subdued" as="p">
                    Applies to all email templates
                  </Text>
                </BlockStack>
                <Button
                  onClick={() => setImagesCollapsed(!imagesCollapsed)}
                  variant="plain"
                >
                  {imagesCollapsed ? 'Show' : 'Hide'}
                </Button>
              </InlineStack>
            </Box>
            
            {!imagesCollapsed && (
              <BlockStack gap="400">
                <Text variant="bodySm" tone="subdued" as="p">
                  Upload custom header and footer images for your email templates. If not provided, default LiberoVino images will be used.
                </Text>
                
                {/* Header Image */}
                <BlockStack gap="200">
                  <Text variant="bodyMd" fontWeight="semibold" as="p">
                    Header Image (Recommended: 600x300px)
                  </Text>
                  {headerImageUrl && getProxiedImageUrl(headerImageUrl) && (
                    <Thumbnail
                      source={getProxiedImageUrl(headerImageUrl)!}
                      alt="Email header image"
                      size="large"
                    />
                  )}
                  <input
                    ref={headerInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={(e) => handleImageFileSelect('header', e)}
                    style={{ display: 'none' }}
                  />
                  <InlineStack gap="200">
                    <Button
                      onClick={() => headerInputRef.current?.click()}
                      loading={uploading === 'header'}
                      disabled={uploading !== null}
                    >
                      {headerImageUrl ? 'Replace' : 'Upload Header Image'}
                    </Button>
                    {headerImageUrl && (
                      <Button
                        onClick={() => handleRemoveImage('header')}
                        loading={uploading === 'header'}
                        disabled={uploading !== null}
                        variant="primary"
                      >
                        Use Default
                      </Button>
                    )}
                  </InlineStack>
                </BlockStack>
                
                {/* Footer Image */}
                <BlockStack gap="200">
                  <Text variant="bodyMd" fontWeight="semibold" as="p">
                    Footer Image (Recommended: 600x80px)
                  </Text>
                  {footerImageUrl && getProxiedImageUrl(footerImageUrl) && (
                    <Thumbnail
                      source={getProxiedImageUrl(footerImageUrl)!}
                      alt="Email footer image"
                      size="large"
                    />
                  )}
                  <input
                    ref={footerInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={(e) => handleImageFileSelect('footer', e)}
                    style={{ display: 'none' }}
                  />
                  <InlineStack gap="200">
                    <Button
                      onClick={() => footerInputRef.current?.click()}
                      loading={uploading === 'footer'}
                      disabled={uploading !== null}
                    >
                      {footerImageUrl ? 'Replace' : 'Upload Footer Image'}
                    </Button>
                    {footerImageUrl && (
                      <Button
                        onClick={() => handleRemoveImage('footer')}
                        loading={uploading === 'footer'}
                        disabled={uploading !== null}
                        variant="plain"
                      >
                        Use Default
                      </Button>
                    )}
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            )}
          </BlockStack>
        </Card>

        {/* Template Tabs - moved outside card */}
        <Tabs
          tabs={tabs}
          selected={selectedTemplateIndex}
          onSelect={setSelectedTemplateIndex}
        >
          {/* Empty panel - tabs control the selected template */}
        </Tabs>

        {/* Status Variation and Custom Content - combined in one card */}
        <Card>
          <BlockStack gap="400">
            {/* Monthly Status Variation Selector */}
            {isMonthlyStatus && (
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3">
                  Status Variation
                </Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  Preview different customer status scenarios for the monthly status email
                </Text>
                <InlineStack gap="200" wrap>
                  <Button
                    pressed={monthlyStatusVariation === 'active-no-upgrade'}
                    onClick={() => setMonthlyStatusVariation('active-no-upgrade')}
                    variant={monthlyStatusVariation === 'active-no-upgrade' ? 'primary' : 'secondary'}
                  >
                    Active (No Upgrade Available)
                  </Button>
                  <Button
                    pressed={monthlyStatusVariation === 'active-with-upgrade'}
                    onClick={() => setMonthlyStatusVariation('active-with-upgrade')}
                    variant={monthlyStatusVariation === 'active-with-upgrade' ? 'primary' : 'secondary'}
                  >
                    Active (Upgrade Available)
                  </Button>
                  <Button
                    pressed={monthlyStatusVariation === 'expiring-soon'}
                    onClick={() => setMonthlyStatusVariation('expiring-soon')}
                    variant={monthlyStatusVariation === 'expiring-soon' ? 'primary' : 'secondary'}
                  >
                    Expiring Soon
                  </Button>
                  <Button
                    pressed={monthlyStatusVariation === 'expired'}
                    onClick={() => setMonthlyStatusVariation('expired')}
                    variant={monthlyStatusVariation === 'expired' ? 'primary' : 'secondary'}
                  >
                    Expired
                  </Button>
                </InlineStack>
                <Box paddingBlockStart="300">
                  <Checkbox
                    label="Include marketing products in preview"
                    checked={includeMarketingProducts}
                    onChange={setIncludeMarketingProducts}
                    helpText="Show showcase products in the preview (only displayed for customers who have opted into marketing)"
                  />
                </Box>
              </BlockStack>
            )}

            {/* Horizontal divider between sections */}
            {isMonthlyStatus && (
              <Box paddingBlockStart="400" paddingBlockEnd="400">
                <Box borderBlockStartWidth="025" borderColor="border" />
              </Box>
            )}

            {/* Custom Content Editor */}
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
              <InlineStack gap="200">
                <Form method="post">
                  <input type="hidden" name="intent" value="save_custom_content" />
                  <input type="hidden" name="templateType" value={selectedTemplate?.key} />
                  <input type="hidden" name="customContent" value={customContent} />
                  <Button submit variant="primary" loading={isSubmitting}>
                    Save Custom Content
                  </Button>
                </Form>
                <Button 
                  onClick={handlePreviewClick}
                  loading={previewLoading}
                  disabled={!selectedTemplate || provider !== 'sendgrid'}
                >
                  Preview
                </Button>
              </InlineStack>
            </BlockStack>
          </BlockStack>
        </Card>

        {/* Preview - in its own card */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingSm" as="h3">
              Preview
            </Text>
            {previewLoading ? (
              <Text as="p">Loading preview...</Text>
            ) : (
              <Box
                padding="400"
                background="bg-surface-secondary"
                borderRadius="200"
                borderWidth="025"
                borderColor="border"
              >
                <div
                  className="email-preview-content"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                  style={{
                    maxWidth: '600px',
                    margin: '0 auto',
                    backgroundColor: '#ffffff',
                    color: '#202124',
                    padding: '20px',
                  }}
                />
              </Box>
            )}
          </BlockStack>
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
