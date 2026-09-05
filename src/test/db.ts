import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

config({ path: ".env.local" });

// Deliberately separate from DATABASE_URL: integration tests create and
// mutate real rows, and must never run against the dev/seed database.
const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is missing from .env.local. Integration tests need their own Postgres database — see NOTES.md.",
  );
}

const client = postgres(databaseUrl, { max: 5 });

export const testDb = drizzle(client, { schema });

export async function closeTestDb() {
  await client.end();
}
