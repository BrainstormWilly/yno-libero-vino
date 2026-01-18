import { Card, CardBody, CardHeader } from "@heroui/card";
import { useOutletContext } from "react-router";
import type { CrmTypes } from "~/types/crm";
import type { LearnOutletContext } from "./learn";

type LearnContent = {
  title: string;
  summary: string;
  highlights: string[];
};

const learnContent: Record<CrmTypes, LearnContent> = {
  commerce7: {
    title: "Learn Commerce7-first club strategy",
    summary:
      "LiberoVino pairs Commerce7's flexibility with automated loyalty tiers, smart allocations, and retention-focused insights.",
    highlights: [
      "Self-adjusting tiers that reward real member spending.",
      "Automated club allocations aligned to customer preferences.",
      "Retention insights that surface churn risk early.",
    ],
  },
  shopify: {
    title: "Shopify content coming soon",
    summary:
      "We’re building the Shopify experience next. Stay tuned for CRM-specific playbooks.",
    highlights: [
      "Commerce7 playbooks available today.",
      "Shopify guides in active development.",
      "Sign up for updates as we expand support.",
    ],
  },
};

export default function LearnIndex() {
  const { crmType } = useOutletContext<LearnOutletContext>();
  const content = learnContent[crmType];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-semibold text-gray-900">{content.title}</h1>
        <p className="mt-3 text-lg text-gray-600">{content.summary}</p>
      </div>
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="text-xl font-semibold text-gray-900">
          What you can expect
        </CardHeader>
        <CardBody>
          <ul className="list-disc space-y-2 pl-6 text-gray-700">
            {content.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
