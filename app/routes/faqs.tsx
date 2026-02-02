import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData } from "react-router";
import CrmTabs from "~/components/splash/CrmTabs";
import MarketingLayout from "~/components/splash/MarketingLayout";
import type { CrmTypes } from "~/types/crm";
import {
  buildCrmPreferenceCookie,
  getInitialCrmPreference,
  parseCrmPreference,
} from "~/util/crm-preference";

export async function loader({ request }: LoaderFunctionArgs) {
  const crmType = getInitialCrmPreference(request);
  return { crmType };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const crmValue = formData.get("crm");
  const crmType = parseCrmPreference(
    typeof crmValue === "string" ? crmValue : null
  );

  if (!crmType) {
    return new Response("Invalid CRM", { status: 400 });
  }

  return new Response(null, {
    headers: {
      "Set-Cookie": buildCrmPreferenceCookie(crmType),
    },
  });
}

export type FaqsOutletContext = {
  crmType: CrmTypes;
};

export default function FaqsLayout() {
  const { crmType } = useLoaderData<typeof loader>();

  return (
    <MarketingLayout>
      <div className="space-y-8">
        <CrmTabs crmType={crmType} />
        <Outlet context={{ crmType }} />
      </div>
    </MarketingLayout>
  );
}
