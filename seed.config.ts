import { SeedPostgres } from "@snaplet/seed/adapter-postgres";
import { defineConfig } from "@snaplet/seed/config";
import postgres from "postgres";

export default defineConfig({
  adapter: () => {
    // Use local Supabase by default, or SUPABASE_DB_URL if set
    const dbUrl = process.env.SUPABASE_DB_URL || "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
    const client = postgres(dbUrl);
    return new SeedPostgres(client);
  },
  select: [
    // We don't alter any extensions tables that might be owned by extensions
    "!*",
    // We want to alter all the tables under public schema
    "public*",
  ]
});

