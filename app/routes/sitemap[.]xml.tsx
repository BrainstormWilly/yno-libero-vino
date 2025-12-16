import type { Route } from "./+types/sitemap[.]xml";

export async function loader({ request }: Route.LoaderArgs) {
  const baseUrl = "https://liberovino.wine";
  
  // Public routes that should be indexed
  const routes = [
    { url: `${baseUrl}/`, changefreq: "weekly", priority: "1.0" },
    { url: `${baseUrl}/docs/sms-opt-in`, changefreq: "monthly", priority: "0.8" },
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${route.url}</loc>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(sitemap, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

