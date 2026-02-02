import { useState, useEffect } from "react";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";

const STORAGE_KEY = "cookieConsent";

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setIsVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem(STORAGE_KEY, "rejected");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white px-6 py-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]"
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 sm:flex-row sm:justify-between sm:gap-6">
        <p className="text-center text-sm text-gray-700 sm:text-left">
          We use cookies to improve your experience. By continuing, you accept
          our use of cookies.{" "}
          <Link
            href="https://ynosoftware.com/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-primary"
          >
            Privacy Policy
          </Link>
        </p>
        <div className="flex shrink-0 gap-3">
          <Button color="secondary" variant="bordered" size="sm" onPress={handleReject}>
            Reject Non-Essential
          </Button>
          <Button color="primary" size="sm" onPress={handleAccept}>
            Accept All
          </Button>
        </div>
      </div>
    </div>
  );
}
