import { desc, eq, inArray } from "drizzle-orm";

import type { db as Database } from "@/db";
import { submissionMetrics, submissions } from "@/db/schema";

export type IngestSummary = {
  processed: number;
  created: number;
  skipped: number;
  failed: number;
  failures: { submissionId: string; error: string }[];
};

export function utcToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Fakes one day of metrics sync for every approved (or paid) submission:
 * one submission_metric row per submission per day, views/likes/comments
 * only ever go up from the previous captured value, running it twice for
 * the same day is a no-op, and one submission blowing up mid-run doesn't
 * stop the rest — it's reported in the summary instead.
 */
export async function runMetricsIngest(
  db: typeof Database,
  referenceDate: Date = utcToday(),
): Promise<IngestSummary> {
  const summary: IngestSummary = {
    processed: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    failures: [],
  };

  const approvedSubmissions = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(inArray(submissions.status, ["approved", "paid"]));

  for (const submission of approvedSubmissions) {
    summary.processed += 1;

    try {
      const [latest] = await db
        .select()
        .from(submissionMetrics)
        .where(eq(submissionMetrics.submissionId, submission.id))
        .orderBy(desc(submissionMetrics.capturedAt))
        .limit(1);

      if (latest && latest.capturedAt.getTime() === referenceDate.getTime()) {
        summary.skipped += 1;
        continue;
      }

      const baselineViews = latest?.views ?? 0;
      const baselineLikes = latest?.likes ?? 0;
      const baselineComments = latest?.comments ?? 0;

      const nextViews = baselineViews + randomBetween(50, 5_000);
      const nextLikes =
        baselineLikes + randomBetween(0, Math.floor(nextViews * 0.1));
      const nextComments =
        baselineComments + randomBetween(0, Math.floor(nextViews * 0.02));

      await db.insert(submissionMetrics).values({
        submissionId: submission.id,
        capturedAt: referenceDate,
        views: nextViews,
        likes: nextLikes,
        comments: nextComments,
      });

      summary.created += 1;
    } catch (error) {
      // Postgres unique_violation on (submission_id, captured_at): a
      // concurrent/duplicate run for the same day. Idempotent, not a failure.
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "23505"
      ) {
        summary.skipped += 1;
        continue;
      }

      summary.failed += 1;
      summary.failures.push({
        submissionId: submission.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return summary;
}
