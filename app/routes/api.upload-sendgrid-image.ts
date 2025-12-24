/**
 * SendGrid Email Image Upload API
 * 
 * Handles uploading header and footer images for SendGrid email templates
 * Only accessible for SendGrid clients
 */

import { type ActionFunctionArgs } from 'react-router';
import type { AppSessionData } from '~/lib/session-storage.server';
import { getAppSession } from '~/lib/sessions.server';
import { getClient, updateClientEmailImages, getCommunicationConfig } from '~/lib/db/supabase.server';
import { uploadSendGridClientImage } from '~/lib/storage/sendgrid-images.server';

export async function action({ request }: ActionFunctionArgs) {
  const session: AppSessionData | null = await getAppSession(request);
  
  if (!session) {
    throw new Response('Unauthorized', { status: 401 });
  }
  
  const { clientId } = session;
  
  // Verify client exists
  const client = await getClient(clientId);
  if (!client) {
    throw new Response('Client not found', { status: 404 });
  }
  
  // Verify client uses SendGrid
  const commConfig = await getCommunicationConfig(clientId);
  if (!commConfig || commConfig.email_provider !== 'sendgrid') {
    throw new Response('This endpoint is only available for SendGrid clients', { status: 403 });
  }
  
  const formData = await request.formData();
  const file = formData.get('image') as File;
  const imageType = formData.get('imageType') as 'header' | 'footer';
  
  if (!file) {
    return { success: false, error: 'No file provided' };
  }
  
  if (!imageType || !['header', 'footer'].includes(imageType)) {
    return { success: false, error: 'Invalid imageType. Must be "header" or "footer"' };
  }
  
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { success: false, error: 'Invalid file type. Must be JPEG, PNG, GIF, or WebP' };
  }
  
  // Validate file size (5MB limit)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return { success: false, error: 'File size exceeds 5MB limit' };
  }
  
  try {
    // Upload to Supabase Storage
    const publicUrl = await uploadSendGridClientImage(clientId, file, imageType);
    
    // Update client email image URL in database
    await updateClientEmailImages(clientId, {
      [imageType === 'header' ? 'emailHeaderImageUrl' : 'emailFooterImageUrl']: publicUrl,
    });
    
    return { success: true, url: publicUrl };
  } catch (error) {
    console.error('Image upload error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Upload failed' 
    };
  }
}

