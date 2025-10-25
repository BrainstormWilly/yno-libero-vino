/**
 * Commerce7 Tag Types
 * Used for customer segmentation in coupons
 */

export enum C7TagObjectType {
  CUSTOMER = "Customer",
  ORDER = "Order",
  CLUB_MEMBERSHIP = "ClubMembership",
  RESERVATION = "Reservation"
}

export type C7Tag = {
  id: string;
  title: string;
  type: "Dynamic" | "Manual";
  objectType: C7TagObjectType;
};

export type C7TagParams = {
  tenant: string;
  objectType: C7TagObjectType;
  q?: string;
  limit?: number;
};

/**
 * Convert tag to a simple list item for UI display
 */
export type TagListItem = {
  id: string;
  title: string;
};

export const convertTagToListItem = (tag: C7Tag): TagListItem => ({
  id: tag.id,
  title: tag.title,
});

