-- ============================================================
-- LiberoVino Seed Data
-- Generated: 2025-11-12T02:44:31.093Z
-- ============================================================

BEGIN;

-- Clients
INSERT INTO clients (id, tenant_shop, crm_type, org_name, org_contact, user_email, setup_complete, created_at, updated_at)
VALUES ('a7f5c3e2-8d91-4b1e-9a2f-1c5b8e3d4f6a', 'yno-fanbase', 'commerce7', 'Yno Fanbase', 'William Langley', 'will@ynosoftware.com', true, '2025-11-04T20:08:31.335531+00:00', '2025-11-07T22:24:16.263+00:00')
ON CONFLICT (id) DO UPDATE SET
  tenant_shop = EXCLUDED.tenant_shop,
  crm_type = EXCLUDED.crm_type,
  org_name = EXCLUDED.org_name,
  org_contact = EXCLUDED.org_contact,
  user_email = EXCLUDED.user_email,
  setup_complete = EXCLUDED.setup_complete;

-- Club Programs
INSERT INTO club_programs (id, client_id, name, description, is_active, created_at, updated_at)
VALUES ('c3cc02b9-175f-4605-8718-233328cdc8fa', 'a7f5c3e2-8d91-4b1e-9a2f-1c5b8e3d4f6a', 'Yno Fanbase Wine Club', 'Liberate your wine buying experience. Enjoy member pricing on your schedule - no forced shipments, no surprises.', true, '2025-11-04T20:14:48.932296+00:00', '2025-11-06T02:09:59.31+00:00')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- Club Stages (Tiers)
INSERT INTO club_stages (id, club_program_id, name, duration_months, min_purchase_amount, min_ltv_amount, stage_order, is_active, c7_club_id, created_at, updated_at)
VALUES ('dda54e66-8d3d-4e5a-84b9-c68f2810eeea', 'c3cc02b9-175f-4605-8718-233328cdc8fa', 'Fanbase Tier 1', 3, 150, 0, 1, true, '495425cd-781b-42a3-bbfc-e00f668da26e', '2025-11-04T20:17:14.762348+00:00', '2025-11-04T20:17:32.902+00:00')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  duration_months = EXCLUDED.duration_months,
  min_purchase_amount = EXCLUDED.min_purchase_amount,
  min_ltv_amount = EXCLUDED.min_ltv_amount,
  stage_order = EXCLUDED.stage_order,
  is_active = EXCLUDED.is_active,
  c7_club_id = EXCLUDED.c7_club_id;

-- Club Stage Promotions
INSERT INTO club_stage_promotions (id, club_stage_id, crm_id, crm_type, title, description, created_at, updated_at)
VALUES ('243d1264-d3dc-4d94-8e18-679a52136dd8', 'dda54e66-8d3d-4e5a-84b9-c68f2810eeea', '23615b66-1c7b-4046-b6e1-98875234d48c', 'commerce7', 'Fanbase Tier 1 Promo', NULL, '2025-11-04T20:34:31.241369+00:00', '2025-11-04T20:34:31.241369+00:00')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description;

-- Customers
INSERT INTO customers (id, client_id, email, first_name, last_name, phone, crm_id, is_club_member, current_club_stage_id, created_at, updated_at)
VALUES ('04092822-bbe5-45c7-8a01-d518f47013ac', 'a7f5c3e2-8d91-4b1e-9a2f-1c5b8e3d4f6a', 'jmonroe@me.com', 'James', 'Monroe', '+17075558264', '897f86c6-b9e6-457c-b17e-eec464e85a87', false, NULL, '2025-11-05T01:37:32.051637+00:00', '2025-11-05T01:37:32.051637+00:00')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone,
  is_club_member = EXCLUDED.is_club_member,
  current_club_stage_id = EXCLUDED.current_club_stage_id;

INSERT INTO customers (id, client_id, email, first_name, last_name, phone, crm_id, is_club_member, current_club_stage_id, created_at, updated_at)
VALUES ('c46fa562-9881-4659-9c71-450ce035c889', 'a7f5c3e2-8d91-4b1e-9a2f-1c5b8e3d4f6a', 'jmadison@me.com', 'James', 'Madison', '+14155553987', '861bde22-4e2c-4afe-96ec-9c57df702214', false, NULL, '2025-11-05T01:41:29.656966+00:00', '2025-11-05T01:41:29.656966+00:00')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone,
  is_club_member = EXCLUDED.is_club_member,
  current_club_stage_id = EXCLUDED.current_club_stage_id;

-- Club Enrollments
INSERT INTO club_enrollments (id, customer_id, club_stage_id, enrolled_at, expires_at, status, c7_membership_id, qualifying_order_id, created_at, updated_at)
VALUES ('385f9a3a-e7ac-476a-a518-2515c68829e2', '04092822-bbe5-45c7-8a01-d518f47013ac', 'dda54e66-8d3d-4e5a-84b9-c68f2810eeea', '2025-11-05T01:37:31.132+00:00', '2026-02-05T01:37:31.132+00:00', 'active', 'dcdea055-09fa-4ba6-a308-fb1a361f21de', NULL, '2025-11-05T01:37:32.219818+00:00', '2025-11-05T01:37:32.219818+00:00')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  expires_at = EXCLUDED.expires_at;

INSERT INTO club_enrollments (id, customer_id, club_stage_id, enrolled_at, expires_at, status, c7_membership_id, qualifying_order_id, created_at, updated_at)
VALUES ('a7804c84-b466-4e18-a0ad-d7a17c2e20fc', 'c46fa562-9881-4659-9c71-450ce035c889', 'dda54e66-8d3d-4e5a-84b9-c68f2810eeea', '2025-11-05T01:41:29.046+00:00', '2026-02-05T01:41:29.046+00:00', 'active', '41c3e64a-4d11-4960-8d4d-a178bcbb9b7e', NULL, '2025-11-05T01:41:29.705982+00:00', '2025-11-05T01:41:29.705982+00:00')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  expires_at = EXCLUDED.expires_at;

COMMIT;

-- ============================================================
-- Seed data exported successfully
-- ============================================================