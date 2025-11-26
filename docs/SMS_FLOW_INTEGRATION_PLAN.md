# SMS Flow Integration Plan

## Overview

Integrate SMS into existing Klaviyo flows using conditional splits, allowing customers to opt-in to email-only, SMS-only, or both channels. SMS will be transactional-only (enrollment confirmations, expiration warnings).

## Requirements

### Enrollment Validation
- **During enrollment**: Customers must opt-in to at least one communication channel (email or SMS)
- **After enrollment**: Customers can opt-out of everything (GDPR requirement)
- "Unsubscribe from all" during enrollment should be disabled or show error preventing enrollment

### Klaviyo Flow Structure
- Modify existing flows to include both email and SMS actions
- Use conditional splits to check communication preferences at runtime
- Flows should handle:
  - Email only (`emailExpirationWarnings: true`, `smsExpirationWarnings: false`)
  - SMS only (`emailExpirationWarnings: false`, `smsExpirationWarnings: true`)
  - Both (`emailExpirationWarnings: true`, `smsExpirationWarnings: true`)
  - Neither (both false, or `unsubscribedAll: true` - handled at event trigger level)

### Flow Actions Needed
1. **Conditional Split: Check Email Opt-In**
   - Condition: `communication_preferences.emailExpirationWarnings` OR `emailMonthlyStatus`
   - TRUE → Send Email Action
   - FALSE → Skip Email

2. **Conditional Split: Check SMS Opt-In**
   - Condition: `communication_preferences.smsExpirationWarnings` OR `smsMonthlyStatus`
   - TRUE → Send SMS Action
   - FALSE → Skip SMS

### SMS Actions
- SMS actions should use Klaviyo's SMS channel
- SMS templates need to be created (or use simple text messages)
- For Twilio fallback: Send direct SMS after event trigger (not via flow)

## Implementation Tasks

### 1. Enrollment Form Validation
- [ ] Add validation in `app.members.new.customer.tsx` action
- [ ] Require at least one of: `emailMonthlyStatus`, `emailExpirationWarnings`, `smsMonthlyStatus`, `smsExpirationWarnings`
- [ ] Disable or show error for "Unsubscribe from all" during enrollment
- [ ] Error message: "You must opt-in to at least one communication channel to enroll. You can change preferences later."

### 2. Klaviyo Flow Creation Updates
- [ ] Update `createFlow()` in `klaviyo.server.ts` to include SMS actions
- [ ] Add conditional splits based on communication preferences
- [ ] Create SMS templates or use simple text messages
- [ ] Test flow creation with conditional logic

### 3. SMS Templates
- [ ] Create SMS template content for:
  - Club Signup confirmation
  - Expiration warnings
  - Monthly status (if transactional)
- [ ] Store templates in Klaviyo or use inline text

### 4. Enrollment Event Updates
- [ ] Ensure `triggerKlaviyoClubSignup` includes phone number (already done)
- [ ] Verify conditional splits work correctly
- [ ] For Twilio fallback: Add direct SMS send after enrollment

### 5. Testing
- [ ] Test email-only opt-in
- [ ] Test SMS-only opt-in
- [ ] Test both channels opt-in
- [ ] Test neither (should not trigger flow due to `unsubscribedAll` check)
- [ ] Test Twilio fallback SMS

## Technical Notes

### Conditional Split Structure
```javascript
{
  type: 'action-output-split',
  temporary_id: 'check_email_optin',
  links: {
    next_if_true: 'send_email_action',
    next_if_false: 'check_sms_optin'
  },
  data: {
    action_output_filter: {
      condition_groups: [{
        conditions: [{
          type: 'profile-property',
          property: 'communication_preferences.emailExpirationWarnings',
          filter: {
            type: 'boolean',
            operator: 'equals',
            value: true
          }
        }]
      }]
    }
  }
}
```

### Profile Properties
Communication preferences are stored in Klaviyo profile properties as:
```javascript
communication_preferences: {
  emailMonthlyStatus: boolean,
  emailExpirationWarnings: boolean,
  emailPromotions: boolean,
  smsMonthlyStatus: boolean,
  smsExpirationWarnings: boolean,
  smsPromotions: boolean,
  unsubscribedAll: boolean
}
```

## Future Considerations
- SMS template management UI
- SMS delivery status tracking
- SMS opt-out handling (STOP keyword)
- RedChirp integration (when credentials available)

