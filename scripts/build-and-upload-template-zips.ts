/**
 * Script to build zip files for Klaviyo and Mailchimp email templates
 * and upload them to Supabase storage
 * 
 * Usage:
 *   npx tsx scripts/build-and-upload-template-zips.ts
 */

import { config as loadEnv } from 'dotenv';
import { createWriteStream } from 'fs';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

const TEMPLATES_DIR = join(PROJECT_ROOT, 'docs', 'templates');
const STORAGE_BUCKET = 'sendgrid-email-images'; // Using the same bucket as SendGrid images
const TEMP_DIR = join(PROJECT_ROOT, 'tmp');

async function createZipFile(
  provider: 'klaviyo' | 'mailchimp',
  files: Array<{ path: string; name: string }>,
  outputPath: string
): Promise<void> {
  // Try to use native zip command first (simpler, no dependencies)
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  try {
    // Use zip command if available - change to provider directory and zip all files
    const providerDir = join(TEMPLATES_DIR, provider);
    const fileNames = files.map(f => f.name).join(' ');
    // Use absolute path for output and change to provider directory to preserve relative paths
    const zipCommand = `cd "${providerDir}" && zip -r "${outputPath}" ${fileNames}`;
    await execAsync(zipCommand);
    console.log(`✅ Created zip file: ${outputPath}`);
    return;
  } catch (error: any) {
    // Fall back to archiver if zip command not available
    if (error.code !== 'ENOENT' && !error.message?.includes('command not found')) {
      // If it's not a "command not found" error, re-throw it
      throw error;
    }
    console.log('📦 zip command not available, trying archiver...');
  }
  
  // Fallback: Use archiver package
  try {
    const archiver = (await import('archiver')).default;
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = createWriteStream(outputPath);
    
    return new Promise((resolve, reject) => {
      archive.pipe(stream);
      
      files.forEach(file => {
        archive.file(file.path, { name: file.name });
      });
      
      archive.finalize();
      
      stream.on('close', () => {
        console.log(`✅ Created zip file: ${outputPath} (${archive.pointer()} bytes)`);
        resolve();
      });
      
      archive.on('error', reject);
    });
  } catch (error) {
    console.error('❌ Error creating zip file:', error);
    console.error('\n💡 To use archiver (recommended for cross-platform):');
    console.error('   npm install --save-dev archiver @types/archiver');
    console.error('\n💡 Or use native zip command (macOS/Linux):');
    console.error('   Make sure zip is installed: brew install zip (macOS)');
    throw error;
  }
}

async function uploadToSupabase(filePath: string, fileName: string): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Read the file
  const fileBuffer = await readFile(filePath);
  
  // Upload to storage
  // Supabase storage may have restrictions on zip files - try without contentType first
  const storagePath = `templates/${fileName}`;
  
  // Try uploading without contentType (Supabase will infer it)
  let { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, fileBuffer, {
      upsert: true, // Overwrite if exists
    });
  
  // If that fails, try with application/octet-stream (generic binary)
  if (error && error.message.includes('mime type')) {
    console.log('   Retrying with application/octet-stream content type...');
    ({ data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: 'application/octet-stream',
        upsert: true,
      }));
  }
  
  // If still failing, the bucket might need to be configured to allow zip files
  if (error && error.message.includes('mime type')) {
    console.error(`\n❌ Upload failed: ${error.message}`);
    console.error('\n💡 The Supabase storage bucket needs to allow zip files.');
    console.error('   You can update the bucket configuration in the Supabase dashboard:');
    console.error(`   1. Go to Storage → ${STORAGE_BUCKET} → Settings`);
    console.error('   2. Add "application/zip" and "application/octet-stream" to Allowed MIME types');
    console.error('   Or run this script with --update-bucket flag to update it programmatically');
    throw new Error(`Failed to upload ${fileName}: ${error.message}. Bucket may need configuration.`);
  }
  
  if (error) {
    throw new Error(`Failed to upload ${fileName}: ${error.message}`);
  }
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(data.path);
  
  console.log(`✅ Uploaded ${fileName} to Supabase storage`);
  console.log(`   Public URL: ${publicUrl}`);
  
  return publicUrl;
}

async function buildAndUploadTemplates(provider: 'klaviyo' | 'mailchimp'): Promise<string> {
  const providerDir = join(TEMPLATES_DIR, provider);
  const files: Array<{ path: string; name: string }> = [];
  
  // Read all files in the provider directory
  const entries = await readdir(providerDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isFile()) {
      const filePath = join(providerDir, entry.name);
      files.push({
        path: filePath,
        name: entry.name,
      });
    }
  }
  
  if (files.length === 0) {
    throw new Error(`No files found in ${providerDir}`);
  }
  
  console.log(`\n📦 Building ${provider} zip file...`);
  console.log(`   Files to include: ${files.map(f => f.name).join(', ')}`);
  
  // Create zip file
  const zipFileName = `liberovino-${provider}-templates.zip`;
  const zipFilePath = join(TEMP_DIR, zipFileName);
  
  // Ensure temp directory exists
  const { mkdir } = await import('fs/promises');
  await mkdir(TEMP_DIR, { recursive: true });
  
  await createZipFile(provider, files, zipFilePath);
  
  // Upload to Supabase
  console.log(`\n☁️  Uploading ${provider} zip file to Supabase...`);
  const publicUrl = await uploadToSupabase(zipFilePath, zipFileName);
  
  // Clean up local zip file
  const { unlink } = await import('fs/promises');
  await unlink(zipFilePath);
  console.log(`🗑️  Cleaned up local zip file`);
  
  return publicUrl;
}

async function updateBucketMimeTypes(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Get current bucket configuration
  const { data: bucket, error: getError } = await supabase.storage.getBucket(STORAGE_BUCKET);
  
  if (getError) {
    throw new Error(`Failed to get bucket: ${getError.message}`);
  }
  
  // Get existing allowed MIME types or use default image types
  const existingTypes = bucket.allowed_mime_types || ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const newTypes = [...new Set([...existingTypes, 'application/zip', 'application/octet-stream'])];
  
  // Update bucket to allow zip files
  const { error: updateError } = await supabase.storage.updateBucket(STORAGE_BUCKET, {
    allowedMimeTypes: newTypes,
    public: true
  });
  
  if (updateError) {
    throw new Error(`Failed to update bucket: ${updateError.message}`);
  }
  
  console.log(`✅ Updated bucket ${STORAGE_BUCKET} to allow zip files`);
  console.log(`   Allowed MIME types: ${newTypes.join(', ')}`);
}

async function main() {
  try {
    const args = process.argv.slice(2);
    
    // Check if we should update bucket configuration first
    if (args.includes('--update-bucket')) {
      console.log('🔧 Updating bucket configuration to allow zip files...\n');
      await updateBucketMimeTypes();
      console.log('');
    }
    
    console.log('🚀 Building and uploading email template zip files...\n');
    
    const klaviyoUrl = await buildAndUploadTemplates('klaviyo');
    const mailchimpUrl = await buildAndUploadTemplates('mailchimp');
    
    console.log('\n✨ Successfully built and uploaded all template zip files!');
    console.log('\n📋 Public URLs:');
    console.log(`   Klaviyo: ${klaviyoUrl}`);
    console.log(`   Mailchimp: ${mailchimpUrl}`);
    console.log('\n💡 These URLs can be used in your API endpoint to serve the zip files.');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error && error.message.includes('mime type')) {
      console.error('\n💡 Try running with --update-bucket flag:');
      console.error('   npx tsx scripts/build-and-upload-template-zips.ts --update-bucket');
    }
    process.exit(1);
  }
}

main();
