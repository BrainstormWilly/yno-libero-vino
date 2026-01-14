/**
 * LiberoVino Seed Data
 * 
 * Seeds the database with a test client for local development
 * Uses "yno-fanbase" C7 dev account
 * Includes enrollment_history data for testing ROI charts
 */

import { createSeedClient } from "@snaplet/seed";
import postgres from "postgres";

const seed = await createSeedClient({
  // dryRun: true // Uncomment to test without actually seeding
});

// Reset database to clean state
await seed.$resetDatabase();

const clientId = "a7f5c3e2-8d91-4b1e-9a2f-1c5b8e3d4f6a";

// Seed the yno-fanbase client for development
await seed.clients([
  {
    id: clientId,
    tenant_shop: "yno-fanbase",
    crm_type: "commerce7",
    org_name: "Yno Fanbase",
    org_contact: "William Langley",
    user_email: "will@ynosoftware.com",
    setup_complete: true, // Set to true to see charts
  },
]);

console.log("✅ Seeded client");

// Helper function to generate random date in range
function generateRandomDateInRange(startDate: Date, endDate: Date): Date {
  const start = startDate.getTime();
  const end = endDate.getTime();
  const randomTime = start + Math.random() * (end - start);
  return new Date(randomTime);
}

// Helper function to subtract days from a date
function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

// Seed Club Program
await seed.club_programs([
  {
    client_id: clientId,
    name: "LiberoVino Wine Club",
    description: "Test club program for development",
    is_active: true,
  },
]);

const clubProgram = seed.$store.club_programs[0];

if (!clubProgram?.id) {
  throw new Error("Failed to get club program ID from seed store");
}

console.log("✅ Seeded club program");

// Seed Club Stages (3 tiers: Bronze, Silver, Gold)
// Use direct postgres connection (same as Snaplet) to avoid Supabase auth issues
const dbUrl = process.env.SUPABASE_DB_URL || "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const sql = postgres(dbUrl);
const clubProgramId = clubProgram.id; // TypeScript now knows this is defined

const stagesData = [
  {
    club_program_id: clubProgramId,
    name: "Bronze",
    duration_months: 12,
    min_purchase_amount: 100.0,
    stage_order: 1,
    is_active: true,
    upgradable: true,
    tier_type: "discount",
  },
  {
    club_program_id: clubProgramId,
    name: "Silver",
    duration_months: 12,
    min_purchase_amount: 250.0,
    stage_order: 2,
    is_active: true,
    upgradable: true,
    tier_type: "discount",
  },
  {
    club_program_id: clubProgramId,
    name: "Gold",
    duration_months: 12,
    min_purchase_amount: 500.0,
    stage_order: 3,
    is_active: true,
    upgradable: true,
    tier_type: "discount",
  },
] as const;

const stages = await sql`
  INSERT INTO club_stages ${sql(stagesData)}
  RETURNING *
`;

if (!stages || stages.length !== 3) {
  throw new Error(`Failed to seed club stages: Expected 3 stages, got ${stages?.length || 0}`);
}

const bronzeStage = stages[0];
const silverStage = stages[1];
const goldStage = stages[2];

console.log("✅ Seeded club stages (Bronze, Silver, Gold)");

// Seed Customers (25 customers)
const customerData = Array.from({ length: 25 }, (_, i) => ({
  client_id: clientId,
  email: `customer${i + 1}@test.com`,
  first_name: `Customer${i + 1}`,
  last_name: "Test",
  is_club_member: false,
}));

await seed.customers(customerData);
const customers = seed.$store.customers.slice(-25); // Get last 25 customers

console.log(`✅ Seeded ${customers.length} customers`);

// Seed Club Enrollments (one per customer, starting at Bronze tier)
const now = new Date();
const enrollments = [];

for (const customer of customers) {
  // Enrolled 60-90 days ago, expires 30-60 days from now
  const enrolledAt = subDays(now, 60 + Math.floor(Math.random() * 30));
  const expiresAt = new Date(enrolledAt);
  expiresAt.setMonth(expiresAt.getMonth() + 12); // 12 month duration
  
  await seed.club_enrollments([
    {
      customer_id: customer.id,
      club_stage_id: bronzeStage.id,
      enrolled_at: enrolledAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: "active",
    },
  ]);
  
  const enrollment = seed.$store.club_enrollments[seed.$store.club_enrollments.length - 1];
  enrollments.push({ enrollment, customer, currentStage: bronzeStage });
}

console.log(`✅ Seeded ${enrollments.length} club enrollments`);

// Seed Enrollment History (upgrades and extensions)
const historyRecords: any[] = [];

// Date range: last 30 days
const endDate = new Date();
const startDate = subDays(endDate, 30);

// Distribute upgrades across customers
// ~40% with 1 upgrade, ~30% with 2 upgrades, ~30% with 3+ upgrades
const upgradeDistribution = [
  ...Array(10).fill(1),  // 10 customers with 1 upgrade
  ...Array(8).fill(2),  // 8 customers with 2 upgrades
  ...Array(7).fill(3),  // 7 customers with 3+ upgrades
];

let customerIndex = 0;

for (let i = 0; i < upgradeDistribution.length && customerIndex < enrollments.length; i++) {
  const numUpgrades = upgradeDistribution[i];
  const { enrollment, customer, currentStage } = enrollments[customerIndex];
  customerIndex++;
  
  let currentStageId = bronzeStage.id;
  let currentExpiresAt = new Date(enrollment.expires_at);
  
  // Generate upgrade dates first, then sort them chronologically
  const upgradeDates: Date[] = [];
  for (let j = 0; j < numUpgrades; j++) {
    upgradeDates.push(generateRandomDateInRange(startDate, endDate));
  }
  upgradeDates.sort((a, b) => a.getTime() - b.getTime());
  
  // Create upgrade history records in chronological order
  for (let upgradeNum = 0; upgradeNum < numUpgrades && upgradeNum < upgradeDates.length; upgradeNum++) {
    const upgradeDate = upgradeDates[upgradeNum];
    const oldStageId = currentStageId;
    let newStageId: string;
    let oldExpiresAt = new Date(currentExpiresAt);
    
    if (currentStageId === bronzeStage.id) {
      // Upgrade from Bronze to Silver
      newStageId = silverStage.id;
      currentStageId = silverStage.id;
    } else if (currentStageId === silverStage.id) {
      // Upgrade from Silver to Gold
      newStageId = goldStage.id;
      currentStageId = goldStage.id;
    } else {
      // Already at Gold, skip further upgrades
      break;
    }
    
    // Extend expiration by 30-90 days when upgrading
    const extensionDays = 30 + Math.floor(Math.random() * 60);
    currentExpiresAt = new Date(currentExpiresAt);
    currentExpiresAt.setDate(currentExpiresAt.getDate() + extensionDays);
    
    historyRecords.push({
      enrollment_id: enrollment.id,
      customer_id: customer.id,
      client_id: clientId,
      change_type: "upgrade",
      old_club_stage_id: oldStageId,
      new_club_stage_id: newStageId,
      old_expires_at: oldExpiresAt.toISOString(),
      new_expires_at: currentExpiresAt.toISOString(),
      old_status: "active",
      new_status: "active",
      changed_at: upgradeDate.toISOString(),
      metadata: {
        source: "seed",
        upgrade_number: upgradeNum + 1,
      },
    });
  }
}

// Create extension records (20-30 extensions)
const numExtensions = 25;
for (let i = 0; i < numExtensions && i < enrollments.length; i++) {
  const { enrollment, customer } = enrollments[i];
  const extensionDate = generateRandomDateInRange(startDate, endDate);
  
  const oldExpiresAt = new Date(enrollment.expires_at);
  const newExpiresAt = new Date(oldExpiresAt);
  // Extend by 30-90 days
  const extensionDays = 30 + Math.floor(Math.random() * 60);
  newExpiresAt.setDate(newExpiresAt.getDate() + extensionDays);
  
  historyRecords.push({
    enrollment_id: enrollment.id,
    customer_id: customer.id,
    client_id: clientId,
    change_type: "extension",
    old_club_stage_id: enrollment.club_stage_id,
    new_club_stage_id: enrollment.club_stage_id,
    old_expires_at: oldExpiresAt.toISOString(),
    new_expires_at: newExpiresAt.toISOString(),
    old_status: "active",
    new_status: "active",
    changed_at: extensionDate.toISOString(),
    metadata: {
      source: "seed",
      extension_days: extensionDays,
    },
  });
}

// Insert enrollment history records in batches
const batchSize = 20;
for (let i = 0; i < historyRecords.length; i += batchSize) {
  const batch = historyRecords.slice(i, i + batchSize);
  try {
    await sql`INSERT INTO enrollment_history ${sql(batch)}`;
  } catch (error) {
    console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
    throw error;
  }
}

console.log(`✅ Seeded ${historyRecords.length} enrollment_history records`);
console.log(`   - Upgrades: ${historyRecords.filter(r => r.change_type === 'upgrade').length}`);
console.log(`   - Extensions: ${historyRecords.filter(r => r.change_type === 'extension').length}`);

console.log("\n✅ Seeded LiberoVino database with yno-fanbase client and test data");
console.log("\n📝 Use these credentials for IN_COMMERCE7=no mode:");
console.log("   tenant_shop: yno-fanbase");
console.log("   client_id: a7f5c3e2-8d91-4b1e-9a2f-1c5b8e3d4f6a");
console.log("\n📊 Dashboard charts should now display test data!");

// Close postgres connection
await sql.end();

process.exit(0);

