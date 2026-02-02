import { parse, serialize } from "cookie";
import type { CrmTypes } from "~/types/crm";
import { getSubdomainInfo } from "~/util/subdomain";

export const CRM_PREFERENCE_COOKIE = "crm-preference";
export const DEFAULT_CRM: CrmTypes = "commerce7";

const CRM_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function parseCrmPreference(value?: string | null): CrmTypes | null {
  if (value === "commerce7" || value === "shopify") {
    return value;
  }
  return null;
}

export function getCrmPreferenceFromCookie(
  cookieHeader: string | null
): CrmTypes | null {
  if (!cookieHeader) return null;
  const cookies = parse(cookieHeader);
  return parseCrmPreference(cookies[CRM_PREFERENCE_COOKIE]);
}

export function getCrmPreferenceFromRequest(request: Request): CrmTypes | null {
  return getCrmPreferenceFromCookie(request.headers.get("Cookie"));
}

export function getInitialCrmPreference(request: Request): CrmTypes {
  const cookiePreference = getCrmPreferenceFromRequest(request);
  if (cookiePreference) return cookiePreference;

  const subdomainInfo = getSubdomainInfo(request);
  if (subdomainInfo.crmType) {
    return subdomainInfo.crmType;
  }

  return DEFAULT_CRM;
}

export function buildCrmPreferenceCookie(crmType: CrmTypes): string {
  return serialize(CRM_PREFERENCE_COOKIE, crmType, {
    maxAge: CRM_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
  });
}
