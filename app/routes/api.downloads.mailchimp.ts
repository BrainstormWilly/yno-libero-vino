/**
 * Public API endpoint: zip of Mailchimp templates + provider-specific documentation.
 * No auth required. Used from the learn communication page.
 * GET /api/downloads/mailchimp returns the zip file directly (no SPA layout).
 */

import { type LoaderFunctionArgs } from "react-router";
import { downloadTemplateForProvider } from "~/lib/communication/templates.server";

const TEMPLATE_TYPES = [
  "monthly-status",
  "expiration-warning",
  "expiration",
  "upgrade",
] as const;

const MAILCHIMP_DOC = `# LiberoVino + Mailchimp

This zip contains sample HTML email templates (Mailchimp merge tag syntax) and this guide.

## Variables and triggers

LV does not send email through Mailchimp. It updates the contact (merge fields and tags), and you trigger flows from "Tag added" or "Merge field updated." Template variables use \`*|TAG|*\` syntax in Mailchimp.

| Trigger description | MC trigger name (Tag / Merge field) | Provided template variables |
|---------------------|-------------------------------------|-----------------------------|
| Member joins club (welcome) | LiberoVino::ClubSignup / LVSIGNUP | client_name, customer_first_name, discount_percentage, expiration_formatted, tier_upgrade_min_purchase, next_tier_name, next_tier_discount_percentage, shop_url, header_block, footer_image_block, custom_content_block |
| Monthly status update | LiberoVino::MonthlyStatus / LVMONTH | client_name, customer_first_name, is_extended, expiration_formatted, extension_amount_needed, extension_deadline, has_upgrade, upgrade_*, current_discount_percentage, days_remaining, shop_url, status_body_message, extension_status_block, upgrade_offer_block, marketing_products_block |
| Monthly status promo | LiberoVino::MonthlyStatusPromo / LVMONPRO | Same as Monthly status |
| Expiration warning (e.g. 7 days left) | LiberoVino::ExpirationWarning / LVWARN | client_name, customer_first_name, days, extension_amount, discount_percentage, extension_expiration, extension_months, shop_url, upgrade_message_block, header_block, footer_image_block, custom_content_block |
| Expiration notice (benefits expired) | LiberoVino::ExpirationNotice / LVNOTICE | client_name, customer_first_name, rejoin_amount, discount_percentage, duration_months, shop_url, header_block, footer_image_block, custom_content_block |
| Tier upgrade (member qualified) | LiberoVino::TierUpgrade / LVUPGRAD | client_name, customer_first_name, new_tier_discount_percentage, new_tier_duration_months, expiration_formatted, next_tier_upgrade_amount, next_tier_discount_percentage, shop_url, header_block, footer_image_block, custom_content_block |
| Annual re-sign opportunity | LiberoVino::AnnualResign / LVRESIGN | Typically expiration template vars |
| Sales spotlight | LiberoVino::SalesBlast / LVBLAST | Marketing; customize as needed |
| Test | LiberoVino::Test / LVTEST | Test |

## Suggested flows

Create automations in Mailchimp that trigger when LV updates a contact:

- **Club Signup Welcome** — trigger when tag \`LiberoVino::ClubSignup\` is added (or when LVSIGNUP is updated).
- **Monthly Status Update** — trigger when LVMONTH is updated (e.g. each month when LV runs the status job).
- **Expiration Warning** — trigger when LVWARN is updated (member is within the warning window).
- **Expiration Notice** — trigger when LVNOTICE is updated (benefits have expired).
- **Tier Upgrade** — trigger when LVUPGRAD is updated (member qualified for an upgrade).
- Optional marketing: **Monthly Status Promo** (LVMONPRO), **Annual Re-Sign Opportunity** (LVRESIGN), **Sales Spotlight** (LVBLAST).

## Templates in this zip

- \`monthly-status.html\` — Monthly status update
- \`expiration-warning.html\` — Expiration warning (e.g. 7 days left)
- \`expiration.html\` — Expiration notice (benefits expired)
- \`upgrade.html\` — Tier upgrade congratulations

Import or paste into Mailchimp campaigns/automations and map your audience merge fields to the \`*|TAG|*\` placeholders.
`;

export async function loader(_args: LoaderFunctionArgs) {
  const archiver = (await import("archiver")).default;
  const archive = archiver("zip", { zlib: { level: 9 } });

  for (const templateType of TEMPLATE_TYPES) {
    const html = await downloadTemplateForProvider(
      templateType,
      "mailchimp"
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

  archive.append(MAILCHIMP_DOC, { name: "mailchimp-guide.md" });

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
      "Content-Disposition": 'attachment; filename="liberovino-mailchimp.zip"',
    },
  });
}
