/**
 * Parent layout for multi-route setup wizard
 * Provides session context to all child routes via Outlet
 * 
 * Routes:
 * - /setup (index) - Welcome + Club Name/Description
 * - /setup/tiers - Tier summary cards
 * - /setup/tiers/:id - Edit specific tier
 * - /setup/review - Final review and submit
 */

import { Outlet } from 'react-router';

export default function SetupLayout() {
  // Just render child routes
  // Session is available from parent /app route
  return <Outlet />;
}
