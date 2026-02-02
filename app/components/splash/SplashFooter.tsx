import { Link } from "@heroui/link";

type SplashFooterVariant = "dark" | "light";

type SplashFooterProps = {
  variant?: SplashFooterVariant;
};

export default function SplashFooter({ variant = "light" }: SplashFooterProps) {
  const linkClass = variant === "dark" ? "text-white" : "text-gray-700";

  return (
    <footer className="mt-auto border-t border-gray-200 px-6 py-4">
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
        <span className={variant === "dark" ? "text-white" : "text-gray-700"}>
          © Yno Software 2026
        </span>
        <span>|</span>
        <Link target="_blank" rel="noreferrer" href="https://ynosoftware.com/privacy" className={linkClass}>
          Privacy
        </Link>
        <span>|</span>
        <Link target="_blank" rel="noreferrer" href="https://ynosoftware.com/terms" className={linkClass}>
          Terms
        </Link>
        <span>|</span>
        <Link href="/docs/sms-opt-in" className={linkClass}>
          SMS Opt-In
        </Link>
        <span>|</span>
        <Link href="/docs/sms-opt-in-demo" className={linkClass}>
          SMS Opt-In Demo
        </Link>
      </div>
    </footer>
  );
}
