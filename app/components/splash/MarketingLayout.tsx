import type { ReactNode } from "react";
import SplashFooter from "./SplashFooter";
import SplashHeader from "./SplashHeader";

type MarketingLayoutProps = {
  children: ReactNode;
};

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="marketing-layout fixed inset-0 bg-white flex flex-col">
      <SplashHeader variant="light" />
      <div className="flex-1 overflow-y-auto">
        <main className="pt-24 mx-auto w-full max-w-6xl px-6 pb-16">
          {children}
        </main>
        <SplashFooter variant="light" />
      </div>
    </div>
  );
}
