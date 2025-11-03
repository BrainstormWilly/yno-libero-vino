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
  customer?: any;
  club?: any;
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

