import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { db as Database } from "@/db";
import {
  campaigns,
  submissionMetrics,
  submissions,
} from "@/db/schema";

import { calculateEarningsCents } from "./payout";

/**
 * Approves a pending submission against its campaign's remaining budget.
 *
 * Concurrency: two admins approving different submissions on the same
 * campaign at the same instant must never both succeed if the budget only
 * covers one of them. We rely on Postgres row locking rather than an
 * application-level "if remaining >= payout" check (which is a
 * check-then-act race under concurrent transactions).
 *
 * Both the submission row and the campaign row are locked with
 * `SELECT ... FOR UPDATE` inside the same transaction. Locking the campaign
 * row is what actually serializes concurrent approvals: a second concurrent
 * transaction approving a different pending submission on the *same*
 * campaign blocks on the campaign row lock until the first transaction
 * commits (or rolls back), at which point it re-reads the up-to-date spent
 * total and budget before deciding. Approvals on different campaigns never
 * contend with each other.
 */
export async function approveSubmission(
  db: typeof Database,
  params: { submissionId: string },
) {
  return db.transaction(async (tx) => {
    const [submission] = await tx
      .select()
      .from(submissions)
      .where(eq(submissions.id, params.submissionId))
      .for("update")
      .limit(1);

    if (!submission) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Submission not found",
      });
    }

    if (submission.status !== "pending") {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Submission is already ${submission.status}, it can't be approved again.`,
      });
    }

    const [campaign] = await tx
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, submission.campaignId))
      .for("update")
      .limit(1);

    if (!campaign) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Campaign not found",
      });
    }

    const [latestMetric] = await tx
      .select({ views: submissionMetrics.views })
      .from(submissionMetrics)
      .where(eq(submissionMetrics.submissionId, submission.id))
      .orderBy(desc(submissionMetrics.capturedAt))
      .limit(1);

    const views = latestMetric?.views ?? 0;
    const payoutCents = calculateEarningsCents(
      views,
      campaign.payoutPer1kViews,
    );

    const [{ spentCents }] = await tx
      .select({
        spentCents: sql<number>`coalesce(sum(${submissions.payoutCents}), 0)`,
      })
      .from(submissions)
      .where(
        and(
          eq(submissions.campaignId, campaign.id),
          inArray(submissions.status, ["approved", "paid"]),
        ),
      );

    const remainingBudget = campaign.totalBudget - Number(spentCents);

    if (payoutCents > remainingBudget) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Approving this submission would exceed the campaign budget (remaining ${remainingBudget} cents, payout ${payoutCents} cents).`,
      });
    }

    await tx
      .update(submissions)
      .set({
        status: "approved",
        payoutCents,
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, submission.id));

    const newRemainingBudget = remainingBudget - payoutCents;

    if (newRemainingBudget <= 0 && campaign.status !== "completed") {
      await tx
        .update(campaigns)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(campaigns.id, campaign.id));
    }

    return {
      submissionId: submission.id,
      payoutCents,
      remainingBudget: newRemainingBudget,
    };
  });
}

export async function rejectSubmission(
  db: typeof Database,
  params: { submissionId: string; reason: string },
) {
  return db.transaction(async (tx) => {
    const [submission] = await tx
      .select()
      .from(submissions)
      .where(eq(submissions.id, params.submissionId))
      .for("update")
      .limit(1);

    if (!submission) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Submission not found",
      });
    }

    if (submission.status !== "pending") {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Submission is already ${submission.status}, it can't be rejected.`,
      });
    }

    const [updated] = await tx
      .update(submissions)
      .set({
        status: "rejected",
        rejectionReason: params.reason,
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, submission.id))
      .returning();

    return updated;
  });
}
