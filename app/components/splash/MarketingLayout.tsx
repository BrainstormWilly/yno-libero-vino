import type { ReactNode } from "react";
import SplashHeader from "./SplashHeader";

type MarketingLayoutProps = {
  children: ReactNode;
};

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      <SplashHeader variant="light" />
      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-32 md:pt-24">
        {children}
      </main>
    </div>
  );
}
