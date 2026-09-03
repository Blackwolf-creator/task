import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { submissions } from "./submissions";

export const submissionMetrics = pgTable(
  "submission_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, {
        onDelete: "cascade",
      }),

    capturedAt: date("captured_at", {
      mode: "date",
    }).notNull(),

    views: integer("views")
      .notNull(),

    likes: integer("likes")
      .notNull(),

    comments: integer("comments")
      .notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("submission_metrics_submission_day_unique").on(
      table.submissionId,
      table.capturedAt,
    ),

    check(
      "submission_metrics_views_non_negative",
      sql`${table.views} >= 0`,
    ),

    check(
      "submission_metrics_likes_non_negative",
      sql`${table.likes} >= 0`,
    ),

    check(
      "submission_metrics_comments_non_negative",
      sql`${table.comments} >= 0`,
    ),

    index("submission_metrics_submission_captured_idx").on(
      table.submissionId,
      table.capturedAt,
    ),
  ],
);