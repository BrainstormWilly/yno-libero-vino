/**
 * LiberoVino Seed Data
 * 
 * Seeds the database with a test client for local development
 * Uses "yno-fanbase" C7 dev account
 */

import { createSeedClient } from "@snaplet/seed";

const seed = await createSeedClient({
  // dryRun: true // Uncomment to test without actually seeding
});

// Reset database to clean state
await seed.$resetDatabase();

// Seed the yno-fanbase client for development
await seed.clients([
  {
    id: "a7f5c3e2-8d91-4b1e-9a2f-1c5b8e3d4f6a", // Valid UUID
    tenant_shop: "yno-fanbase",
    crm_type: "commerce7",
    org_name: "Yno Fanbase",
    org_contact: "William Langley",
    user_email: "will@ynosoftware.com",
    setup_complete: false, // Allow testing setup wizard
  },
]);

console.log("✅ Seeded LiberoVino database with yno-fanbase client");
console.log("\n📝 Use these credentials for IN_COMMERCE7=no mode:");
console.log("   tenant_shop: yno-fanbase");
console.log("   client_id: a7f5c3e2-8d91-4b1e-9a2f-1c5b8e3d4f6a");

process.exit(0);

