---
name: Webhook Issue
about: Report an issue with webhook functionality
title: '[WEBHOOK] '
labels: webhook, bug
assignees: ''
---

## Webhook Issue Description

<!-- A clear description of the webhook issue -->

## CRM Information

- **CRM Type**: [Shopify / Commerce7]
- **Webhook Topic**: [e.g., customers/create, orders/update]
- **Environment**: [Development with Ngrok / Staging / Production]

## Webhook Configuration

- **Webhook URL**: `https://...`
- **Subdomain Prefix**: [shp / c7]
- **Webhook Registration Method**: [Manual / Programmatic / UI]

## Issue Details

### What's happening?

<!-- Describe what's going wrong with the webhook -->

### Expected Behavior

<!-- What should happen when the webhook is triggered? -->

### Actual Behavior

<!-- What's actually happening? -->

## Webhook Payload

<!-- If applicable, paste the webhook payload (remove sensitive data) -->

```json
{
  "topic": "...",
  "data": {
    ...
  }
}
```

## Error Messages

<!-- Paste any error messages from server logs -->

```
Paste error logs here
```

## Validation Status

- [ ] Webhook signature validation failing
- [ ] Webhook not receiving requests
- [ ] Webhook processing error
- [ ] Webhook timeout
- [ ] Other (describe below)

## Ngrok Configuration (if applicable)

- **Ngrok URL**: `https://...`
- **Ngrok Inspector URL**: `http://127.0.0.1:4040`
- **Request visible in Ngrok Inspector**: [Yes / No]

## Troubleshooting Steps Taken

<!-- What have you tried so far? -->

- [ ] Verified webhook URL is correct
- [ ] Checked API secrets in .env file
- [ ] Reviewed server logs
- [ ] Tested with webhook-test.sh script
- [ ] Checked Ngrok Inspector
- [ ] Verified CRM webhook is active
- [ ] Other (describe below)

## Environment Details

- **Node Version**: 
- **OS**: 
- **Local/Remote**: [Local development / Deployed]

## Additional Context

<!-- Add any other context, screenshots, or information -->

## Webhook Inspector Data

<!-- If available, paste relevant data from Ngrok Inspector -->

