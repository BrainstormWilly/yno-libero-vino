import { AppProvider } from '@shopify/polaris';

interface PolarisThemeProviderProps {
  children: React.ReactNode;
  i18n: unknown;
}

export function PolarisThemeProvider({ children, i18n }: PolarisThemeProviderProps) {
  // Theme is applied via CSS classes on HTML element
  // Applied in root.tsx script tag (for initial load) and app.tsx useEffect (for route changes)
  return (
    <AppProvider
      i18n={i18n as never}
    >
      {children}
    </AppProvider>
  );
}

