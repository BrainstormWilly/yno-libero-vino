import { Card, CardBody } from "@heroui/card";
import { Link, useOutletContext } from "react-router";
import type { CrmTypes } from "~/types/crm";
import type { LearnOutletContext } from "./learn";

type TierModel = {
  name: string;
  description: string;
  chartImage: string;
  pros: string[];
  cons: string[];
};

type TierContent = {
  id: string;
  heading: string;
  subtitle: string;
  content: React.ReactNode;
};

function QualificationContent() {
  return (
    <div className="space-y-4">
      <p>
        Every club tier requires an ALTV. Think about this in terms of what the
        minimum annual expenditure is for your traditional club members. LV then
        determines an initial purchase by dividing by 12:
      </p>
      <div className="bg-gray-50 p-4 rounded-lg font-mono text-lg m-8">
        ($1,200 ALTV / 12 = $100)
      </div>
      <p>
        The initial purchase calculation is really just a recommendation. You can
        override it per tier in settings, and you can mark a tier as
        &quot;upgrade only&quot; so it is not offered at first signup—only via
        upgrade. Tier qualification is still your determination for each new
        member. However, upgrading tiers based on ALTV is automated by LV. So,
        let&apos;s look at that.
      </p>
    </div>
  );
}

function UpgradabilityContent() {
  return (
    <div className="space-y-4">
      <p>
        Upgradability is a LV recommended option to add incentive to member
        purchases. The option and order of upgradable tiers are determined
        during tier setup. Members in upgradable tiers will be notified in
        their monthly status how much of a spend is required to upgrade to the
        next tier:
      </p>
      <blockquote className="border-l-4 border-primary-300 pl-4 italic font-serif text-gray-500 text-lg m-8">
        Congratulations! Your recent purchase has extended your membership until
        4/30/2026. However, if you spend another $450 by 2/28/2026 you
        automatically increase your benefits to 20% off the store and extend
        your membership to 6/30/2026!
      </blockquote>
      <p>
        Upgradability is intended to work with duration to incentivize members
        to purchase more than their tier minimum. Think of it as a form a
        gamification.
      </p>
    </div>
  );
}

function DurationContent() {
  return (
    <div className="space-y-4">
      <p>
        LV has no shipment commitments. Instead, we use a duration, or time
        limit, for each tier. Generally, the higher the ALTV, the longer the
        duration. Used with upgradability, duration can be used to retain club
        members. Once their duration expires, they can only re-sign based on
        their current ALTV. So, if a member upgrades tiers over time to receive
        maximum benefit, but then stops purchasing, they will receive an
        expiration warning:
      </p>
      <blockquote className="border-l-4 border-red-300 pl-4 italic font-serif text-gray-500 text-lg m-8">
        Code Red! Your winery benefits are expiring in 7 days. Make a purchase
        soon to extend your membership until 4/30/2026. You are currently
        getting our maximum benefit of 20% off the store. Don&apos;t let it
        expire!
      </blockquote>
      <p>
        Durations are intended to incentivize your lower ALTV members, however
        your high value members will eventually not even notice them.
        That&apos;s because they can further extend their membership with each
        purchase regardless of where they are in the existing duration. In other
        words, if the member joins with a 3 month duration and purchases enough
        to extend on a regular basis, they just keep tacking months on to their
        existing duration up to a year. In other words, they will effectively
        always have another year to make their next purchase.
      </p>
    </div>
  );
}

function SuggestedTiersContent() {
  const tierModels: TierModel[] = [
    {
      name: "Simple One Tier Plan",
      description:
        "This is ideal for small garagista, or limited SKU wineries that want to keep things simple. These wineries are very small, hard to find and may not have tasting rooms. Customers the seek them are already prequalified to join.",
      chartImage: "/media/learn/simple-tier-chart.png",
      pros: [
        "Easy to setup",
        "Long duration",
        "Low qualification requirement",
        "Low member maintenance",
      ],
      cons: [
        "Limited incentives",
        "Long potential purchase intervals. Members could disengage long before expiration.",
        "No initial purchase upsell opportunities",
        "Low member interaction",
      ],
    },
    {
      name: "Basic Plan",
      description:
        "This works well for wineries with more SKUs that want to incentivize and engage more with their members. \
        These wineries have tasting rooms, but are still relatively hard to find. \
        Customers may stumble on them, but more likely seek them out. Note that high value members have a special non-upgradable tier.",
      chartImage: "/media/learn/basic-tier-chart.png",
      pros: [
        "Relatively easy setup",
        "Exclusive high value tier",
        "Medium engagement",
      ],
      cons: [
        "Requires some thought about your current customer base",
        "No low value incentives",
        "Requires more communication",
      ],
    },
    {
      name: "Gamified Plan",
      description:
        "This is for wineries that want to fully engage with their members at every step of their journey. \
        This is an ideal plan for wineries with a large SKU count that includes low cost offerings as well as award winners. \
        These wineries are well established, have well located tasting rooms and are visited by any and all that come to their region.",
      chartImage: "/media/learn/gamified-tier-chart.png",
      pros: [
        "Provides membership options for all customer types",
        "Heavy engagement opportunities, especially for clients using Mailchimp or Klaviyo",
        "High conversion rate = larger user base",
      ],
      cons: [
        "Requires a lot of thought and analytics to setup",
        "Requires well designed email templates and messaging with many iterations",
        "Lower retention rates due to the ease of entry",
      ],
    },
    {
      name: "Allocation Model",
      description:
        "This is for wineries that don't offer discounts. Rather, their incentive is access to their limited wine collection. \
        LV uses C7's built-in product/collection promo controls torestrict wines available in each tier. NOTE: A customer's first purchase can only qualify them for Tier 1.",
      chartImage: "/media/learn/allocation-tier-chart.png",
      pros: [
        "Easy setup",
        "Provides members an automatic upgrade path",
      ],
      cons: [
        "Requires changing/adding tiers with changing product availability",
        "One size fits all unless using a parallel tier strategy",
      ],
    },
  ];

  return (
    <div className="space-y-12">
      <div>
        <p className="mb-6">
          We understand that our radical &ldquo;no commitment&rdquo; concept may
          seem overwhelming. So, we&apos;re going to provide you with some
          examples based on different types of wineries. First, let&apos;s
          quickly review the differences between traditional and LV club tiers.
        </p>
        <div className="overflow-x-auto p-4">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-3 text-left font-semibold">
                  Traditional
                </th>
                <th className="border border-gray-300 px-4 py-3 text-left font-semibold">
                  LiberoVino
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                <td className="border border-gray-300 px-4 py-2">
                  Limited tiers
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  Unlimited tiers
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">
                  Bottle based
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  Purchase based
                </td>
              </tr>
              <tr className="bg-white">
                <td className="border border-gray-300 px-4 py-2">
                  Contains wine packages
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  No wine packages
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">
                  Scheduled shipping
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  No scheduled shipping
                </td>
              </tr>
              <tr className="bg-white">
                <td className="border border-gray-300 px-4 py-2">
                  One year commitment
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  No commitment
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">
                  Member chooses club
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  Member qualifies for club
                </td>
              </tr>
              <tr className="bg-white">
                <td className="border border-gray-300 px-4 py-2">
                  Member chooses tier
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  Tiers auto upgrade
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">
                  Membership is forever until quit
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  Membership expires without purchase
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-16">
        {tierModels.map((model) => (
          <div key={model.name} className="space-y-6">
            <div>
              <div className="text-xl font-semibold text-gray-900 mb-3">
                {model.name}
              </div>
              <p className="text-gray-700">{model.description}</p>
            </div>

            <div>
              <img
                src={model.chartImage}
                alt={`${model.name} chart`}
                className="w-full max-w-full h-auto rounded-lg border border-gray-200"
              />
            </div>

            <div className="overflow-x-auto p-4">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold bg-green-50">
                      Pros
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold bg-red-50">
                      Cons
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({
                    length: Math.max(model.pros.length, model.cons.length),
                  }).map((_, index) => (
                    <tr
                      key={index}
                      className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="border border-gray-300 px-4 py-2">
                        {model.pros[index] || ""}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        {model.cons[index] || ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const tiersContentByCrm: Record<CrmTypes, TierContent[]> = {
  commerce7: [
    {
      id: "qualification",
      heading: "Qualification",
      subtitle: "How members qualify for club tiers",
      content: <QualificationContent />,
    },
    {
      id: "upgradability",
      heading: "Upgradability",
      subtitle: "Automatic tier upgrades based on purchase history",
      content: <UpgradabilityContent />,
    },
    {
      id: "duration",
      heading: "Duration",
      subtitle: "Setting tier durations and managing expiration",
      content: <DurationContent />,
    },
    {
      id: "suggested",
      heading: "Suggested Club Tier Models",
      subtitle: "Tier model examples for different winery types",
      content: <SuggestedTiersContent />,
    },
  ],
  shopify: [
    {
      id: "coming-soon",
      heading: "Coming Soon",
      subtitle: "Shopify tier content is in active development.",
      content: (
        <p>
          We&apos;re building tier management features for Shopify. Reach out
          through our contact page to be notified when this content is available.
        </p>
      ),
    },
  ],
};

export default function LearnTiers() {
  const { crmType } = useOutletContext<LearnOutletContext>();
  const sections = tiersContentByCrm[crmType];

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
          LiberoVino Club Tiers
        </div>
        <div className="space-y-4 text-gray-700">
          <p>
            LiberoVino utilizes Commerce7&apos;s club system to create what its own
            club tiers. In C7 these tiers are hidden from your website and
            admin so that they can only be recommended via the LV app. LV also
            provides the ability to assign C7 promos and loyalty to your tiers.
            However, there are no packages or shipping schedules like your
            traditional clubs. LV simply uses tiers to provide benefits to its
            members to use when they purchase.
          </p>
          <p>
            Other than no packages or shipping, there three very important
            features regarding LV club tiers:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Qualification</li>
            <li>Upgradability</li>
            <li>Duration</li>
          </ul>
          <p>
            These are unique concepts automatically managed by LV, but are
            important to planning your tier system. Unlike traditional clubs,
            customers are not forced to buy on a schedule. Rather, they are
            incentivized to purchase within their tiers duration to maintain or
            upgrade their benefits. If their duration expires, so do their
            benefits. In addition, members do choose their clubs, they qualify
            for them based on their initial purchase or annualized lifetime
            value (ALTV). Let&apos;s review how these concepts work.
          </p>
        </div>
      </div>

      {sections.map((section) => (
        <section key={section.id} id={section.id} className="scroll-mt-8 space-y-6">
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
