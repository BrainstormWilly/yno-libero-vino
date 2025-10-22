/**
 * Utility functions for handling subdomain-based routing
 */

import type { CrmTypes } from '~/types/crm';

export type SubdomainType = 'c7' | 'shp' | 'www' | null;

export interface SubdomainInfo {
  subdomain: SubdomainType;
  crmType: CrmTypes | null;
  isValid: boolean;
}

/**
 * Extracts the subdomain from a request URL
 * @param request - The incoming request
 * @returns SubdomainInfo object with subdomain details
 */
export function getSubdomainInfo(request: Request): SubdomainInfo {
  const url = new URL(request.url);
  const hostname = url.hostname;
  
  // Handle localhost and development environments
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('.local')) {
    // Check for subdomain in localhost format (e.g., c7.localhost:3000)
    const parts = hostname.split('.');
    if (parts.length > 1 && parts[0]) {
      return getSubdomainMapping(parts[0]);
    }
    // Default to null for plain localhost
    return { subdomain: null, crmType: null, isValid: false };
  }
  
  // Handle Ngrok URLs (e.g., c7-kindly-balanced-macaw.ngrok-free.app)
  // Ngrok format uses dash to separate subdomain from the main ngrok domain
  if (hostname.includes('.ngrok-free.app') || hostname.includes('.ngrok.io')) {
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      // Check if first part contains a subdomain prefix (e.g., "c7-kindly-balanced-macaw")
      const firstPart = parts[0];
      if (firstPart.startsWith('c7-')) {
        return getSubdomainMapping('c7');
      } else if (firstPart.startsWith('shp-')) {
        return getSubdomainMapping('shp');
      }
    }
    // Plain ngrok URL without subdomain
    return { subdomain: null, crmType: null, isValid: false };
  }
  
  // For production domains (e.g., c7.yourdomain.com)
  const parts = hostname.split('.');
  
  // Need at least 3 parts for a subdomain (subdomain.domain.tld)
  if (parts.length >= 3 && parts[0]) {
    return getSubdomainMapping(parts[0]);
  }
  
  // No valid subdomain found
  return { subdomain: null, crmType: null, isValid: false };
}

/**
 * Maps subdomain to CRM type
 */
function getSubdomainMapping(subdomain: string): SubdomainInfo {
  switch (subdomain) {
    case 'c7':
      return { subdomain: 'c7', crmType: 'commerce7', isValid: true };
    case 'shp':
      return { subdomain: 'shp', crmType: 'shopify', isValid: true };
    case 'www':
      return { subdomain: 'www', crmType: null, isValid: true };
    default:
      return { subdomain: null, crmType: null, isValid: false };
  }
}

/**
 * Validates if the current subdomain matches the expected CRM type
 */
export function validateSubdomainForCrm(
  request: Request,
  expectedCrmType: 'commerce7' | 'shopify'
): boolean {
  const info = getSubdomainInfo(request);
  return info.crmType === expectedCrmType;
}

/**
 * Gets the URL for a specific CRM subdomain
 */
export function getCrmUrl(
  currentUrl: string,
  crmType: 'commerce7' | 'shopify',
  path: string = '/'
): string {
  const url = new URL(currentUrl);
  const subdomain = crmType === 'commerce7' ? 'c7' : 'shp';
  
  // Handle localhost
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return `${url.protocol}//${subdomain}.${url.hostname}:${url.port}${path}`;
  }
  
  // Handle Ngrok URLs - use dash prefix instead of subdomain
  if (url.hostname.includes('.ngrok-free.app') || url.hostname.includes('.ngrok.io')) {
    // Extract the base ngrok URL (everything after the first dash if present)
    const parts = url.hostname.split('.');
    const firstPart = parts[0];
    // Remove any existing subdomain prefix
    const baseNgrokName = firstPart.replace(/^(c7|shp)-/, '');
    // Rebuild with new subdomain prefix
    const newHostname = `${subdomain}-${baseNgrokName}.${parts.slice(1).join('.')}`;
    return `${url.protocol}//${newHostname}${path}`;
  }
  
  // Handle production domains
  const parts = url.hostname.split('.');
  if (parts.length >= 2) {
    // Replace or add subdomain
    const domain = parts.length >= 3 ? parts.slice(1).join('.') : url.hostname;
    return `${url.protocol}//${subdomain}.${domain}${path}`;
  }
  
  return url.toString();
}

/**
 * Gets the webhook URL for a specific CRM
 * Uses Ngrok URL in development, production URL otherwise
 */
export function getWebhookUrl(
  crmType: 'commerce7' | 'shopify',
  path: string = '/'
): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const subdomain = crmType === 'commerce7' ? 'c7' : 'shp';
  
  if (!isProduction && process.env.NGROK_URL) {
    // Use Ngrok URL for development
    return `https://${subdomain}-${process.env.NGROK_URL}${path}`;
  }
  
  // Use production domain
  const baseDomain = process.env.BASE_DOMAIN || 'yourdomain.com';
  return `https://${subdomain}.${baseDomain}${path}`;
}

