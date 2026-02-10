/**
 * SendGrid Email Image Storage
 * Handles storage and retrieval of header/footer images for SendGrid email templates
 * Klaviyo/Mailchimp clients edit templates directly, so this is SendGrid-only
 */

import { getSupabaseClient } from '~/lib/db/supabase.server';

const BUCKET_NAME = 'sendgrid-email-images';
const DEFAULT_IMAGES_FOLDER = '_defaults';
const DEFAULT_FOOTER_IMAGE_NAME = 'powered-by-dark.png';

function getPublicStorageBaseUrl(): string {
  // In dev we may talk to a local Supabase instance (127.0.0.1),
  // but emails (Klaviyo/Mailchimp/SendGrid previews) need publicly reachable URLs.
  // If SUPABASE_PUBLIC_URL is set, prefer it for constructing public object URLs.
  const base = (process.env.SUPABASE_PUBLIC_URL || process.env.SUPABASE_URL || '').trim();
  return base.replace(/\/+$/, '');
}

function buildPublicObjectUrl(path: string): string {
  const baseUrl = getPublicStorageBaseUrl();
  if (!baseUrl) {
    throw new Error('SUPABASE_URL (or SUPABASE_PUBLIC_URL) is required to build public storage URLs.');
  }
  const cleanPath = path.replace(/^\/+/, '');
  return `${baseUrl}/storage/v1/object/public/${cleanPath}`;
}

/**
 * Get default LiberoVino header image URL
 * Default images are stored in a special '_defaults' folder
 */
export async function getDefaultHeaderImageUrl(): Promise<string> {
  return buildPublicObjectUrl(`${BUCKET_NAME}/${DEFAULT_IMAGES_FOLDER}/header.png`);
}

/**
 * Get default LiberoVino footer image URL
 */
export async function getDefaultFooterImageUrl(): Promise<string> {
  return buildPublicObjectUrl(`${BUCKET_NAME}/${DEFAULT_IMAGES_FOLDER}/footer.png`);
}

/**
 * Get default LiberoVino powered-by-dark.png image URL
 */
export async function getPoweredByDarkImageUrl(): Promise<string> {
  return buildPublicObjectUrl(`${BUCKET_NAME}/${DEFAULT_FOOTER_IMAGE_NAME}`);
}

/**
 * Upload a SendGrid client email image to Supabase Storage
 * @param clientId - The client ID (used for folder organization)
 * @param file - File to upload
 * @param imageType - 'header' or 'footer'
 * @returns Public URL of uploaded image
 */
export async function uploadSendGridClientImage(
  clientId: string,
  file: File | Blob,
  imageType: 'header' | 'footer'
): Promise<string> {
  const supabase = getSupabaseClient();
  
  // Determine file extension
  let fileExt = 'png';
  if (file instanceof File) {
    const extMatch = file.name.match(/\.([^.]+)$/);
    if (extMatch) {
      fileExt = extMatch[1].toLowerCase();
    }
    // Ensure extension is one of the allowed types
    if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) {
      fileExt = 'png';
    }
  }
  
  const filePath = `${clientId}/${imageType}.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      contentType: file.type || `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
      upsert: true, // Overwrite if exists
    });
  
  if (error) {
    throw new Error(`Failed to upload ${imageType} image: ${error.message}`);
  }
  
  // Get public URL
  return buildPublicObjectUrl(`${BUCKET_NAME}/${data.path}`);
}

/**
 * Delete a SendGrid client email image
 */
export async function deleteSendGridClientImage(
  clientId: string,
  imageType: 'header' | 'footer'
): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Try common extensions
  const extensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
  const paths = extensions.map(ext => `${clientId}/${imageType}.${ext}`);
  
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove(paths);
  
  // Error is OK if file doesn't exist
  if (error && !error.message.includes('not found')) {
    throw new Error(`Failed to delete ${imageType} image: ${error.message}`);
  }
}

/**
 * Get email image URLs for template rendering
 * Returns client's custom images for SendGrid, or default LiberoVino images for others
 */
export async function getEmailImageUrls(
  emailProvider: 'sendgrid' | 'klaviyo' | 'mailchimp',
  clientHeaderUrl: string | null | undefined,
  clientFooterUrl: string | null | undefined
): Promise<{ headerUrl: string; footerUrl: string }> {
  // Only use client images for SendGrid
  if (emailProvider === 'sendgrid') {
    return {
      headerUrl: clientHeaderUrl || await getDefaultHeaderImageUrl(),
      footerUrl: clientFooterUrl || await getDefaultFooterImageUrl(),
    };
  }
  
  // Klaviyo/Mailchimp clients will edit templates themselves, use defaults
  return {
    headerUrl: await getDefaultHeaderImageUrl(),
    footerUrl: await getDefaultFooterImageUrl(),
  };
}

