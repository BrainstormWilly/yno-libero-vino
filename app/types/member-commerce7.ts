/**
 * Commerce7-specific member enrollment types
 * Handles club membership API format and transformations
 */

// ============================================
// Commerce7 Club Membership API Types
// ============================================

export type C7ClubMembershipPayload = {
  customerId: string;
  clubId: string;
  billToCustomerAddressId: string;
  shipToCustomerAddressId: string;
  customerCreditCardId: string;
  orderDeliveryMethod: "Ship" | "Pickup";
  signupDate: string;
  cancelDate: string | null;
};

export type C7ClubMembershipResponse = {
  id: string;
  status: "Active" | "Cancelled" | "On Hold";
  customerId: string;
  clubId: string;
  billToCustomerAddressId: string;
  shipToCustomerAddressId: string;
  customerCreditCardId: string;
  orderDeliveryMethod: "Ship" | "Pickup";
  signupDate: string;
  cancelDate: string | null;
  lastProcessedDate: string | null;
  currentNumberOfShipments: number;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    avatar?: string;
    firstName: string;
    lastName: string;
    birthDate?: string | null;
    city?: string;
    stateCode?: string;
    countryCode?: string;
    acceptsMarketing?: boolean;
    lastActivityDate?: string;
    facebookId?: string | null;
    metaData?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
    orderInformation?: {
      lastOrderId?: string | null;
      lastOrderDate?: string | null;
      orderCount?: number;
      lifetimeValue: number; // in cents
      currentClubTitle?: string;
      daysInCurrentClub?: number;
    };
    clubs?: Array<{
      clubId: string;
      clubTitle: string;
      cancelDate: string | null;
      signupDate: string;
      clubMembershipId: string;
    }>;
  };
  club?: {
    id: string;
    title: string;
    content?: string | null;
    publishDate?: string;
    slug: string;
    createdAt: string;
    updatedAt: string;
    seo?: {
      title?: string;
      description?: string | null;
    };
  };
  onHolds?: any[];
};

// ============================================
// Conversion Functions
// ============================================

/**
 * Convert enrollment data to C7 club membership payload
 */
export const toC7ClubMembership = (data: {
  customerId: string;
  clubId: string;
  billingAddressId: string;
  shippingAddressId: string;
  paymentMethodId: string;
  startDate: string;
}): C7ClubMembershipPayload => ({
  customerId: data.customerId,
  clubId: data.clubId,
  billToCustomerAddressId: data.billingAddressId,
  shipToCustomerAddressId: data.shippingAddressId,
  customerCreditCardId: data.paymentMethodId,
  orderDeliveryMethod: "Ship", // LiberoVino always ships
  signupDate: data.startDate,
  cancelDate: null,
});

