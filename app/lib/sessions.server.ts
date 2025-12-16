/**
 * Session Management for LiberoVino
 * 
 * Uses DATABASE storage (NO COOKIES) for both Commerce7 and Shopify
 * Session ID is passed via URL parameter: ?session=xxx
 * 
 * Why no cookies?
 * - Shopify embedded apps don't allow cookies in iframes
 * - C7 doesn't need them either, so we use a unified approach
 */

import type { CrmTypes } from '~/types/crm';
import { redirect } from 'react-router';
import { 
  type AppSessionData,
  storeSession,
  loadSession,
  deleteSession,
  createSessionId,
  getSessionIdFromRequest,
  addSessionToUrl,
} from './session-storage.server';

/**
 * Get current session from request (via URL parameter)
 * DEV MODE: Returns fake session if IN_COMMERCE7=no
 */
export async function getAppSession(
  request: Request, 
  crmType?: CrmTypes
): Promise<AppSessionData | null> {
  // DEV MODE: Bypass authentication for local testing
  // if (process.env.NODE_ENV === 'development' && process.env.IN_COMMERCE7 === 'no') {
  //   console.log('🔓 DEV MODE: Using yno-fanbase session (IN_COMMERCE7=no)');
  //   return {
  //     id: 'dev-session-id',
  //     clientId: 'yno-fanbase-client-id',
  //     tenantShop: 'yno-fanbase',
  //     crmType: 'commerce7',
  //     userName: 'William Langley',
  //     userEmail: 'will@ynosoftware.com',
  //     theme: 'light',
  //   };
  // }

  // Get session ID from URL parameter
  const url = new URL(request.url);
  let sessionId = url.searchParams.get('session');
  
  // If CRM type not provided, try to detect it from request
  if (!crmType) {
    const hostname = url.hostname;
    if (hostname.startsWith('c7.') || hostname.includes('commerce7')) {
      crmType = 'commerce7';
    } else if (hostname.startsWith('shp.') || hostname.includes('shopify')) {
      crmType = 'shopify';
    }
  }
  
  // If no session ID and we know the CRM type, try to get it from request
  if (!sessionId && crmType) {
    sessionId = getSessionIdFromRequest(request, crmType);
  }

  if (!sessionId) {
    return null;
  }

  return await loadSession(sessionId);
}

export function getFakeAppSession(crmType: CrmTypes): AppSessionData {
  return {
    id: `${crmType}-dev-session-id`,
    clientId: `yno-fake-${crmType}-client-id`,
    tenantShop: `fake-client-${crmType}`,
    crmType,
    userName: 'William Langley',
    userEmail: 'will@ynosoftware.com',
    theme: 'light'
  };
}

/**
 * Require session or redirect to home
 * DEV MODE: Returns fake session if IN_COMMERCE7=no
 */
export async function requireAppSession(
  request: Request,
  crmType?: 'commerce7' | 'shopify'
): Promise<AppSessionData> {
  // DEV MODE: Bypass authentication for local testing
  if (process.env.NODE_ENV === 'development' && process.env.IN_COMMERCE7 === 'no') {
    console.log('🔓 DEV MODE: Using yno-fanbase session (IN_COMMERCE7=no)');
    return {
      id: 'dev-session-id',
      clientId: 'yno-fanbase-client-id',
      tenantShop: 'yno-fanbase',
      crmType: 'commerce7',
      userName: 'William Langley',
      userEmail: 'will@ynosoftware.com',
      theme: 'light',
    };
  }

  const session = await getAppSession(request, crmType);
  
  if (!session) {
    throw redirect('/');
  }

  return session;
}

/**
 * Create a new session and return the session ID
 * Caller is responsible for adding session ID to redirect URL
 */
export async function createAppSession(
  data: Omit<AppSessionData, 'id'>
): Promise<string> {
  const sessionId = createSessionId(data.crmType, data.tenantShop);
  
  const success = await storeSession({
    ...data,
    id: sessionId,
  });

  if (!success) {
    throw new Error('Failed to create session');
  }

  return sessionId;
}

/**
 * Update an existing session
 */
export async function updateAppSession(
  sessionId: string,
  updates: Partial<Omit<AppSessionData, 'id' | 'clientId' | 'tenantShop' | 'crmType'>>
): Promise<boolean> {
  // Load existing session
  const existing = await loadSession(sessionId);
  if (!existing) {
    return false;
  }

  // Merge updates
  const updated: AppSessionData = {
    ...existing,
    ...updates,
    id: sessionId, // Ensure ID doesn't change
  };

  return await storeSession(updated);
}

/**
 * Delete session (logout)
 */
export async function destroyAppSession(sessionId: string): Promise<boolean> {
  return await deleteSession(sessionId);
}

/**
 * Helper to add session to URL for navigation
 * Use this when creating links or redirects
 */
export function withSession(url: string, sessionId: string): string {
  return addSessionToUrl(url, sessionId);
}

/**
 * Helper to get session ID from current request
 * Returns null if no session found
 */
export function getSessionId(request: Request): string | null {
  const url = new URL(request.url);
  return url.searchParams.get('session');
}

/**
 * Helper to create redirect response with session preserved
 * Ensures HTTPS protocol for embedded Commerce7 apps
 */
export function redirectWithSession(url: string, sessionId: string, init?: ResponseInit): Response {
  let urlWithSession = withSession(url, sessionId);
  
  // If URL is absolute and uses HTTP, convert to HTTPS
  if (urlWithSession.startsWith('http://')) {
    urlWithSession = urlWithSession.replace('http://', 'https://');
  }
  
  throw redirect(urlWithSession, init);
}
