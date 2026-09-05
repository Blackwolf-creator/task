"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLATFORMS } from "@/shared/post-url";
import {
  CAMPAIGN_STATUSES,
  createCampaignInputSchema,
  type CampaignFormValues,
} from "@/shared/schemas/campaign";

type CampaignFormProps = {
  defaultValues?: Partial<CampaignFormValues>;
  onSubmit: (values: CampaignFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
};

function toDatetimeLocal(date: Date | undefined): string {
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CampaignForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel = "Save",
}: CampaignFormProps) {
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(createCampaignInputSchema),
    defaultValues: {
      title: defaultValues?.title ?? "",
      platforms: defaultValues?.platforms ?? [],
      payoutPer1kViews: defaultValues?.payoutPer1kViews ?? 0,
      totalBudget: defaultValues?.totalBudget ?? 0,
      status: defaultValues?.status ?? "draft",
      startsAt: defaultValues?.startsAt ?? new Date(),
      endsAt:
        defaultValues?.endsAt ?? new Date(Date.now() + 7 * 86_400_000),
    },
  });

  const platforms = form.watch("platforms");
  const status = form.watch("status");

  return (
    <form
      className="max-w-xl space-y-4"
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="space-y-1">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          aria-invalid={!!form.formState.errors.title}
          {...form.register("title")}
        />
        {form.formState.errors.title && (
          <p className="text-sm text-destructive" role="alert">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Platforms</legend>
        <div className="flex flex-wrap gap-4">
          {PLATFORMS.map((platform) => (
            <label
              key={platform}
              className="flex items-center gap-2 text-sm capitalize"
            >
              <input
                type="checkbox"
                checked={platforms.includes(platform)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...platforms, platform]
                    : platforms.filter((value) => value !== platform);

                  form.setValue("platforms", next, {
                    shouldValidate: true,
                  });
                }}
              />
              {platform}
            </label>
          ))}
        </div>
        {form.formState.errors.platforms && (
          <p className="text-sm text-destructive" role="alert">
            {form.formState.errors.platforms.message}
          </p>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="payoutPer1kViews">
            Payout per 1,000 views (cents)
          </Label>
          <Input
            id="payoutPer1kViews"
            type="number"
            min={0}
            step={1}
            aria-invalid={!!form.formState.errors.payoutPer1kViews}
            {...form.register("payoutPer1kViews", { valueAsNumber: true })}
          />
          {form.formState.errors.payoutPer1kViews && (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.payoutPer1kViews.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="totalBudget">Total budget (cents)</Label>
          <Input
            id="totalBudget"
            type="number"
            min={0}
            step={1}
            aria-invalid={!!form.formState.errors.totalBudget}
            {...form.register("totalBudget", { valueAsNumber: true })}
          />
          {form.formState.errors.totalBudget && (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.totalBudget.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="startsAt">Starts at</Label>
          <Controller
            control={form.control}
            name="startsAt"
            render={({ field }) => (
              <Input
                id="startsAt"
                type="datetime-local"
                aria-invalid={!!form.formState.errors.startsAt}
                value={toDatetimeLocal(field.value)}
                onChange={(event) =>
                  field.onChange(
                    event.target.value
                      ? new Date(event.target.value)
                      : undefined,
                  )
                }
              />
            )}
          />
          {form.formState.errors.startsAt && (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.startsAt.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="endsAt">Ends at</Label>
          <Controller
            control={form.control}
            name="endsAt"
            render={({ field }) => (
              <Input
                id="endsAt"
                type="datetime-local"
                aria-invalid={!!form.formState.errors.endsAt}
                value={toDatetimeLocal(field.value)}
                onChange={(event) =>
                  field.onChange(
                    event.target.value
                      ? new Date(event.target.value)
                      : undefined,
                  )
                }
              />
            )}
          />
          {form.formState.errors.endsAt && (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.endsAt.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="status">Status</Label>
        <Select
          value={status}
          onValueChange={(value) =>
            form.setValue(
              "status",
              value as CampaignFormValues["status"],
              { shouldValidate: true },
            )
          }
        >
          <SelectTrigger id="status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CAMPAIGN_STATUSES.map((value) => (
              <SelectItem key={value} value={value} className="capitalize">
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
