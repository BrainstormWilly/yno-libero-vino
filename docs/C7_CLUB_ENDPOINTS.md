# Commerce7 Club API Endpoints

## Overview

This document provides comprehensive reference for Commerce7 API endpoints used in the club-based architecture. These endpoints replace the previous tag and coupon-based approach.

## Base URL

```
https://{tenant}.commerce7.com/api/v1
```

**Authentication**: All requests require Bearer token in Authorization header:
```
Authorization: Bearer {access_token}
```

---

## Clubs API

### Create Club

Creates a new club (membership program) on Commerce7.

**Endpoint**: `POST /club`

**Request Body**:
```json
{
  "title": "Founders Circle",
  "description": "Our exclusive membership program with tiered benefits",
  "clubCode": "FC2025",
  "isActive": true,
  "settings": {
    "allowPublicSignup": false,
    "requireApproval": true,
    "autoRenew": false
  }
}
```

**Request Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Display name of the club |
| `description` | string | No | Description shown to customers |
| `clubCode` | string | Yes | Unique identifier for the club |
| `isActive` | boolean | No | Whether club is currently active (default: true) |
| `settings` | object | No | Club configuration settings |
| `settings.allowPublicSignup` | boolean | No | Allow customers to self-enroll (default: false) |
| `settings.requireApproval` | boolean | No | Require admin approval for enrollment (default: true) |
| `settings.autoRenew` | boolean | No | Auto-renew memberships (default: false) |

**Response** (201 Created):
```json
{
  "club": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Founders Circle",
    "description": "Our exclusive membership program with tiered benefits",
    "clubCode": "FC2025",
    "isActive": true,
    "settings": {
      "allowPublicSignup": false,
      "requireApproval": true,
      "autoRenew": false
    },
    "memberCount": 0,
    "createdAt": "2025-10-26T10:00:00Z",
    "updatedAt": "2025-10-26T10:00:00Z"
  }
}
```

**Errors**:
- `400 Bad Request` - Invalid club data
- `401 Unauthorized` - Invalid access token
- `409 Conflict` - Club code already exists
- `422 Unprocessable Entity` - Validation failed

**Example**:
```typescript
const response = await fetch(`https://${tenant}.commerce7.com/api/v1/club`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Founders Circle',
    clubCode: 'FC2025',
    isActive: true
  })
});

const { club } = await response.json();
console.log(`Club created with ID: ${club.id}`);
```

---

### Get Club

Retrieves a club by ID.

**Endpoint**: `GET /club/:id`

**Response** (200 OK):
```json
{
  "club": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Founders Circle",
    "clubCode": "FC2025",
    "isActive": true,
    "memberCount": 47,
    "createdAt": "2025-10-26T10:00:00Z",
    "updatedAt": "2025-10-26T10:00:00Z"
  }
}
```

---

### Update Club

Updates an existing club.

**Endpoint**: `PATCH /club/:id`

**Request Body**:
```json
{
  "title": "Founders Circle - Updated",
  "description": "New description",
  "isActive": false
}
```

**Response** (200 OK): Same as Get Club

---

### Delete Club

Deletes a club. **Warning**: This will remove all associated memberships.

**Endpoint**: `DELETE /club/:id`

**Query Parameters**:
- `cascade` (boolean) - If true, delete all memberships (default: false)

**Response** (204 No Content): Empty body

**Errors**:
- `400 Bad Request` - Club has active members and cascade=false
- `404 Not Found` - Club not found

---

### List Clubs

Retrieves all clubs for the tenant.

**Endpoint**: `GET /club`

**Query Parameters**:
- `isActive` (boolean) - Filter by active status
- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (default: 25, max: 100)

**Response** (200 OK):
```json
{
  "clubs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Founders Circle",
      "clubCode": "FC2025",
      "memberCount": 47
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "totalPages": 1,
    "totalCount": 1
  }
}
```

---

## Club Membership API

### Create Club Membership

Enrolls a customer in a club.

**Endpoint**: `POST /club/:clubId/membership`

**Request Body**:
```json
{
  "customerId": "customer-uuid",
  "tier": "Bronze",
  "startDate": "2025-10-26",
  "endDate": "2026-01-26",
  "autoRenew": false,
  "status": "active"
}
```

**Request Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customerId` | string | Yes | Commerce7 customer ID |
| `tier` | string | No | Tier/level name (e.g., "Bronze", "Silver") |
| `startDate` | string | Yes | ISO date when membership starts |
| `endDate` | string | Yes | ISO date when membership ends |
| `autoRenew` | boolean | No | Auto-renew on end date (default: false) |
| `status` | string | No | Membership status (default: "active") |

**Status Values**:
- `active` - Currently active membership
- `pending` - Awaiting approval
- `expired` - Past end date
- `cancelled` - Manually cancelled

**Response** (201 Created):
```json
{
  "membership": {
    "id": "membership-uuid",
    "clubId": "club-uuid",
    "customerId": "customer-uuid",
    "tier": "Bronze",
    "startDate": "2025-10-26",
    "endDate": "2026-01-26",
    "status": "active",
    "autoRenew": false,
    "createdAt": "2025-10-26T10:00:00Z"
  }
}
```

**Errors**:
- `400 Bad Request` - Invalid membership data
- `404 Not Found` - Club or customer not found
- `409 Conflict` - Customer already has active membership in this club

---

### Get Club Membership

Retrieves a specific membership.

**Endpoint**: `GET /club/:clubId/membership/:membershipId`

---

### Update Club Membership

Updates membership details (e.g., extend duration, change tier).

**Endpoint**: `PATCH /club/:clubId/membership/:membershipId`

**Request Body**:
```json
{
  "tier": "Silver",
  "endDate": "2026-07-26",
  "status": "active"
}
```

---

### Cancel Club Membership

Cancels a membership.

**Endpoint**: `DELETE /club/:clubId/membership/:membershipId`

**Query Parameters**:
- `immediate` (boolean) - Cancel immediately vs. at end date (default: false)

---

### List Club Memberships

Lists all memberships for a club.

**Endpoint**: `GET /club/:clubId/membership`

**Query Parameters**:
- `status` (string) - Filter by status
- `tier` (string) - Filter by tier
- `customerId` (string) - Filter by customer
- `page`, `limit` - Pagination

**Response**:
```json
{
  "memberships": [
    {
      "id": "membership-uuid",
      "customerId": "customer-uuid",
      "tier": "Bronze",
      "status": "active",
      "endDate": "2026-01-26"
    }
  ],
  "pagination": { ... }
}
```

---

## Promotions API

### Create Promotion

Creates a promotional discount that can be assigned to a club.

**Endpoint**: `POST /promotion`

**Request Body**:
```json
{
  "title": "Bronze Member Discount",
  "code": "BRONZE-FC-2025",
  "type": "percentage",
  "value": 15.0,
  "clubId": "club-uuid",
  "autoApply": true,
  "isActive": true,
  "applicableProducts": [],
  "applicableCollections": [],
  "minPurchaseAmount": null,
  "maxDiscountAmount": null,
  "startDate": "2025-10-26T00:00:00Z",
  "endDate": null,
  "usageLimit": null,
  "usageCount": 0
}
```

**Request Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Display name of promotion |
| `code` | string | Yes | Unique promotion code |
| `type` | string | Yes | "percentage" or "fixed_amount" |
| `value` | number | Yes | Discount value (15.0 = 15%, or dollar amount) |
| `clubId` | string | No | Club ID to associate with (optional) |
| `autoApply` | boolean | No | Automatically apply at checkout (default: false) |
| `isActive` | boolean | No | Active status (default: true) |
| `applicableProducts` | array | No | Product IDs (empty = all products) |
| `applicableCollections` | array | No | Collection IDs (empty = all) |
| `minPurchaseAmount` | number | No | Minimum cart total required |
| `maxDiscountAmount` | number | No | Maximum discount cap |
| `startDate` | string | No | When promo becomes active |
| `endDate` | string | No | When promo expires (null = no expiration) |
| `usageLimit` | number | No | Max total uses (null = unlimited) |

**Response** (201 Created):
```json
{
  "promotion": {
    "id": "promo-uuid",
    "title": "Bronze Member Discount",
    "code": "BRONZE-FC-2025",
    "type": "percentage",
    "value": 15.0,
    "clubId": "club-uuid",
    "autoApply": true,
    "isActive": true,
    "usageCount": 0,
    "createdAt": "2025-10-26T10:00:00Z"
  }
}
```

**Key Feature**: `autoApply: true` means this promotion automatically applies to club members at checkout - no manual code entry required!

**Errors**:
- `400 Bad Request` - Invalid promotion data
- `409 Conflict` - Promotion code already exists
- `404 Not Found` - Club ID not found (if clubId provided)

---

### Get Promotion

**Endpoint**: `GET /promotion/:id`

---

### Update Promotion

**Endpoint**: `PATCH /promotion/:id`

**Request Body**: Same fields as Create (all optional)

---

### Delete Promotion

**Endpoint**: `DELETE /promotion/:id`

**Response** (204 No Content)

---

### List Promotions

**Endpoint**: `GET /promotion`

**Query Parameters**:
- `clubId` (string) - Filter by club
- `isActive` (boolean) - Filter by active status
- `type` (string) - Filter by type
- `code` (string) - Search by code
- `page`, `limit` - Pagination

---

## Loyalty API

### Create Loyalty Tier

Creates a loyalty earning configuration for a club.

**Endpoint**: `POST /loyalty/tier`

**Request Body**:
```json
{
  "name": "Bronze Tier",
  "clubId": "club-uuid",
  "pointsPerDollar": 1.0,
  "bonusMultiplier": 1.0,
  "redemptionRate": 0.01,
  "minPointsForRedemption": 100,
  "isActive": true
}
```

**Request Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Display name of loyalty tier |
| `clubId` | string | Yes | Associated club ID |
| `pointsPerDollar` | number | Yes | Points earned per dollar spent |
| `bonusMultiplier` | number | No | Bonus multiplier (1.5 = 50% bonus) |
| `redemptionRate` | number | Yes | Dollar value per point (0.01 = 100 pts = $1) |
| `minPointsForRedemption` | number | No | Minimum points to redeem (default: 100) |
| `isActive` | boolean | No | Active status (default: true) |

**Response** (201 Created):
```json
{
  "loyaltyTier": {
    "id": "loyalty-tier-uuid",
    "name": "Bronze Tier",
    "clubId": "club-uuid",
    "pointsPerDollar": 1.0,
    "redemptionRate": 0.01,
    "memberCount": 0,
    "totalPointsAwarded": 0,
    "createdAt": "2025-10-26T10:00:00Z"
  }
}
```

**Example Use Cases**:

1. **Loyalty-Only Tier** (like Starbucks):
```json
{
  "name": "Rewards Member",
  "pointsPerDollar": 10.0,  // High earning rate
  "redemptionRate": 0.01     // 100 points = $1
}
```

2. **Premium Discount + Loyalty**:
```json
{
  "name": "Gold Tier",
  "pointsPerDollar": 5.0,   // Very high earning
  "redemptionRate": 0.02    // 50 points = $1 (better value)
}
```

3. **Standard Tier**:
```json
{
  "name": "Bronze Tier",
  "pointsPerDollar": 1.0,   // Normal earning
  "redemptionRate": 0.01    // Standard value
}
```

---

### Get Loyalty Tier

**Endpoint**: `GET /loyalty/tier/:id`

---

### Update Loyalty Tier

**Endpoint**: `PATCH /loyalty/tier/:id`

---

### Delete Loyalty Tier

**Endpoint**: `DELETE /loyalty/tier/:id`

**Note**: This does NOT delete customer loyalty points, only the tier configuration

---

### List Loyalty Tiers

**Endpoint**: `GET /loyalty/tier`

**Query Parameters**:
- `clubId` (string) - Filter by club
- `isActive` (boolean) - Filter by active status

---

### Award Loyalty Points

Awards points to a customer (usually triggered by order completion).

**Endpoint**: `POST /loyalty/points/award`

**Request Body**:
```json
{
  "customerId": "customer-uuid",
  "points": 150,
  "orderId": "order-uuid",
  "description": "Purchase reward",
  "loyaltyTierId": "loyalty-tier-uuid"
}
```

**Response**:
```json
{
  "transaction": {
    "id": "transaction-uuid",
    "customerId": "customer-uuid",
    "points": 150,
    "balanceAfter": 1850,
    "createdAt": "2025-10-26T10:00:00Z"
  }
}
```

---

### Redeem Loyalty Points

Redeems points (usually for rewards or discounts).

**Endpoint**: `POST /loyalty/points/redeem`

**Request Body**:
```json
{
  "customerId": "customer-uuid",
  "points": 500,
  "rewardId": "reward-uuid",
  "description": "Redeemed for winery tour"
}
```

**Response**:
```json
{
  "transaction": {
    "id": "transaction-uuid",
    "customerId": "customer-uuid",
    "points": -500,
    "balanceAfter": 1350,
    "createdAt": "2025-10-26T10:00:00Z"
  }
}
```

---

### Get Customer Loyalty Balance

**Endpoint**: `GET /loyalty/customer/:customerId`

**Response**:
```json
{
  "customer": {
    "id": "customer-uuid",
    "pointsBalance": 1350,
    "pointsLifetime": 3200,
    "currentTier": {
      "id": "loyalty-tier-uuid",
      "name": "Silver Tier",
      "pointsPerDollar": 2.0
    }
  }
}
```

---

## Webhooks

Commerce7 can send webhooks for club-related events.

### Club Events

- `club.created` - New club created
- `club.updated` - Club details changed
- `club.deleted` - Club removed

### Membership Events

- `club.membership.created` - Customer enrolled
- `club.membership.updated` - Membership changed (tier, duration)
- `club.membership.cancelled` - Membership cancelled
- `club.membership.expired` - Membership reached end date

### Promotion Events

- `promotion.created` - New promotion created
- `promotion.updated` - Promotion details changed
- `promotion.deleted` - Promotion removed

### Loyalty Events

- `loyalty.points.awarded` - Points given to customer
- `loyalty.points.redeemed` - Points used by customer
- `loyalty.tier.changed` - Customer moved to different tier

**Webhook Payload Example**:
```json
{
  "event": "club.membership.created",
  "tenantId": "your-tenant",
  "timestamp": "2025-10-26T10:00:00Z",
  "data": {
    "membership": {
      "id": "membership-uuid",
      "clubId": "club-uuid",
      "customerId": "customer-uuid",
      "tier": "Bronze",
      "status": "active"
    }
  }
}
```

---

## Rate Limits

Commerce7 API rate limits (as of October 2025):

- **Standard**: 100 requests per minute
- **Burst**: 20 requests per second
- **Daily**: 10,000 requests per day

**Response Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1635264000
```

**Rate Limit Exceeded** (429 Too Many Requests):
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 30
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Specific field that caused error",
    "reason": "Detailed explanation"
  }
}
```

**Common Error Codes**:

| Status | Code | Meaning |
|--------|------|---------|
| 400 | `INVALID_REQUEST` | Malformed request body |
| 401 | `UNAUTHORIZED` | Invalid or expired token |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource doesn't exist |
| 409 | `CONFLICT` | Resource already exists |
| 422 | `VALIDATION_ERROR` | Data validation failed |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

---

## Best Practices

### 1. Idempotency

Always check if resources exist before creating:

```typescript
// Check for existing club by code
const existing = await c7.getClubByCode('FC2025');
if (existing) {
  return existing;
}

// Create new club
const club = await c7.createClub({ ... });
```

### 2. Error Handling

Implement retry logic with exponential backoff:

```typescript
async function createWithRetry(createFn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await createFn();
    } catch (error) {
      if (error.status === 429) {
        // Rate limited - wait and retry
        await sleep(Math.pow(2, i) * 1000);
        continue;
      }
      throw error;
    }
  }
}
```

### 3. Batch Operations

When creating multiple resources, batch them:

```typescript
const promos = await Promise.all([
  c7.createPromotion(promo1),
  c7.createPromotion(promo2),
  c7.createPromotion(promo3)
]);
```

### 4. Webhook Validation

Always validate webhook signatures:

```typescript
const signature = request.headers['x-c7-signature'];
const isValid = validateC7Signature(request.body, signature);
if (!isValid) {
  throw new Error('Invalid webhook signature');
}
```

---

## Implementation Checklist

When implementing C7 club functionality:

- [ ] Create club on C7
- [ ] Store C7 club ID in LV database
- [ ] Create promotion(s) for each tier
- [ ] Set `autoApply: true` on promotions
- [ ] Create loyalty tier (if applicable)
- [ ] Implement rollback on errors
- [ ] Set up webhook handlers
- [ ] Test member enrollment
- [ ] Verify promos auto-apply
- [ ] Verify loyalty points accrue

---

**Status**: 📝 Documentation Complete
**API Version**: Commerce7 API v1
**Last Updated**: October 26, 2025

