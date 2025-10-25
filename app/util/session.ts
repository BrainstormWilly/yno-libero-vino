/**
 * Client-side session utilities
 * 
 * These utilities can be safely used in client components (browser context)
 */

/**
 * Add session parameter to a URL (client-side safe)
 * @param url - The URL to add the session parameter to
 * @param sessionId - The session ID to add
 * @returns URL with session parameter appended
 */
export function addSessionToUrl(url: string, sessionId: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}session=${sessionId}`;
}

