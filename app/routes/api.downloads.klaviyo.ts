/**
 * Public API endpoint: zip of Klaviyo templates + provider-specific documentation.
 * No auth required. Used from the learn communication page.
 * GET /api/downloads/klaviyo returns the zip file directly (no SPA layout).
 */

import { type LoaderFunctionArgs } from "react-router";
import { downloadTemplateForProvider } from "~/lib/communication/templates.server";

const TEMPLATE_TYPES = [
  "monthly-status",
  "expiration-warning",
  "expiration",
  "upgrade",
] as const;

const KLAVIYO_DOC = `# LiberoVino + Klaviyo

This zip contains sample HTML email templates (Klaviyo variable syntax) and this guide.

## Variables and triggers

LV does not send email through Klaviyo. It tracks events (metrics) in your Klaviyo account, and you trigger flows from those metrics (e.g. "Metric received: LiberoVino.MonthlyStatus"). Template variables use \`{{person.variable}}\` syntax in Klaviyo.

| Trigger description | Klaviyo metric name | Provided template variables |
|---------------------|---------------------|-----------------------------|
| Member joins club (welcome) | LiberoVino.ClubSignup | client_name, customer_first_name, discount_percentage, expiration_formatted, tier_upgrade_min_purchase, next_tier_name, next_tier_discount_percentage, shop_url, header_block, footer_image_block, custom_content_block |
| Monthly status update | LiberoVino.MonthlyStatus | client_name, customer_first_name, is_extended, expiration_formatted, extension_amount_needed, extension_deadline, has_upgrade, upgrade_*, current_discount_percentage, days_remaining, shop_url, status_body_message, extension_status_block, upgrade_offer_block, marketing_products_block |
| Monthly status promo | LiberoVino.MonthlyStatusPromo | Same as Monthly status |
| Expiration warning (e.g. 7 days left) | LiberoVino.ExpirationWarning | client_name, customer_first_name, days, extension_amount, discount_percentage, extension_expiration, extension_months, shop_url, upgrade_message_block, header_block, footer_image_block, custom_content_block |
| Expiration notice (benefits expired) | LiberoVino.ExpirationNotice | client_name, customer_first_name, rejoin_amount, discount_percentage, duration_months, shop_url, header_block, footer_image_block, custom_content_block |
| Tier upgrade (member qualified) | LiberoVino.TierUpgrade | client_name, customer_first_name, new_tier_discount_percentage, new_tier_duration_months, expiration_formatted, next_tier_upgrade_amount, next_tier_discount_percentage, shop_url, header_block, footer_image_block, custom_content_block |
| Annual re-sign opportunity | LiberoVino.AnnualResign | Typically expiration template vars |
| Sales spotlight | LiberoVino.SalesBlast | Marketing; customize as needed |
| Test | LiberoVino.TestMetric | Test |

## Suggested flows

Create flows in Klaviyo that trigger when LV sends a metric:

- **Club Signup Welcome** — trigger when metric \`LiberoVino.ClubSignup\` is received.
- **Monthly Status Update** — trigger when \`LiberoVino.MonthlyStatus\` is received (e.g. each month when LV runs the status job).
- **Expiration Warning** — trigger when \`LiberoVino.ExpirationWarning\` is received (member is within the warning window).
- **Expiration Notice** — trigger when \`LiberoVino.ExpirationNotice\` is received (benefits have expired).
- **Tier Upgrade** — trigger when \`LiberoVino.TierUpgrade\` is received (member qualified for an upgrade).
- Optional marketing: **Monthly Status Promo** (LiberoVino.MonthlyStatusPromo), **Annual Re-Sign Opportunity** (LiberoVino.AnnualResign), **Sales Spotlight** (LiberoVino.SalesBlast).

## Templates in this zip

- \`monthly-status.html\` — Monthly status update
- \`expiration-warning.html\` — Expiration warning (e.g. 7 days left)
- \`expiration.html\` — Expiration notice (benefits expired)
- \`upgrade.html\` — Tier upgrade congratulations

Import or paste into Klaviyo flows and map your person properties to the \`{{person.variable}}\` placeholders.
`;

export async function loader(_args: LoaderFunctionArgs) {
  const archiver = (await import("archiver")).default;
  const archive = archiver("zip", { zlib: { level: 9 } });

  for (const templateType of TEMPLATE_TYPES) {
    const html = await downloadTemplateForProvider(
      templateType,
      "klaviyo"
    );
    const filename =
      templateType === "monthly-status"
        ? "monthly-status.html"
        : templateType === "expiration-warning"
          ? "expiration-warning.html"
          : templateType === "expiration"
            ? "expiration.html"
            : "upgrade.html";
    archive.append(html, { name: filename });
  }

  archive.append(KLAVIYO_DOC, { name: "klaviyo-guide.md" });

  const chunks: Buffer[] = [];
  archive.on("data", (chunk: Buffer) => chunks.push(chunk));
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
    archive.finalize();
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="liberovino-klaviyo.zip"',
    },
  });
}
