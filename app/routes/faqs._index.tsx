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
      question: "How does LiberoVino communicate with customers?",
      answer:
        "LiberoVino supports Klaviyo and Mailchimp for email/sms communication. We provide you with event triggers, suggested flows, \
        and templates to get you started.",
    },
    {
      question: "What if I don't have Klaviyo or Mailchimp?",
      answer:
        "LiberoVino has built-in email and SMS communication capabilities, including brandable templates and content.",
    },
    {
      question: "Does LiberoVino replace my existing wine clubs?",
      answer:
        "No. LiberoVino works alongside your existing wine clubs as a separate offering for your customers. Particularly, \
        those living out of state or who prefer to have their wines shipped.",
    },
    {
      question: "What is the difference between LiberoVino and my existing wine clubs?",
      answer:
        "The fundamental difference is that LiberoVino is a wine club that is not tied to a specific schedule or package size. \
        Customers can buy when they want, for as much or as little as they want, and they can extend their membership for as long as they want by purchasing more wine. \
        Traditional wine clubs are winery-driven. LiberoVino is customer-driven.",
    },
    {
      question: "What does onboarding look like?",
      answer:
        "Our setup wizard will guide you through the process of creating your wine club, tiers, loyalty points (optional), communication preferences, and more. \
        You can also checkout the Learn More section for a more detailed overview of the setup process.",
    },
    {
      question: "How do LiberoVino's wine club tiers work?",
      answer:
        "Wine club tiers are much like your existing tiers, except they can be (and should be) automatically upgradable based on customer spending. \
        Also, since there are no packages or shipping schedules, you can create as many tiers as you want. Checkout the Learn More section for \
        suggestions on how to configure your tiers.",
    },
    {
      question: "How do I add customers to LiberoVino?",
      answer:
        "Using the LiberoVino app in Commerce7's admin, you can import existing customers from Commerce7 or add them into LiberoVino directly",
    },
    {
      question: "How do customers choose their wine club tier?",
      answer:
        "They don't. It is up to you which tier they qualify for. Based on settings you configure, \
        LiberoVino recommends the highest tier based on either their LTV or initial purchase.",
    },
    {
      question: "How does a customer quit a LiberoVino wine club?",
      answer:
        "They don't. It simply expires if they don't purchase anything within the tier's duration.",
    },
    {
      question: "How do customers get \"upgraded\" to a higher tier?",
      answer:
        "Based on settings you configure, LiberoVino will automatically upgrade customers to the next tier they qualify for based on their spending. \
        It's set and forget.",
    },
    {
      question: "Should I advertise LiberoVino clubs/tiers on my website?",
      answer: 
        "While we would love it if you advertised LiberoVino, we do not recommend showing your tiers to customers like your traditional wine clubs. \
        Reason being, customers do not choose a LiberoVino tier, they qualify for it. Also, you should always leave open possibilities for \
        new tier configurations in the future based on market conditions.",
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column - 1/3 */}
      <div className="lg:col-span-1">
        <div className="text-4xl font-display font-semibold text-gray-900">FAQs</div>
        <div className="mt-3 text-lg text-gray-600 font-serif">
          Answers tailored for {crmType === "commerce7" ? "Commerce7" : "Shopify"}.
        </div>
      </div>

      {/* Right Column - 2/3 */}
      <div className="lg:col-span-2">
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
    </div>
  );
}
