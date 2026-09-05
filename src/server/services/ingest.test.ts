import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

import { submissionMetrics } from "@/db/schema";
import { closeTestDb, testDb } from "@/test/db";
import {
  addMetric,
  createTestCampaign,
  createTestSubmission,
  createTestUser,
} from "@/test/fixtures";

import { runMetricsIngest, utcToday } from "./ingest";

afterAll(async () => {
  await closeTestDb();
});

describe("runMetricsIngest", () => {
  it("creates one metric row per approved submission for the day", async () => {
    const creator = await createTestUser("creator");
    const campaign = await createTestCampaign();
    const submission = await createTestSubmission({
      campaignId: campaign.id,
      creatorId: creator.id,
      status: "approved",
      payoutCents: 0,
    });

    const summary = await runMetricsIngest(testDb);

    expect(summary.processed).toBeGreaterThanOrEqual(1);
    expect(summary.failed).toBe(0);

    const rows = await testDb
      .select()
      .from(submissionMetrics)
      .where(
        and(
          eq(submissionMetrics.submissionId, submission.id),
          eq(submissionMetrics.capturedAt, utcToday()),
        ),
      );

    expect(rows).toHaveLength(1);
    expect(rows[0].views).toBeGreaterThan(0);
  });

  it("running it twice for the same day leaves the data unchanged", async () => {
    const creator = await createTestUser("creator");
    const campaign = await createTestCampaign();
    const submission = await createTestSubmission({
      campaignId: campaign.id,
      creatorId: creator.id,
      status: "approved",
      payoutCents: 0,
    });

    await runMetricsIngest(testDb);

    const [firstRun] = await testDb
      .select()
      .from(submissionMetrics)
      .where(eq(submissionMetrics.submissionId, submission.id));

    const secondSummary = await runMetricsIngest(testDb);

    const rowsAfterSecondRun = await testDb
      .select()
      .from(submissionMetrics)
      .where(eq(submissionMetrics.submissionId, submission.id));

    expect(rowsAfterSecondRun).toHaveLength(1);
    expect(rowsAfterSecondRun[0].views).toBe(firstRun.views);
    expect(rowsAfterSecondRun[0].likes).toBe(firstRun.likes);
    expect(rowsAfterSecondRun[0].comments).toBe(firstRun.comments);

    const thisSubmissionSkipped = secondSummary.skipped >= 1;
    expect(thisSubmissionSkipped).toBe(true);
  });

  it("views only ever go up compared to the previous day", async () => {
    const creator = await createTestUser("creator");
    const campaign = await createTestCampaign();
    const submission = await createTestSubmission({
      campaignId: campaign.id,
      creatorId: creator.id,
      status: "approved",
      payoutCents: 0,
    });

    const yesterday = new Date(utcToday().getTime() - 86_400_000);
    await addMetric(submission.id, 10_000, yesterday);

    await runMetricsIngest(testDb);

    const [todayRow] = await testDb
      .select()
      .from(submissionMetrics)
      .where(
        and(
          eq(submissionMetrics.submissionId, submission.id),
          eq(submissionMetrics.capturedAt, utcToday()),
        ),
      );

    expect(todayRow.views).toBeGreaterThan(10_000);
  });

  it("keeps processing remaining submissions when one blows up, and reports it", async () => {
    const creator = await createTestUser("creator");
    const campaign = await createTestCampaign();

    const badSubmission = await createTestSubmission({
      campaignId: campaign.id,
      creatorId: creator.id,
      status: "approved",
      payoutCents: 0,
    });
    const goodSubmission = await createTestSubmission({
      campaignId: campaign.id,
      creatorId: creator.id,
      status: "approved",
      payoutCents: 0,
    });

    const originalInsert = testDb.insert.bind(testDb);
    const insertSpy = vi
      .spyOn(testDb, "insert")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((table: any) => {
        const builder = originalInsert(table);
        const originalValues = builder.values.bind(builder);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        builder.values = ((row: any) => {
          if (row.submissionId === badSubmission.id) {
            return Promise.reject(new Error("simulated ingest failure"));
          }

          return originalValues(row);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any;

        return builder;
      });

    const summary = await runMetricsIngest(testDb);

    insertSpy.mockRestore();

    expect(summary.failed).toBe(1);
    expect(summary.failures.map((f) => f.submissionId)).toContain(
      badSubmission.id,
    );

    const goodRows = await testDb
      .select()
      .from(submissionMetrics)
      .where(eq(submissionMetrics.submissionId, goodSubmission.id));
    expect(goodRows).toHaveLength(1);

    const badRows = await testDb
      .select()
      .from(submissionMetrics)
      .where(eq(submissionMetrics.submissionId, badSubmission.id));
    expect(badRows).toHaveLength(0);
  });
});
