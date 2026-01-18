import { Card, CardBody, CardHeader } from "@heroui/card";
import MarketingLayout from "~/components/splash/MarketingLayout";

export default function Contact() {
  return (
    <MarketingLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-semibold text-gray-900">Contact</h1>
          <p className="mt-3 text-lg text-gray-600">
            Want to see LiberoVino in action? Reach out and we’ll walk you
            through the platform.
          </p>
        </div>
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="text-xl font-semibold text-gray-900">
            Get in touch
          </CardHeader>
          <CardBody className="space-y-2 text-gray-700">
            <p>Email: hello@ynosoftware.com</p>
            <p>Partner support: support@ynosoftware.com</p>
          </CardBody>
        </Card>
      </div>
    </MarketingLayout>
  );
}
