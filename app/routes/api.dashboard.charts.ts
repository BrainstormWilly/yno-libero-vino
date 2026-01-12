/**
 * Dashboard Charts API Resource Route
 * 
 * Provides chart data for dashboard visualizations
 * Supports date range filtering for upgrade/extension metrics
 */

import { type LoaderFunctionArgs } from 'react-router';
import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  
  if (!session) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const chartType = url.searchParams.get('type'); // 'upgrades', 'extensions', 'upgrade-frequency'
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');

  const dateRange = startDate && endDate 
    ? { startDate, endDate }
    : undefined;

  try {
    switch (chartType) {
      case 'upgrades': {
        const stats = await db.getUpgradeStats(session.clientId, dateRange);
        return {
          chartType: 'upgrades',
          data: stats.upgradesByDate,
          stats: {
            totalUpgrades: stats.totalUpgrades,
            uniqueCustomers: stats.uniqueCustomers,
          },
        };
      }

      case 'extensions': {
        const stats = await db.getExtensionStats(session.clientId, dateRange);
        return {
          chartType: 'extensions',
          data: stats.extensionsByDate,
          stats: {
            totalExtensions: stats.totalExtensions,
            uniqueCustomers: stats.uniqueCustomers,
          },
        };
      }

      case 'upgrade-frequency': {
        const stats = await db.getUpgradeStats(session.clientId, dateRange);
        // Format frequency data with labels
        const frequencyData = stats.upgradeFrequency.map(item => ({
          frequency: item.frequency,
          customerCount: item.customerCount,
          label: item.frequency === 3 ? '3+' : item.frequency.toString(),
        }));
        return {
          chartType: 'upgrade-frequency',
          data: frequencyData,
          stats: {
            totalUpgrades: stats.totalUpgrades,
            uniqueCustomers: stats.uniqueCustomers,
          },
        };
      }

      default:
        return {
          error: 'Invalid chart type. Use: upgrades, extensions, or upgrade-frequency',
        };
    }
  } catch (error) {
    console.error('Error fetching chart data:', error);
    return { 
      error: error instanceof Error ? error.message : 'Failed to fetch chart data',
      data: [],
    };
  }
}
