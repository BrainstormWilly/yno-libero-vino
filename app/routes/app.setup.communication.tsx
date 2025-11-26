/**
 * Parent layout for communication setup routes
 * Provides shared Page and Layout for child routes
 */

import { Outlet } from 'react-router';
import { Page, Layout } from '@shopify/polaris';

export default function CommunicationLayout() {
  return (
    <Page title="Communication Setup">
      <Layout>
        {/* Main content area */}
        <Layout.Section>
          <Outlet />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
