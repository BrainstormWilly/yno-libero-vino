import { Card, CardBody, CardHeader } from "@heroui/card";
import MarketingLayout from "~/components/splash/MarketingLayout";

export default function About() {
  return (
    <MarketingLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - 1/3 */}
        <div className="lg:col-span-1">
          <div className="text-4xl font-display font-semibold text-gray-900">About</div>
          <div className="mt-3 text-lg text-gray-600 font-serif">
            LiberoVino is a customer-driven wine club platform that helps
            wineries deliver flexible, modern loyalty experiences.
          </div>
        </div>

        {/* Right Column - 2/3 */}
        <div className="lg:col-span-2">
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
      </div>
    </MarketingLayout>
  );
}
