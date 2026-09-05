import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../db/schema";
import { runMetricsIngest } from "../server/services/ingest";

config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing from .env.local");
}

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client, { schema });

async function main() {
  console.log("Running metrics ingest...");

  const summary = await runMetricsIngest(db);

  console.log("Ingest summary:");
  console.log(`  processed: ${summary.processed}`);
  console.log(`  created:   ${summary.created}`);
  console.log(`  skipped:   ${summary.skipped}`);
  console.log(`  failed:    ${summary.failed}`);

  if (summary.failures.length > 0) {
    console.log("Failures:");
    for (const failure of summary.failures) {
      console.log(`  - ${failure.submissionId}: ${failure.error}`);
    }
  }

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Ingest failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
