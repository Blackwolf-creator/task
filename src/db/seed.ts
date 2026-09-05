import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  campaigns,
  submissionMetrics,
  submissions,
  users,
} from "./schema";

config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing from .env.local");
}

const client = postgres(databaseUrl, {
  max: 1,
});

const db = drizzle(client);

const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  creatorAlice: "00000000-0000-4000-8000-000000000002",
  creatorBob: "00000000-0000-4000-8000-000000000003",

  gamingCampaign: "10000000-0000-4000-8000-000000000001",
  fashionCampaign: "10000000-0000-4000-8000-000000000002",
  completedCampaign: "10000000-0000-4000-8000-000000000003",

  submissionPending: "20000000-0000-4000-8000-000000000001",
  submissionApproved: "20000000-0000-4000-8000-000000000002",
  submissionRejected: "20000000-0000-4000-8000-000000000003",

  metricApprovedYesterday: "30000000-0000-4000-8000-000000000001",
  metricApprovedToday: "30000000-0000-4000-8000-000000000002",
} as const;

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  );
}

async function main() {
  const now = new Date();
  const today = startOfUtcDay(now);
  const yesterday = addDays(today, -1);

  console.log("Seeding database...");

  const userRows: (typeof users.$inferInsert)[] = [
    {
      id: ids.admin,
      email: "admin@example.com",
      role: "admin",
    },
    {
      id: ids.creatorAlice,
      email: "alice@example.com",
      role: "creator",
    },
    {
      id: ids.creatorBob,
      email: "bob@example.com",
      role: "creator",
    },
  ];

  await db
    .insert(users)
    .values(userRows)
    .onConflictDoNothing();

  const campaignRows: (typeof campaigns.$inferInsert)[] = [
    {
      id: ids.gamingCampaign,
      title: "Gaming Creator Clips",
      platforms: ["tiktok", "youtube"],
      payoutPer1kViews: 500,
      totalBudget: 50_000,
      status: "active",
      startsAt: addDays(now, -3),
      endsAt: addDays(now, 21),
    },
    {
      id: ids.fashionCampaign,
      title: "Fashion Reels Campaign",
      platforms: ["instagram", "tiktok"],
      payoutPer1kViews: 800,
      totalBudget: 100_000,
      status: "active",
      startsAt: addDays(now, -1),
      endsAt: addDays(now, 30),
    },
    {
      id: ids.completedCampaign,
      title: "Summer YouTube Campaign",
      platforms: ["youtube"],
      payoutPer1kViews: 600,
      totalBudget: 25_000,
      status: "completed",
      startsAt: addDays(now, -40),
      endsAt: addDays(now, -10),
    },
  ];

  await db
    .insert(campaigns)
    .values(campaignRows)
    .onConflictDoNothing();

  const submissionRows: (typeof submissions.$inferInsert)[] = [
    {
      id: ids.submissionPending,
      campaignId: ids.gamingCampaign,
      creatorId: ids.creatorAlice,
      postUrl: "https://www.tiktok.com/@alice/video/1234567890",
      platform: "tiktok",
      status: "pending",
    },
    {
      id: ids.submissionApproved,
      campaignId: ids.gamingCampaign,
      creatorId: ids.creatorBob,
      postUrl: "https://www.youtube.com/shorts/example123",
      platform: "youtube",
      status: "approved",
    },
    {
      id: ids.submissionRejected,
      campaignId: ids.fashionCampaign,
      creatorId: ids.creatorAlice,
      postUrl: "https://www.instagram.com/reel/example123/",
      platform: "instagram",
      status: "rejected",
      rejectionReason: "The post does not match the campaign requirements.",
    },
  ];

  await db
    .insert(submissions)
    .values(submissionRows)
    .onConflictDoNothing();

  const metricRows: (typeof submissionMetrics.$inferInsert)[] = [
    {
      id: ids.metricApprovedYesterday,
      submissionId: ids.submissionApproved,
      capturedAt: yesterday,
      views: 8_500,
      likes: 720,
      comments: 41,
    },
    {
      id: ids.metricApprovedToday,
      submissionId: ids.submissionApproved,
      capturedAt: today,
      views: 12_850,
      likes: 1_050,
      comments: 67,
    },
  ];

  await db
    .insert(submissionMetrics)
    .values(metricRows)
    .onConflictDoNothing();

  console.log("Database seeded successfully.");
}

main()
  .catch((error) => {
    console.error("Database seed failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });