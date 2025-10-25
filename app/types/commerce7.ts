/**
 * Commerce7 Install Payload
 * Received when a user installs the app in Commerce7
 */
export type Commerce7InstallPayload = {
  tenantId: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  "organization-name"?: string;
  "organization-address"?: string;
  "organization-website"?: string;
  "organization-phone"?: string;
};

/**
 * Commerce7 Auth Query Params
 * Received when Commerce7 redirects to our app after install
 */
export type Commerce7AuthParams = {
  tenantId: string;
  account: string;
  adminUITheme?: string;
};

// Re-export unified discount types
export * from "./discount";
export * from "./discount-commerce7";
export * from "./discount-shopify";
export * from "./tag";
