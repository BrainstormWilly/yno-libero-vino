import { Card, CardBody, CardHeader } from "@heroui/card";
import { useOutletContext } from "react-router";
import type { CrmTypes } from "~/types/crm";
import type { FaqsOutletContext } from "./faqs";

type FaqItem = {
  question: string;
  answer: string;
};

const faqsByCrm: Record<CrmTypes, FaqItem[]> = {
  commerce7: [
    {
      question: "How does LiberoVino connect to Commerce7?",
      answer:
        "We integrate directly with Commerce7 APIs to sync customers, club tiers, and loyalty data.",
    },
    {
      question: "Can I customize club tiers and perks?",
      answer:
        "Yes. Tier thresholds and perks are configurable and adjust automatically based on real spending.",
    },
    {
      question: "What does onboarding look like?",
      answer:
        "We guide you through setup in a few steps, then automate ongoing allocations and retention insights.",
    },
  ],
  shopify: [
    {
      question: "When will Shopify support be available?",
      answer:
        "Shopify-specific content is in progress. For now, we recommend Commerce7 resources.",
    },
    {
      question: "Can I get notified when Shopify launches?",
      answer:
        "Yes. Reach out through the contact page and we’ll keep you updated.",
    },
  ],
};

export default function FaqsIndex() {
  const { crmType } = useOutletContext<FaqsOutletContext>();
  const faqs = faqsByCrm[crmType];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-semibold text-gray-900">FAQs</h1>
        <p className="mt-3 text-lg text-gray-600">
          Answers tailored for {crmType === "commerce7" ? "Commerce7" : "Shopify"}.
        </p>
      </div>
      <div className="grid gap-4">
        {faqs.map((item) => (
          <Card key={item.question} className="border border-gray-200 shadow-sm">
            <CardHeader className="text-lg font-semibold text-gray-900">
              {item.question}
            </CardHeader>
            <CardBody className="text-gray-700">{item.answer}</CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
