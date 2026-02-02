import { useLocation } from "react-router";
import CookieBanner from "./CookieBanner";

const MARKETING_PATHS = [
  "/",
  "/about",
  "/learn",
  "/faqs",
  "/contact",
  "/docs",
];

function isMarketingRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return MARKETING_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export default function CookieBannerWrapper() {
  const { pathname } = useLocation();

  if (!isMarketingRoute(pathname)) return null;

  return <CookieBanner />;
}
