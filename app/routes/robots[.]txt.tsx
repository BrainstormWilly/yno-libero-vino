import type { Route } from "./+types/robots[.]txt";

export async function loader({ request }: Route.LoaderArgs) {
  const robotsTxt = `User-agent: *
Allow: /

# Disallow admin and internal routes
Disallow: /app/
Disallow: /install
Disallow: /uninstall
Disallow: /webhooks/
Disallow: /api/

# Allow public documentation
Allow: /docs/

Sitemap: https://liberovino.wine/sitemap.xml
`;

  return new Response(robotsTxt, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

