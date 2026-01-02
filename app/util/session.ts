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
  // Ensure URL is properly formatted (starts with /)
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  const separator = cleanUrl.includes('?') ? '&' : '?';
  // Encode the session ID to handle special characters
  const encodedSessionId = encodeURIComponent(sessionId);
  return `${cleanUrl}${separator}session=${encodedSessionId}`;
}

