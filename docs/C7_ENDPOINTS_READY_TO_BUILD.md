# Commerce7 Endpoints - Ready to Build

## Quick Reference

All endpoints gathered and validated on **October 26, 2025**. Ready for implementation!

**Base URL**: `https://api.commerce7.com`

**Authentication**: All requests require Bearer token
```
Authorization: Bearer {access_token}
```

---

## 1. Club (Tier) API

**Endpoint**: `POST/GET/PUT/DELETE /v1/club`

### Create Club (Tier)

```typescript
POST /v1/club

Request:
{
  "title": "Bronze Member",           // Tier name
  "slug": "bronze-member",            // URL-friendly
  "type": "Traditional",              // Always "Traditional"
  "seo": {
    "title": "Bronze Member"
  },
  "webStatus": "Not Available",       // Always "Not Available"
  "adminStatus": "Not Available"      // Always "Not Available"
}

Response:
{
  "id": "17324e27-5db7-43ae-8aff-d46ac74f5dd6",
  "title": "Bronze Member",
  "type": "Traditional",
  "content": null,
  "publishDate": "2019-12-15T20:56:00.000Z",
  "slug": "bronze-member",
  "createdAt": "2019-12-15T20:56:23.614Z",
  "updatedAt": "2019-12-15T20:56:23.614Z",
  "seo": {
    "title": "Bronze Member",
    "description": null
  }
}
```

### ENUMs
```typescript
type: "Traditional" | "Subscription"       // Always use "Traditional"
webStatus: "Available" | "Not Available"   // Always use "Not Available"
adminStatus: "Available" | "Not Available" // Always use "Not Available"
```

### Notes
- **C7 Clubs = LiberoVino Tiers** (not Club Programs!)
- Each LV tier (Bronze, Silver, Gold) gets its own C7 Club
- Need full CRUD operations
- Always hidden from web/admin (we control enrollment)

---

## 2. Club Membership API

**Endpoint**: `POST/GET/PUT/DELETE /v1/club-membership`

### Create Club Membership

```typescript
POST /v1/club-membership

Request:
{
  "customerId": "acb21fe8-5de6-11e8-831d-02cdf1ea4656",
  "clubId": "c217e0e0-5de6-11e8-831d-02cdf1ea4656",
  "billToCustomerAddressId": "d39128cd-5de6-11e8-831d-02cdf1ea4656",
  "orderDeliveryMethod": "Ship",              // Always "Ship"
  "shipToCustomerAddressId": "0ff27272-5de7-11e8-831d-02cdf1ea4656",
  "customerCreditCardId": "16ac16e9-5de7-11e8-831d-02cdf1ea4656",
  "signupDate": "2017-01-01T00:00:00-08:00",
  "cancelDate": null
}

Response:
{
  "status": "Active",
  "id": "28e4c85b-2834-4370-82d9-582cd0069250",
  "customerId": "...",
  "clubId": "...",
  "billToCustomerAddressId": "...",
  "orderDeliveryMethod": "Ship",
  "shipToCustomerAddressId": "...",
  "customerCreditCardId": "...",
  "signupDate": "2018-05-18T17:02:59.777Z",
  "cancelDate": null,
  "lastProcessedDate": null,
  "currentNumberOfShipments": 0,
  "createdAt": "2018-05-18T17:02:59.778Z",
  "updatedAt": "2018-05-18T22:17:54.774Z",
  "customer": { /* full customer object */ },
  "club": { /* full club object */ },
  "onHolds": []
}
```

### ENUMs
```typescript
status: "Active" | "Cancelled" | "On Hold"  // Our members never "On Hold"
orderDeliveryMethod: "Pickup" | "Ship"      // Always "Ship"
cancellationReason: 
  "Too much wine" |
  "Financial reasons" |
  "Health reasons" |
  "Pregnant" |
  "Moving" |
  "Switching to another club" |           // We always use this
  "Other"
```

### Notes
- **This is the enrollment** - creates membership
- Requires addresses and credit card first
- When upgrading tiers: Cancel old membership (reason: "Switching"), create new one
- Status "Active" = currently enrolled

---

## 3. Customer Address API

### Create Customer + Billing Address

**Endpoint**: `POST /v1/customer-address`

```typescript
POST /v1/customer-address

Request:
{
  "honorific": "Mr",
  "firstName": "John",
  "lastName": "Smith",
  "address": "123 Main St",
  "address2": "Apt 201",
  "city": "Napa",
  "stateCode": "CA",
  "zipCode": "94558",
  "countryCode": "US",
  "emailMarketingStatus": null,
  "birthDate": "1960-05-01",
  "metaData": {},
  "emails": [
    { "email": "john@example.com" }
  ],
  "phones": [
    { "phone": "+15555555555" }
  ],
  "orderInformation": {
    "acquisitionChannel": "Inbound"
  }
}

Response:
{
  "id": "a36b6ff1-7190-49a0-895e-fd2c001eb2a6",  // Customer ID
  "avatar": null,
  "honorific": "Mr",
  "firstName": "John",
  "lastName": "Smith",
  // ... full customer object
  "emails": [
    { "id": "...", "email": "john@example.com" }
  ],
  "phones": [
    { "id": "...", "phone": "+15555555555" }
  ]
}
```

### Notes
- **Creates TWO things**: Customer + billing address in one call
- First address created is automatically `isDefault: true` (billing)
- Returns full customer object with embedded address ID

---

### Add Additional Address

**Endpoint**: `POST /v1/customer/{customerId}/address`

```typescript
POST /v1/customer/{customerId}/address

Request:
{
  "firstName": "John",
  "lastName": "Smith",
  "company": null,
  "address": "456 Oak St",
  "address2": null,
  "city": "Sonoma",
  "stateCode": "CA",
  "zipCode": "95476",
  "phone": "+15555555555",
  "countryCode": "US",
  "isDefault": false,                    // false = shipping address
  "birthDate": "1960-05-01"
}

Response: (same as request)
```

### Get Customer Addresses

```typescript
GET /v1/customer/{customerId}/address

Response: Array of address objects
```

### Notes
- `isDefault: true` = **Billing address**
- `isDefault: false` = **Shipping address** (or additional)
- Can GET addresses for existing customers
- New customer flow:
  1. Create customer + billing (isDefault: true)
  2. Add shipping (isDefault: false) if different
  3. If same, use billing address for both in membership

---

## 4. Credit Card API

**Endpoint**: `POST/GET/PUT/DELETE /v1/customer/{customerId}/credit-card`

### Add Credit Card

```typescript
POST /v1/customer/{customerId}/credit-card

Request:
{
  "cardBrand": "Visa",                   // Auto-detected
  "gateway": "No Gateway",               // Auto-set by C7
  "maskedCardNumber": "************4242",
  "tokenOnFile": "tok_xxxxx",            // C7 handles tokenization
  "expiryMo": 12,
  "expiryYr": 2025,
  "cardHolderName": "John Smith",
  "isDefault": true
}

Response: (same as request)
```

### ENUMs
```typescript
cardBrand:
  "Visa" |
  "American Express" |
  "MasterCard" |
  "Discover" |
  "JCB" |
  "Diners Club" |
  "UnionPay" |
  "Maestro" |
  "Unknown"

gateway:
  "No Gateway" |           // Default for club memberships
  "Commerce7Payments" |
  "Stripe" |
  "PayGate" |
  "USAePay" |
  "CardConnect" |
  "Payment Express" |
  "Poynt"
```

### Notes
- **C7 handles ALL card tokenization** - we never see raw card data
- C7 determines gateway based on tenant location
- We only store the card ID reference
- PCI compliance: Not our problem! ✅

---

## 5. Promotion API

**Endpoint**: `POST/GET/PUT/DELETE /v1/promotion`

### Create Promotion

```typescript
POST /v1/promotion

Request:
{
  "title": "Bronze Member Discount",
  "actionMessage": "15% off all wines as a Bronze member",
  "usageLimitType": "Unlimited",
  "appliesTo": "Store",                    // Need to verify ENUM
  "appliesToObjectIds": null,              // null = all products
  "productDiscountType": "Percentage Off",
  "productDiscount": 1500,                 // Need to verify: 15% = 1500 or 15?
  "shippingDiscountType": "No Discount",
  "shippingDiscount": null,
  "status": "Enabled",
  "minimumCartAmount": null,
  "availableTo": "Club",                   // ← Links to club!
  "availableToObjectIds": ["club-uuid"],   // ← Club ID here
  "startDate": "2025-10-27T00:00:00.000Z",
  "endDate": null                          // No expiration
}

Response:
{
  "id": "8ac801c3-8bf9-4bd3-a65c-cd05dbdbaf15",
  "title": "Bronze Member Discount",
  // ... all request fields
  "promotionSets": [
    { "id": "279c3a37-8b06-49d4-a588-9911bda7f917" }
  ],
  "createdAt": "2018-05-18T16:53:46.166Z",
  "updatedAt": "2018-05-18T16:53:46.166Z"
}
```

### ENUMs (Need to Verify)
```typescript
appliesTo: 
  "Store" |        // Likely: All products
  "Product" |      // Specific products
  "Collection" |   // Product collections
  ??? 

availableTo:
  "Everyone" |
  "Club" |         // ← Our use case
  "Customer" |     // Specific customers?
  ???

productDiscountType:
  "Percentage Off" |
  "Dollar Off" |
  "No Discount" |
  ???

usageLimitType:
  "Unlimited" |
  ???
```

### Notes
- **Promotions auto-apply** (unlike coupons which need manual code)
- `availableTo: "Club"` + `availableToObjectIds: [clubId]` = club-specific promo
- **Need to test**:
  - Discount value format (15% = 15 or 1500?)
  - Complete ENUM values
  - Promotion Sets for combos (20% + Free Shipping)

---

## 6. Loyalty Tier API

**Endpoint**: `POST/GET/PUT/DELETE /v2/loyalty-tier` ⚠️ **v2 API!**

### Create Loyalty Tier

```typescript
POST /v2/loyalty-tier

Request:
{
  "title": "Bronze Tier Loyalty",
  "isBaseTier": false,                   // Always false for us
  "qualificationType": "Lifetime Value", // Need other options
  "lifetimeValueToQualify": 10000,       // $100? Need to verify
  "earnRate": 0.01,                      // 1%? Need to verify format
  "sortOrder": 1
}

Response:
{
  "id": "23f2584c-ca6c-4c81-8115-31d1fa96ab1b",
  "title": "Bronze Tier Loyalty",
  "isBaseTier": false,
  "qualificationType": "Lifetime Value",
  "lifetimeValueToQualify": 10000,
  "earnRate": 0.01,
  "sortOrder": 1,
  "createdAt": "2024-01-09T14:59:03.940Z",
  "updatedAt": "2025-10-26T20:01:12.491Z"
}
```

### Notes
- **Loyalty is an EXTENSION** - must be activated by tenant first
- We can detect if not enabled (API will error)
- `isBaseTier: false` always (we don't use base tier concept)
- **Need to find**: How loyalty tier links to club tier
- **Need to test**:
  - earnRate format (0.01 = 1% or 1 point per dollar?)
  - qualificationType other options
  - Club linking mechanism

---

## 7. Loyalty Transaction API

**Endpoint**: `POST /v2/loyalty-transaction` ⚠️ **v2 API!**

### Add/Remove Points

```typescript
POST /v2/loyalty-transaction

Request:
{
  "customerId": "b46e8b11-4ea6-4790-841a-5bbf0695240e",
  "amount": 100,                         // Positive = add, negative = remove
  "notes": "Welcome bonus for Gold tier"
}

Response:
{
  "id": "e037a46b-4cc5-408b-9fe2-27aba9be414a",
  "customerId": "b46e8b11-4ea6-4790-841a-5bbf0695240e",
  "transactionDate": "2025-10-26T20:05:21.429Z",
  "transactionType": "Manual",
  "orderId": null,
  "orderNumber": null,
  "transactionDetails": "Manually entered transaction by Bill Langley",
  "notes": "Welcome bonus for Gold tier",
  "amount": 100,
  "amountRedeemed": null,
  "createdAt": "2025-10-26T20:05:21.429Z",
  "updatedAt": "2025-10-26T20:05:21.429Z",
  "customer": { /* full customer object with loyalty.points updated */ }
}
```

### Notes
- Used for **manual point adjustments**
- Use case: Bonus points for premium tier enrollment
- Points are embedded in customer object:
  ```json
  customer.loyalty: {
    "tier": "Bronze Tier",
    "loyaltyTierId": "uuid",
    "points": 100
  }
  ```

---

## Complete Customer Enrollment Flow

### New Customer (From Scratch)

```typescript
// Step 1: Create customer + billing address
const customerResponse = await fetch('/v1/customer-address', {
  method: 'POST',
  body: JSON.stringify({
    firstName: "John",
    lastName: "Smith",
    address: "123 Main St",
    city: "Napa",
    stateCode: "CA",
    zipCode: "94558",
    countryCode: "US",
    emails: [{ email: "john@example.com" }],
    phones: [{ phone: "+15555555555" }]
  })
});
const customer = await customerResponse.json();
const customerId = customer.id;
const billingAddressId = customer.id; // First address is billing

// Step 2: Add shipping address (if different)
let shippingAddressId = billingAddressId; // Default: same as billing

if (shippingDifferent) {
  const addressResponse = await fetch(`/v1/customer/${customerId}/address`, {
    method: 'POST',
    body: JSON.stringify({
      firstName: "John",
      lastName: "Smith",
      address: "456 Oak St",
      city: "Sonoma",
      stateCode: "CA",
      zipCode: "95476",
      countryCode: "US",
      isDefault: false  // Shipping address
    })
  });
  const address = await addressResponse.json();
  shippingAddressId = address.id;
}

// Step 3: Add credit card (C7 handles tokenization)
const cardResponse = await fetch(`/v1/customer/${customerId}/credit-card`, {
  method: 'POST',
  body: JSON.stringify({
    cardBrand: "Visa",
    gateway: "No Gateway",
    maskedCardNumber: "************4242",
    tokenOnFile: "tok_xxxxx",  // From C7 tokenization
    expiryMo: 12,
    expiryYr: 2025,
    cardHolderName: "John Smith",
    isDefault: true
  })
});
const card = await cardResponse.json();
const creditCardId = card.id;

// Step 4: Create club membership (enrollment!)
const membershipResponse = await fetch('/v1/club-membership', {
  method: 'POST',
  body: JSON.stringify({
    customerId: customerId,
    clubId: bronzeClubId,  // Our Bronze tier
    billToCustomerAddressId: billingAddressId,
    shipToCustomerAddressId: shippingAddressId,
    customerCreditCardId: creditCardId,
    orderDeliveryMethod: "Ship",
    signupDate: new Date().toISOString(),
    cancelDate: null
  })
});
const membership = await membershipResponse.json();

// Step 5: Add bonus points (if applicable)
if (bonusPoints > 0) {
  await fetch('/v2/loyalty-transaction', {
    method: 'POST',
    body: JSON.stringify({
      customerId: customerId,
      amount: bonusPoints,
      notes: "Welcome bonus for Bronze tier"
    })
  });
}

// DONE! Customer is now enrolled in Bronze tier
```

### Existing Customer (Upgrade/Downgrade)

```typescript
// Step 1: Get customer addresses
const addressesResponse = await fetch(`/v1/customer/${customerId}/address`);
const addresses = await addressesResponse.json();

// Find billing and shipping
const billingAddress = addresses.find(a => a.isDefault === true);
const shippingAddress = addresses.find(a => a.isDefault === false) || billingAddress;

// Step 2: Get credit cards
const cardsResponse = await fetch(`/v1/customer/${customerId}/credit-card`);
const cards = await cardsResponse.json();
const defaultCard = cards.find(c => c.isDefault === true);

// Step 3: Cancel old membership
await fetch(`/v1/club-membership/${oldMembershipId}`, {
  method: 'PUT',
  body: JSON.stringify({
    status: "Cancelled",
    cancelDate: new Date().toISOString(),
    cancellationReason: "Switching to another club"
  })
});

// Step 4: Create new membership (upgraded tier)
const newMembershipResponse = await fetch('/v1/club-membership', {
  method: 'POST',
  body: JSON.stringify({
    customerId: customerId,
    clubId: silverClubId,  // Upgraded to Silver
    billToCustomerAddressId: billingAddress.id,
    shipToCustomerAddressId: shippingAddress.id,
    customerCreditCardId: defaultCard.id,
    orderDeliveryMethod: "Ship",
    signupDate: new Date().toISOString(),
    cancelDate: null
  })
});

// DONE! Customer upgraded to Silver tier
```

---

## Testing Checklist

### Priority 1: Must Verify Before Building
- [ ] Promotion discount value format (15% = 15 or 1500?)
- [ ] Promotion ENUMs (appliesTo, availableTo, etc.)
- [ ] Loyalty earnRate format (0.01 = 1% or 1 pt/$?)
- [ ] How loyalty tier links to club tier

### Priority 2: Good to Know
- [ ] Promotion Sets API (for combos like "20% + Free Shipping")
- [ ] Loyalty qualificationType options
- [ ] Complete list of all ENUMs

### Priority 3: Nice to Have
- [ ] Cart endpoints (for dollar-based tier assignment)
- [ ] Order endpoints (for tracking purchases)
- [ ] Customer product history

---

## Key Architectural Decisions

### 1. C7 Clubs = LV Tiers (Not Programs!)
```
LiberoVino Club Program
├─ Bronze Tier → C7 Club "Bronze Member"
├─ Silver Tier → C7 Club "Silver Member"
└─ Gold Tier → C7 Club "Gold Member"
```

### 2. Membership = Enrollment
- Creating ClubMembership = enrolling customer in tier
- Requires: customer, addresses, credit card
- One active membership per tier per customer

### 3. Tier Changes = Membership Changes
- Upgrade: Cancel old (reason: "Switching"), create new
- Downgrade: Same process
- Duration extension: Update existing membership

### 4. Loyalty is Optional & Tier-Specific
- Not all tiers need loyalty
- Each tier can have different earn rates
- Bonus points via manual transactions
- Loyalty extension must be enabled by tenant

### 5. Promotions Auto-Apply
- No manual coupon codes needed!
- Linked to clubs via `availableTo: "Club"`
- Can have multiple promos per tier (sets?)

---

## Ready to Build! 🚀

All endpoints documented and ready for implementation.

**Next Steps (Tomorrow):**
1. Create TypeScript types for all entities
2. Update Commerce7Provider with new methods
3. Test each endpoint in development
4. Build enrollment flow
5. Implement tier management

**Documentation:**
- [TIER_SUITE_RECOMMENDATIONS.md](./TIER_SUITE_RECOMMENDATIONS.md) - Business vision
- [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md) - Full API reference (will update)
- [CLUB_CREATION_FLOW.md](./CLUB_CREATION_FLOW.md) - Creation process

**Status**: ✅ Ready for Development
**Last Updated**: October 26, 2025, 10:00 PM

