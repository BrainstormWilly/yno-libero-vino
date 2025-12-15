export type CommunicationPreferences = {
  // Email: Only marketing (transactional emails are automatic/required for membership)
  emailMarketing?: boolean; // Product suggestions, LV-specific promotions
  
  // SMS: Both transactional and marketing (can opt into either/both)
  smsTransactional?: boolean; // Monthly status, expiration warnings
  smsMarketing?: boolean; // Promotions, product suggestions
  
  unsubscribedAll?: boolean;
  
  // SMS opt-in tracking fields
  smsOptedInAt?: string;
  smsOptInMethod?: 'web_form' | 'text_reply' | 'admin_manual' | 'signup_form';
  smsOptInSource?: string;
  smsOptInRequestSentAt?: string;
  smsOptInConfirmedAt?: string;
};

export const DEFAULT_COMMUNICATION_PREFERENCES: CommunicationPreferences = {
  emailMarketing: false, // Opt-in for marketing emails
  smsTransactional: false, // Opt-in for transactional SMS
  smsMarketing: false, // Opt-in for marketing SMS
  unsubscribedAll: false,
};

export function normalizeCommunicationPreferences(
  input?: Partial<CommunicationPreferences> | null
): CommunicationPreferences {
  if (!input) {
    return { ...DEFAULT_COMMUNICATION_PREFERENCES };
  }

  // Handle migration from old field names to new structure
  // Old fields: emailMonthlyStatus, emailExpirationWarnings, emailPromotions
  //             smsMonthlyStatus, smsExpirationWarnings, smsPromotions
  // New fields: emailMarketing, smsTransactional, smsMarketing
  const oldInput = input as any; // Type assertion to access old fields
  
  // Migrate email preferences: emailMarketing = emailPromotions (if new field not present)
  const emailMarketing = input.emailMarketing ?? 
    (oldInput.emailPromotions === true ? true : DEFAULT_COMMUNICATION_PREFERENCES.emailMarketing);
  
  // Migrate SMS transactional: smsTransactional = smsMonthlyStatus || smsExpirationWarnings
  const smsTransactional = input.smsTransactional ?? 
    (oldInput.smsMonthlyStatus === true || oldInput.smsExpirationWarnings === true 
      ? true 
      : DEFAULT_COMMUNICATION_PREFERENCES.smsTransactional);
  
  // Migrate SMS marketing: smsMarketing = smsPromotions
  const smsMarketing = input.smsMarketing ?? 
    (oldInput.smsPromotions === true ? true : DEFAULT_COMMUNICATION_PREFERENCES.smsMarketing);

  return {
    emailMarketing,
    smsTransactional,
    smsMarketing,
    unsubscribedAll:
      input.unsubscribedAll ?? DEFAULT_COMMUNICATION_PREFERENCES.unsubscribedAll,
    // SMS opt-in tracking fields (optional, no defaults)
    smsOptedInAt: input.smsOptedInAt,
    smsOptInMethod: input.smsOptInMethod,
    smsOptInSource: input.smsOptInSource,
    smsOptInRequestSentAt: input.smsOptInRequestSentAt,
    smsOptInConfirmedAt: input.smsOptInConfirmedAt,
  };
}

/**
 * Flatten SMS opt-in properties from CommunicationPreferences to top-level properties
 * for Klaviyo conditional splits (Klaviyo doesn't expose nested object properties)
 * Only includes properties that have values (excludes null/undefined)
 */
export function flattenSMSOptInProperties(
  preferences: CommunicationPreferences
): Record<string, unknown> {
  const flattened: Record<string, unknown> = {
    sms_transactional: preferences.smsTransactional ?? false,
    sms_marketing: preferences.smsMarketing ?? false,
  };

  // Only include opt-in properties if they have values (Klaviyo may not display null properties)
  if (preferences.smsOptInConfirmedAt) {
    flattened.sms_opt_in_confirmed_at = preferences.smsOptInConfirmedAt;
  }
  if (preferences.smsOptInMethod) {
    flattened.sms_opt_in_method = preferences.smsOptInMethod;
  }
  if (preferences.smsOptedInAt) {
    flattened.sms_opted_in_at = preferences.smsOptedInAt;
  }
  if (preferences.smsOptInRequestSentAt) {
    flattened.sms_opt_in_request_sent_at = preferences.smsOptInRequestSentAt;
  }
  if (preferences.smsOptInSource) {
    flattened.sms_opt_in_source = preferences.smsOptInSource;
  }

  return flattened;
}
