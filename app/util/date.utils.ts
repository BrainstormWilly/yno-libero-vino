/**
 * Date utility functions
 */

/**
 * Converts a nullable date string to a date-only string (YYYY-MM-DD)
 * Returns null if the input is null or invalid
 */
export function toDateString(date: string | null | undefined): string | null {
  if (!date) return null;
  try {
    return new Date(date).toISOString().split('T')[0];
  } catch {
    return null;
  }
}

/**
 * Converts a nullable date string to a date-only string (YYYY-MM-DD)
 * Throws an error if the input is null or invalid
 */
export function toDateStringRequired(date: string | null | undefined): string {
  if (!date) {
    throw new Error('Date is required but was null or undefined');
  }
  try {
    return new Date(date).toISOString().split('T')[0];
  } catch (error) {
    throw new Error(`Invalid date: ${date}`);
  }
}
