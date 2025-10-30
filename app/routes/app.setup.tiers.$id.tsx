/**
 * Layout wrapper for tier editor and nested promotion routes
 * Provides tier context to all child routes
 */

import { Outlet } from 'react-router';

export default function TierLayout() {
  return <Outlet />;
}
