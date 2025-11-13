export type CommunicationPreferences = {
  emailMonthlyStatus: boolean;
  emailExpirationWarnings: boolean;
  emailPromotions: boolean;
  smsMonthlyStatus: boolean;
  smsExpirationWarnings: boolean;
  smsPromotions: boolean;
  unsubscribedAll: boolean;
};

export const DEFAULT_COMMUNICATION_PREFERENCES: CommunicationPreferences = {
  emailMonthlyStatus: true,
  emailExpirationWarnings: true,
  emailPromotions: false,
  smsMonthlyStatus: false,
  smsExpirationWarnings: false,
  smsPromotions: false,
  unsubscribedAll: false,
};

export function normalizeCommunicationPreferences(
  input?: Partial<CommunicationPreferences> | null
): CommunicationPreferences {
  if (!input) {
    return { ...DEFAULT_COMMUNICATION_PREFERENCES };
  }

  return {
    emailMonthlyStatus:
      input.emailMonthlyStatus ?? DEFAULT_COMMUNICATION_PREFERENCES.emailMonthlyStatus,
    emailExpirationWarnings:
      input.emailExpirationWarnings ?? DEFAULT_COMMUNICATION_PREFERENCES.emailExpirationWarnings,
    emailPromotions:
      input.emailPromotions ?? DEFAULT_COMMUNICATION_PREFERENCES.emailPromotions,
    smsMonthlyStatus:
      input.smsMonthlyStatus ?? DEFAULT_COMMUNICATION_PREFERENCES.smsMonthlyStatus,
    smsExpirationWarnings:
      input.smsExpirationWarnings ?? DEFAULT_COMMUNICATION_PREFERENCES.smsExpirationWarnings,
    smsPromotions:
      input.smsPromotions ?? DEFAULT_COMMUNICATION_PREFERENCES.smsPromotions,
    unsubscribedAll:
      input.unsubscribedAll ?? DEFAULT_COMMUNICATION_PREFERENCES.unsubscribedAll,
  };
}
