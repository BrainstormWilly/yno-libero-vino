import { useState, useRef } from 'react';
import { Form, useNavigation } from 'react-router';
import { Card, BlockStack, Text, Banner, TextField, InlineStack, Button, Thumbnail } from '@shopify/polaris';
import EmailPreferencesForm from '../EmailPreferencesForm';
import type { EmailProviderComponentProps } from './types';

export default function LiberoVinoManagedEmailProvider({ existingConfig, actionData, hasSms, onContinue, client }: EmailProviderComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  
  const config = existingConfig;
  
  const [warningDays, setWarningDays] = useState(
    (config?.warning_days_before || 7).toString()
  );
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [headerImageUrl, setHeaderImageUrl] = useState(client?.email_header_image_url || '');
  const [footerImageUrl, setFooterImageUrl] = useState(client?.email_footer_image_url || '');
  const [uploading, setUploading] = useState<'header' | 'footer' | null>(null);
  
  const headerInputRef = useRef<HTMLInputElement>(null);
  const footerInputRef = useRef<HTMLInputElement>(null);

  const handleWarningDaysChange = (value: string) => {
    setWarningDays(value);
  };
  
  const handleImageUpload = async (imageType: 'header' | 'footer', file: File) => {
    setUploading(imageType);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('imageType', imageType);
      
      const response = await fetch('/api/upload-sendgrid-image', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      if (result.success && result.url) {
        if (imageType === 'header') {
          setHeaderImageUrl(result.url);
        } else {
          setFooterImageUrl(result.url);
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

  return (
    <BlockStack gap="400">
      {/* Main Configuration Form */}
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h3">
            Email Provider: LiberoVino Managed
          </Text>
          
          <Banner tone="success">
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                No Configuration Needed
              </Text>
              <Text as="p" variant="bodySm">
                LiberoVino will handle all email sending using our managed service. 
                You can always switch to Klaviyo or Mailchimp later for advanced features.
              </Text>
            </BlockStack>
          </Banner>
          
          {/* Email Image Upload Section - SendGrid Only */}
          <BlockStack gap="400">
            <Text variant="headingSm" as="h4">
              Email Images (Optional)
            </Text>
            <Text variant="bodySm" tone="subdued" as="p">
              Upload custom header and footer images for your email templates. If not provided, default LiberoVino images will be used.
            </Text>
            
            {/* Header Image */}
            <BlockStack gap="200">
              <Text variant="bodyMd" fontWeight="semibold" as="p">
                Header Image
              </Text>
              {headerImageUrl && (
                <Thumbnail
                  source={headerImageUrl}
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
              <Button
                onClick={() => headerInputRef.current?.click()}
                loading={uploading === 'header'}
                disabled={uploading !== null}
              >
                {headerImageUrl ? 'Replace Header Image' : 'Upload Header Image'}
              </Button>
            </BlockStack>
            
            {/* Footer Image */}
            <BlockStack gap="200">
              <Text variant="bodyMd" fontWeight="semibold" as="p">
                Footer Image
              </Text>
              {footerImageUrl && (
                <Thumbnail
                  source={footerImageUrl}
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
              <Button
                onClick={() => footerInputRef.current?.click()}
                loading={uploading === 'footer'}
                disabled={uploading !== null}
              >
                {footerImageUrl ? 'Replace Footer Image' : 'Upload Footer Image'}
              </Button>
            </BlockStack>
          </BlockStack>
          
          <EmailPreferencesForm
            warningDays={warningDays}
            onWarningDaysChange={handleWarningDaysChange}
          />
        </BlockStack>
      </Card>

      {/* Confirm Provider Section */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h3">
              Confirm Provider
            </Text>
            <Text variant="bodyMd" as="p" tone="subdued">
              Send a test email{hasSms ? ' and SMS' : ''} to verify your configuration. This will send a simple transactional message{hasSms ? 's' : ''} using your current settings. Once confirmed, you can proceed to template setup.
            </Text>

            {/* Result Banner - Hide during submission to clear previous results */}
            {actionData && actionData.message && !isSubmitting && (
              <Banner 
                tone={actionData.success ? 'success' : 'critical'} 
                title={actionData.message}
              />
            )}

            <Form method="post">
              <input type="hidden" name="intent" value="confirm_provider" />
              {/* Always send sendgrid as the provider for LiberoVino Managed */}
              <input type="hidden" name="email_provider" value="sendgrid" />
              {/* Transactional notifications are always enabled */}
              <input type="hidden" name="send_monthly_status" value="true" />
              <input type="hidden" name="send_expiration_warnings" value="true" />
              {config?.warning_days_before !== undefined && config.warning_days_before !== null && (
                <input type="hidden" name="warning_days_before" value={config.warning_days_before.toString()} />
              )}

              <BlockStack gap="200">
                <TextField
                  label="Recipient email"
                  type="email"
                  value={testEmail}
                  onChange={setTestEmail}
                  autoComplete="email"
                  requiredIndicator
                  disabled={isSubmitting}
                />

                <input type="hidden" name="test_email" value={testEmail} />

                {hasSms && (
                  <TextField
                    label="Recipient phone (optional)"
                    type="tel"
                    value={testPhone}
                    onChange={setTestPhone}
                    autoComplete="tel"
                    placeholder="+15551234567"
                    disabled={isSubmitting}
                    helpText="Test SMS will be sent via LiberoVino Managed"
                  />
                )}

                {hasSms && <input type="hidden" name="test_phone" value={testPhone} />}

                <InlineStack gap="200">
                  {actionData?.confirmed ? (
                    <Button variant="primary" onClick={onContinue}>
                      Continue to Templates →
                    </Button>
                  ) : (
                    <Button submit variant="primary" loading={isSubmitting} disabled={isSubmitting}>
                      {isSubmitting ? (hasSms && testPhone ? 'Sending test email and SMS...' : 'Sending test email...') : 'Confirm Provider'}
                    </Button>
                  )}
                </InlineStack>
              </BlockStack>
            </Form>
          </BlockStack>
        </Card>
    </BlockStack>
  );
}

