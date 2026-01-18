import { Outlet } from 'react-router';
import MarketingLayout from '~/components/splash/MarketingLayout';

export default function Docs() {
  return (
    <MarketingLayout>
      <Outlet />
    </MarketingLayout>
  );
};
