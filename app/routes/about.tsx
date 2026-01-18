import { Card, CardBody, CardHeader } from "@heroui/card";
import MarketingLayout from "~/components/splash/MarketingLayout";

export default function About() {
  return (
    <MarketingLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-semibold text-gray-900">About</h1>
          <p className="mt-3 text-lg text-gray-600">
            LiberoVino is a customer-driven wine club platform that helps
            wineries deliver flexible, modern loyalty experiences.
          </p>
        </div>
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="text-xl font-semibold text-gray-900">
            Built for Commerce7
          </CardHeader>
          <CardBody className="text-gray-700">
            We focus on Commerce7 first so wineries can launch smarter clubs
            faster, with clear analytics, automation, and member-centric tools.
          </CardBody>
        </Card>
      </div>
    </MarketingLayout>
  );
}
