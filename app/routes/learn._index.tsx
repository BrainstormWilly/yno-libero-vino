import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Link, useOutletContext } from "react-router";
import type { CrmTypes } from "~/types/crm";
import type { LearnOutletContext } from "./learn";

type LearnLink = {
  href: string;
  label: string;
};

type LearnSection = {
  id: string;
  heading: string;
  subtitle: string;
  content: React.ReactNode;
  links?: LearnLink[];
};

function BuildingTiersContent() {
  return (
    <>
      <p className="mb-4">
        LiberoVino (LV) is not a traditional or subscription wine club. It is a
        customer-driven benefits program. Even though LV leverages Commerce7&apos;s
        club tiers, members, promotions, and loyalty, it uses them in a very
        different way. Instead of forced shipping schedules, LV incentivizes
        members to purchase on their own.
      </p>
      <p className="mb-4">
        LV offers a very different proposition to your customers. It may not be
        the best option for all your wine lovers, but for customers averse to
        traditional club commitments, or who want to control their own purchase
        options, it offers a compelling alternative.
      </p>
      <p className="mb-4 font-semibold">Here are some key differences:</p>
      <ul className="list-disc pl-6 space-y-3 mb-6">
        <li>
          LV club members do not join clubs, they qualify for them based on
          their annualized average LTV or initial purchase. The key here is LV
          provides an automatic upgrade infrastructure that enables members to
          increase their benefits based on purchase history.
        </li>
        <li>
          LV club memberships are not forever. All tiers have a duration,
          usually in months. Lower tiers (smaller benefits) should have shorter
          durations than higher tiers (higher benefits). It is up to the member
          to maintain or upgrade their benefits based on purchase. LV handles
          all the logistics and member communication of tracking duration,
          upgrades, and expiration.
        </li>
        <li>
          LV club tiers do not have packages or shipping. Therefore, there is no
          limit to the quantity or configurations of tiers you can
          create–enabling you to micro-target specific customer groups.
          Tastings, discounts, loyalty, allocations can all be mixed and matched
          based on desired tier value.
        </li>
      </ul>
    </>
  );
}

function SellingContent() {
  return (
    <>
      <p className="mb-4">
        With LV, it is not appropriate to ask a customer to &ldquo;join&rdquo; a club. It is
        better to ask if they want to receive future benefits. Depending on how
        you set up your tiers, there can be any number of offers:
      </p>
      <div className="space-y-3 mb-6">
        <blockquote className="border-l-4 border-primary-300 pl-4 italic font-serif text-gray-500 text-lg m-8">
          &ldquo;Would you be interested in getting 15% off on your next purchase?&rdquo;
        </blockquote>
        <blockquote className="border-l-4 border-primary-300 not-only:pl-4 italic font-serif text-gray-500 text-lg m-8">
          &ldquo;Would you be interested in joining our loyalty program?&rdquo;
        </blockquote>
        <blockquote className="border-l-4 border-primary-300 pl-4 italic font-serif text-gray-500 text-lg m-8">
          &ldquo;If you add 2 more bottles to today&apos;s purchase, you can get 10% off
          now and for any future purchases you make in the next 3 months.&rdquo;
        </blockquote>
      </div>
      <p className="mb-4">
        LV can also be used to retain quitting traditional members:
      </p>
      <blockquote className="border-l-4 border-primary-300 pl-4 italic font-serif text-gray-500 text-lg m-8">
        &ldquo;We hate to see you leave us. Can I at least add you to our benefit
        program? You can still get 20% off any purchase for the next 12 months
        with no obligation?&rdquo;
      </blockquote>
      <p className="mb-4">
        Of course, the primary purpose of LV is to offer flexible options to
        sell more wine, but it is also designed to get more customers into your
        marketing funnel by simply lowering the bar of entry. Prior to LV there
        were 2 options:
      </p>
      <div className="space-y-3 mb-6">
        <blockquote className="border-l-4 border-gray-300 pl-4 italic font-serif text-gray-500 text-lg m-8">
          &ldquo;Would you like to join our club?&rdquo;
        </blockquote>
        <blockquote className="border-l-4 border-gray-300 pl-4 italic font-serif text-gray-500 text-lg m-8">
          &ldquo;Would you like to get our newsletter?&rdquo;
        </blockquote>
      </div>
      <p className="mb-4">
        One has a high bar of commitment, the other offers little value to the
        customer. With LiberoVino you can now ask:
      </p>
      <blockquote className="border-l-4 border-primary-500 pl-4 italic font-serif text-gray-500 text-lg m-8">
        &ldquo;Would you like to sign up for future benefits?&rdquo;
      </blockquote>
      <p className="font-semibold">With no commitments, why wouldn&apos;t they?</p>
    </>
  );
}

function CommunicatingContent() {
  return (
    <>
      <p className="mb-4">
        LV only works when members are incentivized to maintain or upgrade their
        tiers. This means constantly communicating with them in a meaningful
        way. LV supports both transactional and marketing opt-ins for important
        communication including:
      </p>
      <ul className="list-disc pl-6 space-y-1 mb-6">
        <li>Signup welcomes</li>
        <li>Monthly status updates</li>
        <li>Benefit extension/upgrade notifications</li>
        <li>Expiration warnings</li>
        <li>Expiration notices</li>
        <li>Re-signup opportunities</li>
      </ul>
      <p className="mb-4">
        To accomplish this LV includes a comprehensive communication
        infrastructure including:
      </p>
      <ul className="list-disc pl-6 space-y-3 mb-6">
        <li>
          <strong>Mailchimp</strong> email and SMS support. When Mailchimp
          clients link their accounts to LV they get preconfigured LV triggers.
          They can also download suggested flows, email templates and
          documentation for all variable use.
        </li>
        <li>
          <strong>Klaviyo</strong> email and SMS support. When Klaviyo clients
          link their accounts to LV they get preconfigured LV triggers, flows,
          and starter templates. They can also download formatted email
          templates and documentation for all variable use.
        </li>
        <li>
          For clients without Klaviyo or Mailchimp, LV offers{" "}
          <strong>built-in email and SMS support</strong> using our own SendGrid
          and Twilio accounts at no extra cost. Clients can brand and customize
          their own email templates and content. In addition to transactional
          communication, LV supports a marketing opt-in where clients can add
          promoted products directly from Commerce7 to include in their
          communication, as well.
        </li>
      </ul>
    </>
  );
}

const learnSectionsByCrm: Record<CrmTypes, LearnSection[]> = {
  commerce7: [
    {
      id: "tiers",
      heading: "Building LiberoVino Club Tiers",
      subtitle:
        "LiberoVino is fully integrated in the Clubs section of the Commerce7 admin panel, but the similarities end there.",
      content: <BuildingTiersContent />,
      links: [
        { href: "/learn/tiers#qualification", label: "Qualification" },
        { href: "/learn/tiers#upgradability", label: "Upgradability" },
        { href: "/learn/tiers#duration", label: "Duration" },
        { href: "/learn/tiers#suggested", label: "Suggested Club Tiers" },
      ],
    },
    {
      id: "selling",
      heading: "Selling LiberoVino",
      subtitle:
        "Think benefits, not clubs. Incentives, not schedules. Rewards, not commitments.",
      content: <SellingContent />,
    },
    {
      id: "communication",
      heading: "Communicating with LiberoVino",
      subtitle:
        "Since LV members are not obligated, it is vitally important they receive incentives to maintain or upgrade their benefits.",
      content: <CommunicatingContent />,
      links: [
        { href: "/learn/communication#mailchimp", label: "LV + Mailchimp" },
        { href: "/learn/communication#klaviyo", label: "LV + Klaviyo" },
        { href: "/learn/communication#lv", label: "Built-in LV" },
      ],
    },
  ],
  shopify: [
    {
      id: "coming-soon",
      heading: "Coming Soon",
      subtitle: "Shopify integration is in active development.",
      content: (
        <p>
          We&apos;re building deep integration with Shopify&apos;s customer and order
          systems for seamless wine club management. Reach out through our
          contact page to be first in line when Shopify support goes live.
        </p>
      ),
    },
  ],
};

export default function LearnIndex() {
  const { crmType } = useOutletContext<LearnOutletContext>();
  const sections = learnSectionsByCrm[crmType];

  return (
    <div className="space-y-16">
      {sections.map((section) => (
        <div
          key={section.id}
          id={section.id}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          {/* Left Column - 1/3 */}
          <div className="lg:col-span-1">
            <div className="text-4xl font-display font-semibold text-gray-900">
              {section.heading}
            </div>
            <div className="mt-3 text-lg text-gray-600 font-serif">
              {section.subtitle}
            </div>
          </div>

          {/* Right Column - 2/3 */}
          <div className="lg:col-span-2">
            <Card className="border border-gray-200 shadow-sm">
              <CardBody className="text-gray-700">
                {section.content}
                {section.links && section.links.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-gray-200">
                    {section.links.map((link) => (
                      <Button
                        key={link.href}
                        as={Link}
                        to={link.href}
                        variant="flat"
                        color="primary"
                        size="sm"
                      >
                        {link.label}
                      </Button>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      ))}
    </div>
  );
}
