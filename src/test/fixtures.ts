import { campaigns, submissionMetrics, submissions, users } from "@/db/schema";
import type { CampaignStatus } from "@/db/schema/enums";
import type { Platform } from "@/shared/post-url";

import { testDb } from "./db";

let counter = 0;

function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createTestUser(role: "admin" | "creator") {
  const [user] = await testDb
    .insert(users)
    .values({ email: `${unique(role)}@test.local`, role })
    .returning();

  return user;
}

export async function createTestCampaign(
  overrides: Partial<{
    title: string;
    platforms: Platform[];
    payoutPer1kViews: number;
    totalBudget: number;
    status: CampaignStatus;
    startsAt: Date;
    endsAt: Date;
  }> = {},
) {
  const now = new Date();

  const [campaign] = await testDb
    .insert(campaigns)
    .values({
      title: overrides.title ?? unique("Campaign"),
      platforms: overrides.platforms ?? ["youtube"],
      payoutPer1kViews: overrides.payoutPer1kViews ?? 500,
      totalBudget: overrides.totalBudget ?? 100_000,
      status: overrides.status ?? "active",
      startsAt: overrides.startsAt ?? new Date(now.getTime() - 86_400_000),
      endsAt: overrides.endsAt ?? new Date(now.getTime() + 30 * 86_400_000),
    })
    .returning();

  return campaign;
}

export async function createTestSubmission(params: {
  campaignId: string;
  creatorId: string;
  platform?: Platform;
  postUrl?: string;
  status?: "pending" | "approved" | "rejected" | "paid";
  payoutCents?: number;
  rejectionReason?: string;
}) {
  const [submission] = await testDb
    .insert(submissions)
    .values({
      campaignId: params.campaignId,
      creatorId: params.creatorId,
      postUrl: params.postUrl ?? `https://youtu.be/${unique("vid")}`,
      platform: params.platform ?? "youtube",
      status: params.status ?? "pending",
      payoutCents: params.payoutCents,
      rejectionReason:
        params.rejectionReason ??
        (params.status === "rejected" ? "Test rejection reason" : undefined),
    })
    .returning();

  return submission;
}

export async function addMetric(
  submissionId: string,
  views: number,
  capturedAt: Date = new Date(),
) {
  const day = new Date(
    Date.UTC(
      capturedAt.getUTCFullYear(),
      capturedAt.getUTCMonth(),
      capturedAt.getUTCDate(),
    ),
  );

  const [metric] = await testDb
    .insert(submissionMetrics)
    .values({
      submissionId,
      capturedAt: day,
      views,
      likes: 0,
      comments: 0,
    })
    .returning();

  return metric;
}
