import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Link } from "react-router";

type CommunicationSection = {
  id: string;
  heading: string;
  subtitle: string;
  content: React.ReactNode;
};

const MAILCHIMP_TRIGGERS_TABLE: Array<{
  triggerDescription: string;
  mcTriggerName: string;
  templateVariables: string;
}> = [
  {
    triggerDescription: "Member joins club (welcome)",
    mcTriggerName: "LiberoVino::ClubSignup / LVSIGNUP",
    templateVariables:
      "client_name, customer_first_name, discount_percentage, expiration_formatted, tier_upgrade_min_purchase, next_tier_name, next_tier_discount_percentage, shop_url, header_block, footer_image_block, custom_content_block",
  },
  {
    triggerDescription: "Monthly status update",
    mcTriggerName: "LiberoVino::MonthlyStatus / LVMONTH",
    templateVariables:
      "client_name, customer_first_name, is_extended, expiration_formatted, extension_amount_needed, extension_deadline, has_upgrade, upgrade_*, current_discount_percentage, days_remaining, shop_url, status_body_message, extension_status_block, upgrade_offer_block, marketing_products_block, … (see zip doc)",
  },
  {
    triggerDescription: "Monthly status promo",
    mcTriggerName: "LiberoVino::MonthlyStatusPromo / LVMONPRO",
    templateVariables: "Same as Monthly status",
  },
  {
    triggerDescription: "Expiration warning (e.g. 7 days left)",
    mcTriggerName: "LiberoVino::ExpirationWarning / LVWARN",
    templateVariables:
      "client_name, customer_first_name, days, extension_amount, discount_percentage, extension_expiration, extension_months, shop_url, upgrade_message_block, header_block, footer_image_block, custom_content_block",
  },
  {
    triggerDescription: "Expiration notice (benefits expired)",
    mcTriggerName: "LiberoVino::ExpirationNotice / LVNOTICE",
    templateVariables:
      "client_name, customer_first_name, rejoin_amount, discount_percentage, duration_months, shop_url, header_block, footer_image_block, custom_content_block",
  },
  {
    triggerDescription: "Tier upgrade (member qualified)",
    mcTriggerName: "LiberoVino::TierUpgrade / LVUPGRAD",
    templateVariables:
      "client_name, customer_first_name, new_tier_discount_percentage, new_tier_duration_months, expiration_formatted, next_tier_upgrade_amount, next_tier_discount_percentage, shop_url, header_block, footer_image_block, custom_content_block",
  },
  {
    triggerDescription: "Annual re-sign opportunity",
    mcTriggerName: "LiberoVino::AnnualResign / LVRESIGN",
    templateVariables: "(typically expiration template vars; see zip doc)",
  },
  {
    triggerDescription: "Sales spotlight",
    mcTriggerName: "LiberoVino::SalesBlast / LVBLAST",
    templateVariables: "(marketing; see zip doc)",
  },
  {
    triggerDescription: "Test",
    mcTriggerName: "LiberoVino::Test / LVTEST",
    templateVariables: "(test)",
  },
];

function MailchimpContent() {
  return (
    <div className="space-y-8">
      <p>
        When you connect your Mailchimp account to LV, you keep full control of
        your audience and automations. LV sends member events (signup, status
        changes, expiration, etc.) into Mailchimp so you can trigger flows and
        campaigns from your existing account. Email and SMS are both managed in
        your Mailchimp account; LV does not send messages directly.
      </p>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Variables and triggers
        </h3>
        <p className="text-gray-700 mb-4">
          LV does not send email through Mailchimp. It updates the contact
          (merge fields and tags), and you trigger flows from &ldquo;Tag
          added&rdquo; or &ldquo;Merge field updated.&rdquo; Template variables
          use <code className="bg-gray-100 px-1 rounded">*|TAG|*</code> syntax
          in Mailchimp; the zip doc has the full mapping.
        </p>
        <div className="overflow-x-auto p-4">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-3 text-left font-semibold">
                  Trigger description
                </th>
                <th className="border border-gray-300 px-4 py-3 text-left font-semibold">
                  MC trigger name
                </th>
                <th className="border border-gray-300 px-4 py-3 text-left font-semibold">
                  Provided template variables
                </th>
              </tr>
            </thead>
            <tbody>
              {MAILCHIMP_TRIGGERS_TABLE.map((row, index) => (
                <tr
                  key={row.mcTriggerName}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="border border-gray-300 px-4 py-2">
                    {row.triggerDescription}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 font-mono text-sm">
                    {row.mcTriggerName}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">
                    {row.templateVariables}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Suggested flows
        </h3>
        <p className="text-gray-700 mb-3">
          After you connect Mailchimp, create automations (flows) that trigger
          when LV updates a contact. We suggest one flow per member touchpoint:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-gray-700">
          <li>
            <strong>Club Signup Welcome</strong> — trigger when tag{" "}
            <code className="bg-gray-100 px-1 rounded">
              LiberoVino::ClubSignup
            </code>{" "}
            is added (or when LVSIGNUP is updated).
          </li>
          <li>
            <strong>Monthly Status Update</strong> — trigger when LVMONTH is
            updated (e.g. each month when LV runs the status job).
          </li>
          <li>
            <strong>Expiration Warning</strong> — trigger when LVWARN is
            updated (member is within the warning window).
          </li>
          <li>
            <strong>Expiration Notice</strong> — trigger when LVNOTICE is
            updated (benefits have expired).
          </li>
          <li>
            <strong>Tier Upgrade</strong> — trigger when LVUPGRAD is updated
            (member qualified for an upgrade).
          </li>
          <li>
            Optional marketing flows: <strong>Monthly Status Promo</strong>{" "}
            (LVMONPRO), <strong>Annual Re-Sign Opportunity</strong> (LVRESIGN),{" "}
            <strong>Sales Spotlight</strong> (LVBLAST).
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Sample templates and documentation
        </h3>
        <p className="text-gray-700 mb-3">
          LV provides <strong>sample templates and Mailchimp-specific
          documentation together in one zip file</strong>. The zip includes:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-gray-700 mb-4">
          <li>
            <strong>All sample HTML email templates</strong> for Mailchimp
            (Monthly Status, Expiration Warning, Expiration Notice, Tier
            Upgrade), each using Mailchimp merge tag syntax (
            <code className="bg-gray-100 px-1 rounded">*|TAG|*</code>) so you
            can drop them into campaigns or automations and map your audience
            merge fields.
          </li>
          <li>
            <strong>Provider-specific documentation</strong> (e.g. a Mailchimp
            guide) covering variables/merge tags, triggers (merge fields and
            tags), suggested flows and trigger conditions, and how to use the
            templates in Mailchimp.
          </li>
        </ul>
        <Button
          as="a"
          href="/api/downloads/mailchimp"
          variant="flat"
          color="primary"
          size="md"
          download
        >
          Download Mailchimp templates &amp; docs (ZIP)
        </Button>
      </div>
    </div>
  );
}

function KlaviyoContent() {
  return (
    <div className="space-y-4">
      <p>
        When you connect your Klaviyo account to LV, you use your own advanced
        email marketing and automation tools. LV sends member events into
        Klaviyo so you can build flows and campaigns with your existing
        setup.
      </p>
      <p>
        After linking, you get preconfigured LV triggers, flows, and starter
        templates. You can also download formatted email templates and
        documentation for all variable use. Email and SMS are both managed in
        your Klaviyo account; LV does not send messages directly.
      </p>
    </div>
  );
}

function BuiltInLvContent() {
  return (
    <div className="space-y-4">
      <p>
        For clients without Klaviyo or Mailchimp, LV offers built-in email and
        SMS support using SendGrid and Twilio at no extra cost. You do not need
        your own ESP or SMS provider accounts.
      </p>
      <p>
        You can brand and customize your own email templates and content
        directly in LV. In addition to transactional messages (signup welcome,
        monthly status, expiration warnings, etc.), LV supports a marketing
        opt-in where you can add promoted products from Commerce7 to include
        in your communication.
      </p>
    </div>
  );
}

const communicationSections: CommunicationSection[] = [
  {
    id: "mailchimp",
    heading: "LV + Mailchimp",
    subtitle: "Connect your Mailchimp account for audience management and automations",
    content: <MailchimpContent />,
  },
  {
    id: "klaviyo",
    heading: "LV + Klaviyo",
    subtitle: "Use your Klaviyo account for advanced email marketing and automation",
    content: <KlaviyoContent />,
  },
  {
    id: "lv",
    heading: "Built-in LV",
    subtitle: "LiberoVino handles all email and SMS sending with no extra accounts needed",
    content: <BuiltInLvContent />,
  },
];

export default function LearnCommunication() {
  return (
    <div className="max-w-4xl mx-auto space-y-16">
      <div className="mb-8">
        <Link
          to="/learn"
          className="text-primary-600 hover:text-primary-700 underline"
        >
          ← Back to Learn
        </Link>
      </div>

      <div className="mb-8">
        <div className="text-4xl font-display font-semibold text-gray-900 mb-4">
          LiberoVino Communication Options
        </div>
        <div className="space-y-4 text-gray-700">
          <p>
            LV only works when members are incentivized to maintain or upgrade
            their benefits. That means sending them timely, relevant messages.
            LV supports both transactional and marketing communication for:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Signup welcomes</li>
            <li>Monthly status updates</li>
            <li>Benefit extension and upgrade notifications</li>
            <li>Expiration warnings</li>
            <li>Expiration notices</li>
            <li>Re-signup opportunities</li>
          </ul>
          <p>
            To accomplish this, LV integrates with Mailchimp or Klaviyo, or
            offers built-in email and SMS. Choose the option that fits your
            stack below.
          </p>
        </div>
      </div>

      {communicationSections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className="scroll-mt-8 space-y-6"
        >
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {section.heading}
            </div>
            <div className="text-md text-gray-600 font-serif">
              {section.subtitle}
            </div>
          </div>
          <Card className="border border-gray-200 shadow-sm">
            <CardBody className="text-gray-700">{section.content}</CardBody>
          </Card>
        </section>
      ))}
    </div>
  );
}
