"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CampaignForm } from "@/components/campaign-form";
import type { CampaignFormValues } from "@/shared/schemas/campaign";
import { trpc } from "@/trpc/react";

export default function NewCampaignPage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const createCampaign = trpc.campaigns.create.useMutation({
    onSuccess: async (campaign) => {
      await utils.campaigns.list.invalidate();
      toast.success("Campaign created");
      router.push(`/admin/campaigns/${campaign.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (values: CampaignFormValues) => {
    createCampaign.mutate(values);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">New campaign</h1>

      <CampaignForm
        onSubmit={handleSubmit}
        isSubmitting={createCampaign.isPending}
        submitLabel="Create campaign"
      />
    </div>
  );
}
