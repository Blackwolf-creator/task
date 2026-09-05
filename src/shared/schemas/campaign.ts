import { z } from "zod";

import { PLATFORMS } from "@/shared/post-url";

export const CAMPAIGN_STATUSES = [
  "draft",
  "active",
  "paused",
  "completed",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const campaignFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title is too long"),

  platforms: z
    .array(z.enum(PLATFORMS))
    .min(1, "Select at least one platform"),

  payoutPer1kViews: z
    .number({ error: "Payout must be a number" })
    .int("Payout must be a whole number of cents")
    .nonnegative("Payout can't be negative"),

  totalBudget: z
    .number({ error: "Budget must be a number" })
    .int("Budget must be a whole number of cents")
    .nonnegative("Budget can't be negative"),

  status: z.enum(CAMPAIGN_STATUSES),

  startsAt: z.date({ error: "Start date is required" }),
  endsAt: z.date({ error: "End date is required" }),
});

function refineDateRange<T extends { startsAt: Date; endsAt: Date }>(
  data: T,
  ctx: z.RefinementCtx,
) {
  if (data.startsAt >= data.endsAt) {
    ctx.addIssue({
      code: "custom",
      message: "Start date must be before end date",
      path: ["endsAt"],
    });
  }
}

export const createCampaignInputSchema = campaignFormSchema.superRefine(
  refineDateRange,
);

export const updateCampaignInputSchema = campaignFormSchema
  .extend({
    id: z.string().uuid(),
  })
  .superRefine(refineDateRange);

export const campaignListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(200).optional(),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
});

export const campaignIdInputSchema = z.object({
  id: z.string().uuid(),
});

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;
