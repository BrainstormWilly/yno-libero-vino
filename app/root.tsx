import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import "@shopify/polaris/build/esm/styles.css";

import type { Route } from "./+types/root";
import "./app.css";
import { PolarisThemeProvider } from "./components/PolarisThemeProvider";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {/* Apply theme early from URL params and localStorage to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Priority 1: Check URL params (Commerce7 passes adminUITheme)
                const urlParams = new URLSearchParams(window.location.search);
                const adminUITheme = urlParams.get('adminUITheme');
                if (adminUITheme === 'dark') {
                  document.documentElement.classList.add('dark');
                  document.documentElement.setAttribute('data-theme', 'dark');
                  localStorage.setItem('adminUITheme', 'dark');
                  return;
                }
                
                // Priority 2: Check localStorage (cached preference from previous session)
                const cachedTheme = localStorage.getItem('adminUITheme');
                if (cachedTheme === 'dark') {
                  document.documentElement.classList.add('dark');
                  document.documentElement.setAttribute('data-theme', 'dark');
                  return;
                }
                
                // Priority 3: Default to light
                document.documentElement.classList.add('light');
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('adminUITheme', 'light');
              })();
            `,
          }}
        />
        {/* Load iframe-resizer content window script for Commerce7 embedded app */}
        <script 
          type="text/javascript" 
          src="https://cdnjs.cloudflare.com/ajax/libs/iframe-resizer/4.3.2/iframeResizer.contentWindow.min.js"
        />
        {/* Load Commerce7 embedded app SDK */}
        <script 
          type="text/javascript" 
          src="https://dev-center.platform.commerce7.com/v2/commerce7.js"
        />
      </head>
      <body className="font-sans antialiased">
        <PolarisThemeProvider
          i18n={{
            Polaris: {
              Common: {
                checkbox: 'checkbox',
                undo: 'undo',
                cancel: 'Cancel',
                clear: 'Clear',
                submit: 'Submit',
                more: 'More',
                search: 'Search',
                filter: 'Filter',
                refresh: 'Refresh',
                close: 'Close',
                loading: 'Loading',
                optional: 'Optional',
              },
            },
          }}
        >
          {children}
        </PolarisThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
