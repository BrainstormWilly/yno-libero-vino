/**
 * Member management types
 */

export type MemberEnrollmentStatus = 'active' | 'expired' | 'cancelled' | 'pending';

export interface ClubMember {
  id: string;
  customer_id: string;
  club_stage_id: string;
  status: MemberEnrollmentStatus;
  enrolled_at: string;
  expires_at: string | null;
  crm_membership_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberWithDetails extends ClubMember {
  customer: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    crm_id: string;
  };
  tier: {
    id: string;
    name: string;
    duration_months: number;
    min_purchase_amount: number;
  };
}

export interface EnrollmentRequest {
  customerId: string;
  stageId: string;
  enrollmentDate?: string;
  durationMonths: number;
}

export interface AddressData {
  firstName?: string;
  lastName?: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  provinceCode: string;
  zip: string;
  countryCode: string;
  phone?: string;
  isDefault?: boolean;
}

export interface CreditCardData {
  cardholderName: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  isDefault?: boolean;
}

