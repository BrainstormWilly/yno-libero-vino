/**
 * Navigation utilities for consistent navigation actions across the app
 */

import type { MenuActionDescriptor } from '@shopify/polaris';
import { addSessionToUrl } from './session';

export interface NavigationConfig {
  sessionId: string;
  currentPath?: string;
  isSetupIncomplete?: boolean;
}

/**
 * Get standard navigation actions for main app sections
 * Returns actions for Dashboard, Members, and Settings
 */
export function getMainNavigationActions(config: NavigationConfig): MenuActionDescriptor[] {
  const { sessionId, currentPath, isSetupIncomplete = false } = config;
  
  // Normalize current path (remove query params and trailing slashes)
  const normalizedPath = currentPath ? currentPath.split('?')[0].replace(/\/$/, '') : '';
  
  const actions: MenuActionDescriptor[] = [
    {
      content: 'Dashboard',
      url: addSessionToUrl('/app', sessionId),
      disabled: isSetupIncomplete || normalizedPath === '/app' || normalizedPath === '',
    },
    {
      content: 'Members',
      url: addSessionToUrl('/app/members', sessionId),
      disabled: isSetupIncomplete || normalizedPath.startsWith('/app/members'),
    },
    {
      content: 'Settings',
      url: addSessionToUrl('/app/settings', sessionId),
      disabled: isSetupIncomplete || normalizedPath.startsWith('/app/settings'),
    },
  ];
  
  return actions;
}

