import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { campaigns } from "./campaigns";
import {
  platformEnum,
  submissionStatusEnum,
} from "./enums";
import { users } from "./users";

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, {
        onDelete: "cascade",
      }),

    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
      }),

    postUrl: text("post_url").notNull(),

    platform: platformEnum("platform")
      .notNull(),

    status: submissionStatusEnum("status")
      .default("pending")
      .notNull(),

    rejectionReason: text("rejection_reason"),

    payoutCents: integer("payout_cents"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("submissions_campaign_post_url_unique").on(
      table.campaignId,
      table.postUrl,
    ),

    check(
      "submissions_rejection_reason_check",
      sql`
        (
          ${table.status} = 'rejected'
          AND ${table.rejectionReason} IS NOT NULL
          AND length(trim(${table.rejectionReason})) > 0
        )
        OR
        (
          ${table.status} <> 'rejected'
          AND ${table.rejectionReason} IS NULL
        )
      `,
    ),

    check(
      "submissions_payout_cents_check",
      sql`
        (
          ${table.status} IN ('approved', 'paid')
          AND ${table.payoutCents} IS NOT NULL
          AND ${table.payoutCents} >= 0
        )
        OR
        (
          ${table.status} NOT IN ('approved', 'paid')
          AND ${table.payoutCents} IS NULL
        )
      `,
    ),

    index("submissions_campaign_status_idx").on(
      table.campaignId,
      table.status,
    ),

    index("submissions_creator_idx").on(
      table.creatorId,
    ),
  ],
);