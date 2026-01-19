import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Checkbox } from "@heroui/checkbox";
import { RadioGroup, Radio } from "@heroui/radio";
import { Button } from "@heroui/button";
import type { ActionFunctionArgs } from "react-router";
import { Form, useActionData, useNavigation } from "react-router";
import { useState } from "react";
import MarketingLayout from "~/components/splash/MarketingLayout";
import { SendGridProvider } from "~/lib/communication/providers/sendgrid.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const message = formData.get("message") as string;
  const platform = formData.get("platform") as string;
  const requestDemo = formData.get("requestDemo") === "on";
  const freeBeta = formData.get("freeBeta") === "on";
  const generalInfo = formData.get("generalInfo") === "on";

  // Validate required fields
  if (!name || !email) {
    return {
      success: false,
      error: "Name and email are required",
    };
  }

  // At least one interest must be selected
  if (!requestDemo && !freeBeta && !generalInfo) {
    return {
      success: false,
      error: "Please select at least one area of interest",
    };
  }

  // Build interests list
  const interests: string[] = [];
  if (requestDemo) interests.push("Request Demo");
  if (freeBeta) interests.push("Free Beta Program");
  if (generalInfo) interests.push("General Info");

  // Get SendGrid configuration from environment
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || "support@ynosoftware.com";
  const fromName = "LiberoVino Contact Request for " + name;

  if (!apiKey) {
    console.error("SENDGRID_API_KEY is not configured");
    return {
      success: false,
      error: "Email service is not configured. Please try again later.",
    };
  }

  try {
    // Create SendGrid provider instance
    const sendGridProvider = new SendGridProvider({
      apiKey,
      defaultFromEmail: fromEmail,
      defaultFromName: fromName,
    });

    // Escape HTML to prevent XSS
    const escapeHtml = (text: string) => {
      const map: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      };
      return text.replace(/[&<>"']/g, (m) => map[m]);
    };

    const escapedName = escapeHtml(name);
    const escapedEmail = escapeHtml(email);
    const escapedPlatform = platform ? escapeHtml(platform) : "";
    const escapedMessage = message ? escapeHtml(message).replace(/\n/g, "<br>") : "";

    // Build email content
    const emailBody = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${escapedName}</p>
      <p><strong>Email:</strong> ${escapedEmail}</p>
      ${escapedPlatform ? `<p><strong>Platform:</strong> ${escapedPlatform}</p>` : ""}
      <p><strong>Interests:</strong> ${interests.join(", ")}</p>
      ${escapedMessage ? `<p><strong>Message:</strong></p><p>${escapedMessage}</p>` : ""}
    `;

    const emailText = `
New Contact Form Submission

Name: ${name}
Email: ${email}
${platform ? `Platform: ${platform}\n` : ""}Interests: ${interests.join(", ")}
${message ? `\nMessage:\n${message}` : ""}
    `;

    // Send email via SendGrid
    await sendGridProvider.sendEmail({
      to: "contact@ynosoftware.com",
      toName: "LiberoVino Team",
      subject: `Contact Form: ${interests.join(", ")}`,
      html: emailBody,
      text: emailText,
    });

    return {
      success: true,
      message: "Thank you! We'll be in touch soon.",
    };
  } catch (error) {
    console.error("Error sending email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Handle specific SendGrid errors
    if (errorMessage.includes("Maximum credits exceeded")) {
      return {
        success: false,
        error: "Email service is temporarily unavailable. Please contact us directly at hello@ynosoftware.com or try again later.",
      };
    }
    
    if (errorMessage.includes("401 Unauthorized")) {
      return {
        success: false,
        error: "Email service configuration error. Please contact us directly at hello@ynosoftware.com.",
      };
    }
    
    return {
      success: false,
      error: `Failed to send message: ${errorMessage}. Please try again later or contact us directly at hello@ynosoftware.com.`,
    };
  }
}

export default function Contact() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [requestDemo, setRequestDemo] = useState(false);
  const [freeBeta, setFreeBeta] = useState(false);
  const [generalInfo, setGeneralInfo] = useState(true);
  const [platform, setPlatform] = useState<string>("Commerce7");

  return (
    <MarketingLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - 1/3 */}
        <div className="lg:col-span-1">
          <div className="text-4xl font-display font-semibold text-gray-900">Contact</div>
          <div className="mt-3 text-lg text-gray-600 font-serif">
            Want to see LiberoVino in action? Reach out and we&apos;ll walk you
            through the platform.
          </div>
        </div>

        {/* Right Column - 2/3 */}
        <div className="lg:col-span-2">
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="text-xl font-semibold text-gray-900">
            Get in touch
          </CardHeader>
          <CardBody>
            <Form method="post" className="space-y-6">
              {/* Success/Error Messages */}
              {actionData?.success && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-800">
                  {actionData.message}
                </div>
              )}
              {actionData?.error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
                  {actionData.error}
                </div>
              )}

              {/* Name Field */}
              <Input
                label="Name"
                name="name"
                type="text"
                isRequired
                placeholder="Your name"
                variant="bordered"
              />

              {/* Email Field */}
              <Input
                label="Email"
                name="email"
                type="email"
                isRequired
                placeholder="your.email@example.com"
                variant="bordered"
              />

              <div className="flex justify-around">
                <RadioGroup
                  label="Platform"
                  name="platform"
                  value={platform}
                  onValueChange={setPlatform}
                >
                  <Radio value="Commerce7">Commerce7</Radio>
                  <Radio value="Shopify">Shopify</Radio>
                  <Radio value="Other">Other</Radio>
                </RadioGroup>
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-medium text-gray-700">
                    I&apos;m interested in:
                  </div>
                  <div className="flex flex-col gap-3">
                    <div>
                      <Checkbox
                        isSelected={requestDemo}
                        onValueChange={setRequestDemo}
                      >
                        Request Demo
                      </Checkbox>
                      <input
                        type="hidden"
                        name="requestDemo"
                        value={requestDemo ? "on" : ""}
                      />
                    </div>
                    <div>
                      <Checkbox
                        isSelected={freeBeta}
                        onValueChange={setFreeBeta}
                      >
                        Free Beta Program
                      </Checkbox>
                      <input
                        type="hidden"
                        name="freeBeta"
                        value={freeBeta ? "on" : ""}
                      />
                    </div>
                    <div>
                      <Checkbox
                        isSelected={generalInfo}
                        onValueChange={setGeneralInfo}
                      >
                        General Info
                      </Checkbox>
                      <input
                        type="hidden"
                        name="generalInfo"
                        value={generalInfo ? "on" : ""}
                      />
                    </div>
                  </div>
              </div>
              </div>
              
              {/* Message Field */}
              <div className="flex flex-col gap-2">
                <label htmlFor="message" className="text-sm font-medium text-gray-700">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  placeholder="Tell us how we can help..."
                  rows={4}
                  className="w-full px-3 py-2 min-h-[100px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
                />
              </div>

              {/* Interest Checkboxes */}
              

              {/* Submit Button */}
              <Button
                type="submit"
                color="primary"
                isLoading={isSubmitting}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? "Sending..." : "Send Message"}
              </Button>
            </Form>
          </CardBody>
        </Card>
        </div>
      </div>
    </MarketingLayout>
  );
}
