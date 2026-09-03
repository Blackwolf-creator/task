import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import {
  campaignStatusEnum,
  platformEnum,
} from "./enums";

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    title: text("title").notNull(),

    platforms: platformEnum("platforms")
      .array()
      .notNull(),

    payoutPer1kViews: integer("payout_per_1k_views")
      .notNull(),

    totalBudget: integer("total_budget")
      .notNull(),

    status: campaignStatusEnum("status")
      .default("draft")
      .notNull(),

    startsAt: timestamp("starts_at", {
      withTimezone: true,
    }).notNull(),

    endsAt: timestamp("ends_at", {
      withTimezone: true,
    }).notNull(),

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
    check(
      "campaigns_payout_non_negative",
      sql`${table.payoutPer1kViews} >= 0`,
    ),

    check(
      "campaigns_budget_non_negative",
      sql`${table.totalBudget} >= 0`,
    ),

    check(
      "campaigns_valid_date_range",
      sql`${table.startsAt} < ${table.endsAt}`,
    ),

    check(
      "campaigns_platforms_not_empty",
      sql`cardinality(${table.platforms}) > 0`,
    ),

    index("campaigns_status_idx").on(table.status),

    index("campaigns_starts_at_idx").on(table.startsAt),
  ],
);