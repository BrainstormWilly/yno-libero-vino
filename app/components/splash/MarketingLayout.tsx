import type { ReactNode } from "react";
import SplashHeader from "./SplashHeader";

type MarketingLayoutProps = {
  children: ReactNode;
};

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="marketing-layout fixed inset-0 bg-white flex flex-col">
      <SplashHeader variant="light" />
      <main className="flex-1 overflow-y-auto pt-24 mx-auto w-full max-w-6xl px-6 pb-16">
        {children}
      </main>
    </div>
  );
}
