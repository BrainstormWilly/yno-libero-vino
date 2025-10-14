import type { WebhookTopic } from '~/types/crm';
import { getWebhookUrl } from './subdomain';

/**
 * Utility functions for managing CRM webhooks
 */

/**
 * Get all available webhook topics
 */
export function getAvailableWebhookTopics(): WebhookTopic[] {
  return [
    'customers/create',
    'customers/update',
    'customers/delete',
    'orders/create',
    'orders/update',
    'orders/cancelled',
    'products/create',
    'products/update',
    'products/delete'
  ];
}

/**
 * Get the webhook endpoint URL for a specific CRM
 */
export function getWebhookEndpoint(crmType: 'commerce7' | 'shopify'): string {
  const prefix = crmType === 'commerce7' ? 'c7' : 'shp';
  const path = `/webhooks/${prefix}`;
  return getWebhookUrl(crmType, path);
}

/**
 * Format webhook topic for display
 */
export function formatWebhookTopic(topic: WebhookTopic): string {
  const [resource, action] = topic.split('/');
  return `${capitalize(resource)} ${capitalize(action)}`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get recommended webhook topics for initial setup
 */
export function getRecommendedWebhooks(): WebhookTopic[] {
  return [
    'customers/create',
    'customers/update',
    'orders/create',
    'orders/update',
    'products/create',
    'products/update'
  ];
}

