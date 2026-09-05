import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { campaigns, submissions } from "@/db/schema";
import { closeTestDb, testDb } from "@/test/db";
import {
  addMetric,
  createTestCampaign,
  createTestSubmission,
  createTestUser,
} from "@/test/fixtures";

import { approveSubmission, rejectSubmission } from "./approval";

afterAll(async () => {
  await closeTestDb();
});

describe("approveSubmission", () => {
  it("approves a pending submission and locks in the payout", async () => {
    const creator = await createTestUser("creator");
    const campaign = await createTestCampaign({
      payoutPer1kViews: 500,
      totalBudget: 100_000,
    });
    const submission = await createTestSubmission({
      campaignId: campaign.id,
      creatorId: creator.id,
    });
    await addMetric(submission.id, 2_000);

    const result = await approveSubmission(testDb, {
      submissionId: submission.id,
    });

    expect(result.payoutCents).toBe(1_000);

    const [updated] = await testDb
      .select()
      .from(submissions)
      .where(eq(submissions.id, submission.id));

    expect(updated.status).toBe("approved");
    expect(updated.payoutCents).toBe(1_000);
  });

  it("fails with a typed error when the payout would exceed the remaining budget", async () => {
    const creator = await createTestUser("creator");
    const campaign = await createTestCampaign({
      payoutPer1kViews: 500,
      totalBudget: 900, // less than the 1,000 cent payout below
    });
    const submission = await createTestSubmission({
      campaignId: campaign.id,
      creatorId: creator.id,
    });
    await addMetric(submission.id, 2_000);

    await expect(
      approveSubmission(testDb, { submissionId: submission.id }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    const [unchanged] = await testDb
      .select()
      .from(submissions)
      .where(eq(submissions.id, submission.id));

    expect(unchanged.status).toBe("pending");
    expect(unchanged.payoutCents).toBeNull();
  });

  it("marks the campaign completed once the remaining budget hits zero", async () => {
    const creator = await createTestUser("creator");
    const campaign = await createTestCampaign({
      payoutPer1kViews: 500,
      totalBudget: 1_000,
    });
    const submission = await createTestSubmission({
      campaignId: campaign.id,
      creatorId: creator.id,
    });
    await addMetric(submission.id, 2_000);

    await approveSubmission(testDb, { submissionId: submission.id });

    const [updatedCampaign] = await testDb
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaign.id));

    expect(updatedCampaign.status).toBe("completed");
  });

  it("rejects approving a submission that isn't pending", async () => {
    const creator = await createTestUser("creator");
    const campaign = await createTestCampaign();
    const submission = await createTestSubmission({
      campaignId: campaign.id,
      creatorId: creator.id,
      status: "rejected",
    });

    await expect(
      approveSubmission(testDb, { submissionId: submission.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it(
    "only lets one of two concurrent approvals through when the budget " +
      "covers just one of them",
    async () => {
      const creator = await createTestUser("creator");
      // Budget covers exactly one 1,000 cent payout, not both.
      const campaign = await createTestCampaign({
        payoutPer1kViews: 500,
        totalBudget: 1_000,
      });

      const submissionA = await createTestSubmission({
        campaignId: campaign.id,
        creatorId: creator.id,
      });
      const submissionB = await createTestSubmission({
        campaignId: campaign.id,
        creatorId: creator.id,
      });
      await addMetric(submissionA.id, 2_000);
      await addMetric(submissionB.id, 2_000);

      const results = await Promise.allSettled([
        approveSubmission(testDb, { submissionId: submissionA.id }),
        approveSubmission(testDb, { submissionId: submissionB.id }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const approvedRows = await testDb
        .select()
        .from(submissions)
        .where(eq(submissions.campaignId, campaign.id));

      const approved = approvedRows.filter((row) => row.status === "approved");
      expect(approved).toHaveLength(1);

      const spent = approvedRows.reduce(
        (sum, row) => sum + (row.payoutCents ?? 0),
        0,
      );
      expect(spent).toBeLessThanOrEqual(campaign.totalBudget);
    },
  );
});

describe("rejectSubmission", () => {
  it("rejects a pending submission with a reason", async () => {
    const creator = await createTestUser("creator");
    const campaign = await createTestCampaign();
    const submission = await createTestSubmission({
      campaignId: campaign.id,
      creatorId: creator.id,
    });

    const updated = await rejectSubmission(testDb, {
      submissionId: submission.id,
      reason: "Doesn't meet campaign guidelines",
    });

    expect(updated.status).toBe("rejected");
    expect(updated.rejectionReason).toBe(
      "Doesn't meet campaign guidelines",
    );
  });

  it("refuses to reject a submission that isn't pending", async () => {
    const creator = await createTestUser("creator");
    const campaign = await createTestCampaign();
    const submission = await createTestSubmission({
      campaignId: campaign.id,
      creatorId: creator.id,
      status: "approved",
      payoutCents: 0,
    });

    await expect(
      rejectSubmission(testDb, {
        submissionId: submission.id,
        reason: "too late",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
