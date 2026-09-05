import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env.local" });

const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("TEST_DATABASE_URL is missing from .env.local");
}

const client = postgres(databaseUrl, {
  max: 1,
});

const db = drizzle(client);

async function main() {
  try {
    console.log("Applying migrations to the test database...");

    await migrate(db, {
      migrationsFolder: "./drizzle",
    });

    console.log("Test database migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Test database migration failed:");
  console.error(error);
  process.exit(1);
});
