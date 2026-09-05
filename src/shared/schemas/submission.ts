import { z } from "zod";

export const submitClipInputSchema = z.object({
  campaignId: z.string().uuid(),
  postUrl: z
    .string()
    .trim()
    .min(1, "Post URL is required")
    .max(2048, "Post URL is too long"),
});

export const submissionListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const submissionIdInputSchema = z.object({
  submissionId: z.string().uuid(),
});

export const rejectSubmissionInputSchema = z.object({
  submissionId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(1, "A rejection reason is required")
    .max(1000, "Rejection reason is too long"),
});

export type SubmitClipInput = z.infer<typeof submitClipInputSchema>;
