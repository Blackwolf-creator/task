import { TRPCError } from "@trpc/server";
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  sql,
} from "drizzle-orm";

import { campaigns, submissionMetrics, submissions } from "@/db/schema";
import {
  campaignIdInputSchema,
  campaignListInputSchema,
  createCampaignInputSchema,
  updateCampaignInputSchema,
} from "@/shared/schemas/campaign";

import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "../init";

function utcDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildDailyDateRange(start: Date, end: Date): string[] {
  const days: string[] = [];
  const cursor = utcDateOnly(start);
  const last = utcDateOnly(end);

  while (cursor.getTime() <= last.getTime()) {
    days.push(toDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

export const campaignsRouter = createTRPCRouter({
  list: adminProcedure
    .input(campaignListInputSchema)
    .query(async ({ ctx, input }) => {
      const conditions = [
        input.search
          ? ilike(campaigns.title, `%${input.search}%`)
          : undefined,
        input.status ? eq(campaigns.status, input.status) : undefined,
      ].filter((condition) => condition !== undefined);

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const [{ total }] = await ctx.db
        .select({ total: count() })
        .from(campaigns)
        .where(whereClause);

      const items = await ctx.db
        .select()
        .from(campaigns)
        .where(whereClause)
        .orderBy(desc(campaigns.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      return {
        items,
        total,
        page: input.page,
        pageSize: input.pageSize,
        pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),

  listActive: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(campaigns)
      .where(eq(campaigns.status, "active"))
      .orderBy(desc(campaigns.startsAt))
      .limit(50);
  }),

  getById: adminProcedure
    .input(campaignIdInputSchema)
    .query(async ({ ctx, input }) => {
      const [campaign] = await ctx.db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.id))
        .limit(1);

      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found",
        });
      }

      const approvedSubmissions = await ctx.db
        .select({
          id: submissions.id,
          payoutCents: submissions.payoutCents,
        })
        .from(submissions)
        .where(
          and(
            eq(submissions.campaignId, campaign.id),
            inArray(submissions.status, ["approved", "paid"]),
          ),
        );

      const budgetSpent = approvedSubmissions.reduce(
        (sum, submission) => sum + (submission.payoutCents ?? 0),
        0,
      );

      let totalApprovedViews = 0;

      if (approvedSubmissions.length > 0) {
        const metrics = await ctx.db
          .select({
            submissionId: submissionMetrics.submissionId,
            capturedAt: submissionMetrics.capturedAt,
            views: submissionMetrics.views,
          })
          .from(submissionMetrics)
          .where(
            inArray(
              submissionMetrics.submissionId,
              approvedSubmissions.map((submission) => submission.id),
            ),
          );

        const latestViewsBySubmission = new Map<string, number>();
        const latestDateBySubmission = new Map<string, number>();

        for (const metric of metrics) {
          const capturedTime = metric.capturedAt.getTime();
          const previousTime = latestDateBySubmission.get(
            metric.submissionId,
          );

          if (previousTime === undefined || capturedTime > previousTime) {
            latestDateBySubmission.set(metric.submissionId, capturedTime);
            latestViewsBySubmission.set(metric.submissionId, metric.views);
          }
        }

        totalApprovedViews = [...latestViewsBySubmission.values()].reduce(
          (sum, views) => sum + views,
          0,
        );
      }

      return {
        campaign,
        budgetSpent,
        budgetLeft: campaign.totalBudget - budgetSpent,
        totalApprovedViews,
      };
    }),

  dailyViews: adminProcedure
    .input(campaignIdInputSchema)
    .query(async ({ ctx, input }) => {
      const [campaign] = await ctx.db
        .select({
          startsAt: campaigns.startsAt,
          endsAt: campaigns.endsAt,
        })
        .from(campaigns)
        .where(eq(campaigns.id, input.id))
        .limit(1);

      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found",
        });
      }

      const approvedSubmissionIds = await ctx.db
        .select({ id: submissions.id })
        .from(submissions)
        .where(
          and(
            eq(submissions.campaignId, input.id),
            inArray(submissions.status, ["approved", "paid"]),
          ),
        );

      const days = buildDailyDateRange(campaign.startsAt, campaign.endsAt);
      const viewsByDay = new Map<string, number>(
        days.map((day) => [day, 0]),
      );

      if (approvedSubmissionIds.length > 0) {
        const dailyTotals = await ctx.db
          .select({
            capturedAt: submissionMetrics.capturedAt,
            views: sql<number>`sum(${submissionMetrics.views})`,
          })
          .from(submissionMetrics)
          .where(
            and(
              inArray(
                submissionMetrics.submissionId,
                approvedSubmissionIds.map((submission) => submission.id),
              ),
              gte(
                submissionMetrics.capturedAt,
                new Date(`${days[0]}T00:00:00.000Z`),
              ),
              lte(
                submissionMetrics.capturedAt,
                new Date(`${days[days.length - 1]}T00:00:00.000Z`),
              ),
            ),
          )
          .groupBy(submissionMetrics.capturedAt);

        for (const row of dailyTotals) {
          const key = toDateKey(row.capturedAt);

          if (viewsByDay.has(key)) {
            viewsByDay.set(key, Number(row.views));
          }
        }
      }

      return days.map((day) => ({
        date: day,
        views: viewsByDay.get(day) ?? 0,
      }));
    }),

  create: adminProcedure
    .input(createCampaignInputSchema)
    .mutation(async ({ ctx, input }) => {
      const [campaign] = await ctx.db
        .insert(campaigns)
        .values({
          title: input.title,
          platforms: input.platforms,
          payoutPer1kViews: input.payoutPer1kViews,
          totalBudget: input.totalBudget,
          status: input.status,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        })
        .returning();

      return campaign;
    }),

  update: adminProcedure
    .input(updateCampaignInputSchema)
    .mutation(async ({ ctx, input }) => {
      const [campaign] = await ctx.db
        .update(campaigns)
        .set({
          title: input.title,
          platforms: input.platforms,
          payoutPer1kViews: input.payoutPer1kViews,
          totalBudget: input.totalBudget,
          status: input.status,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, input.id))
        .returning();

      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found",
        });
      }

      return campaign;
    }),
});
