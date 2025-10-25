/**
 * Naming conventions for platform-created resources
 * Prefixes help users identify resources created by the Yno app
 */

const YNO_PREFIX = "Yno";
const YNO_CODE_PREFIX = "YNO-";

/**
 * Format a club/program name with Yno prefix
 * @example formatClubName("Wine Lovers") => "Yno Wine Lovers"
 */
export const formatClubName = (name: string): string => {
  return `${YNO_PREFIX} ${name}`;
};

/**
 * Format a tag name with Yno prefix
 * @example formatTagName("Gold Tier") => "Yno Gold Tier"
 */
export const formatTagName = (name: string): string => {
  return `${YNO_PREFIX} ${name}`;
};

/**
 * Format a coupon/discount title with Yno prefix
 * @example formatCouponTitle("Gold Member Discount") => "Yno Gold Member Discount"
 */
export const formatCouponTitle = (name: string): string => {
  return `${YNO_PREFIX} ${name}`;
};

/**
 * Format a coupon code with YNO- prefix
 * Converts to uppercase and removes spaces
 * @example formatCouponCode("gold tier") => "YNO-GOLDTIER"
 * @example formatCouponCode("Gold Member 20") => "YNO-GOLDMEMBER20"
 */
export const formatCouponCode = (code: string): string => {
  const cleanCode = code.toUpperCase().replace(/\s+/g, "");
  return `${YNO_CODE_PREFIX}${cleanCode}`;
};

/**
 * Remove Yno prefix from a name if present
 * @example stripYnoPrefix("Yno Gold Tier") => "Gold Tier"
 * @example stripYnoPrefix("Gold Tier") => "Gold Tier"
 */
export const stripYnoPrefix = (name: string): string => {
  if (name.startsWith(YNO_PREFIX + " ")) {
    return name.substring(YNO_PREFIX.length + 1);
  }
  return name;
};

/**
 * Remove YNO- prefix from a code if present
 * @example stripYnoCodePrefix("YNO-GOLDTIER") => "GOLDTIER"
 * @example stripYnoCodePrefix("GOLDTIER") => "GOLDTIER"
 */
export const stripYnoCodePrefix = (code: string): string => {
  if (code.startsWith(YNO_CODE_PREFIX)) {
    return code.substring(YNO_CODE_PREFIX.length);
  }
  return code;
};

/**
 * Check if a name has the Yno prefix
 */
export const hasYnoPrefix = (name: string): boolean => {
  return name.startsWith(YNO_PREFIX + " ");
};

/**
 * Check if a code has the YNO- prefix
 */
export const hasYnoCodePrefix = (code: string): boolean => {
  return code.startsWith(YNO_CODE_PREFIX);
};

