ALTER TABLE "submissions" ADD COLUMN "payout_cents" integer;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_payout_cents_check" CHECK (
        (
          "submissions"."status" IN ('approved', 'paid')
          AND "submissions"."payout_cents" IS NOT NULL
          AND "submissions"."payout_cents" >= 0
        )
        OR
        (
          "submissions"."status" NOT IN ('approved', 'paid')
          AND "submissions"."payout_cents" IS NULL
        )
      );