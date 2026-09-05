import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { campaigns, submissionMetrics, submissions, users } from "@/db/schema";
import { approveSubmission, rejectSubmission } from "@/server/services/approval";
import { calculateEarningsCents } from "@/server/services/payout";
import {
  campaignIdInputSchema,
} from "@/shared/schemas/campaign";
import {
  rejectSubmissionInputSchema,
  submissionIdInputSchema,
  submitClipInputSchema,
} from "@/shared/schemas/submission";
import { detectPlatformFromUrl } from "@/shared/post-url";

import {
  adminProcedure,
  createTRPCRouter,
  creatorProcedure,
} from "../init";

async function latestViewsBySubmissionId(
  db: typeof import("@/db").db,
  submissionIds: string[],
): Promise<Map<string, number>> {
  if (submissionIds.length === 0) {
    return new Map();
  }

  const metrics = await db
    .select({
      submissionId: submissionMetrics.submissionId,
      capturedAt: submissionMetrics.capturedAt,
      views: submissionMetrics.views,
    })
    .from(submissionMetrics)
    .where(inArray(submissionMetrics.submissionId, submissionIds));

  const latestTimeBySubmission = new Map<string, number>();
  const latestViews = new Map<string, number>();

  for (const metric of metrics) {
    const time = metric.capturedAt.getTime();
    const previous = latestTimeBySubmission.get(metric.submissionId);

    if (previous === undefined || time > previous) {
      latestTimeBySubmission.set(metric.submissionId, time);
      latestViews.set(metric.submissionId, metric.views);
    }
  }

  return latestViews;
}

export const submissionsRouter = createTRPCRouter({
  submit: creatorProcedure
    .input(submitClipInputSchema)
    .mutation(async ({ ctx, input }) => {
      const [campaign] = await ctx.db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.campaignId))
        .limit(1);

      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found",
        });
      }

      if (campaign.status !== "active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This campaign isn't accepting submissions right now.",
        });
      }

      const detectedPlatform = detectPlatformFromUrl(input.postUrl);

      if (!detectedPlatform) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "That doesn't look like a real post URL on TikTok, Instagram or YouTube.",
        });
      }

      if (!campaign.platforms.includes(detectedPlatform)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This campaign doesn't accept ${detectedPlatform} submissions.`,
        });
      }

      const [existing] = await ctx.db
        .select({ id: submissions.id })
        .from(submissions)
        .where(
          and(
            eq(submissions.campaignId, input.campaignId),
            eq(submissions.postUrl, input.postUrl),
          ),
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This URL has already been submitted to this campaign.",
        });
      }

      const [submission] = await ctx.db
        .insert(submissions)
        .values({
          campaignId: input.campaignId,
          creatorId: ctx.user.id,
          postUrl: input.postUrl,
          platform: detectedPlatform,
          status: "pending",
        })
        .returning();

      return submission;
    }),

  mine: creatorProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        submission: submissions,
        campaignTitle: campaigns.title,
        payoutPer1kViews: campaigns.payoutPer1kViews,
      })
      .from(submissions)
      .innerJoin(campaigns, eq(submissions.campaignId, campaigns.id))
      .where(eq(submissions.creatorId, ctx.user.id))
      .orderBy(desc(submissions.createdAt));

    const latestViews = await latestViewsBySubmissionId(
      ctx.db,
      rows.map((row) => row.submission.id),
    );

    return rows.map((row) => {
      const views = latestViews.get(row.submission.id) ?? 0;

      const earningsCents =
        row.submission.payoutCents ??
        calculateEarningsCents(views, row.payoutPer1kViews);

      return {
        id: row.submission.id,
        campaignId: row.submission.campaignId,
        campaignTitle: row.campaignTitle,
        postUrl: row.submission.postUrl,
        platform: row.submission.platform,
        status: row.submission.status,
        rejectionReason: row.submission.rejectionReason,
        createdAt: row.submission.createdAt,
        currentViews: views,
        earningsCents,
      };
    });
  }),

  pendingForCampaign: adminProcedure
    .input(campaignIdInputSchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          submission: submissions,
          creatorEmail: users.email,
        })
        .from(submissions)
        .innerJoin(users, eq(submissions.creatorId, users.id))
        .where(
          and(
            eq(submissions.campaignId, input.id),
            eq(submissions.status, "pending"),
          ),
        )
        .orderBy(asc(submissions.createdAt));

      const latestViews = await latestViewsBySubmissionId(
        ctx.db,
        rows.map((row) => row.submission.id),
      );

      return rows.map((row) => ({
        id: row.submission.id,
        postUrl: row.submission.postUrl,
        platform: row.submission.platform,
        creatorEmail: row.creatorEmail,
        createdAt: row.submission.createdAt,
        currentViews: latestViews.get(row.submission.id) ?? 0,
      }));
    }),

  approve: adminProcedure
    .input(submissionIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      return approveSubmission(ctx.db, { submissionId: input.submissionId });
    }),

  reject: adminProcedure
    .input(rejectSubmissionInputSchema)
    .mutation(async ({ ctx, input }) => {
      return rejectSubmission(ctx.db, {
        submissionId: input.submissionId,
        reason: input.reason,
      });
    }),
});
