"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { CampaignForm } from "@/components/campaign-form";
import { DailyViewsChart } from "@/components/daily-views-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCents, formatDate, formatNumber } from "@/shared/format";
import { trpc } from "@/trpc/react";

function RejectDialog({
  onReject,
  isPending,
}: {
  onReject: (reason: string) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="destructive" />}>
        Reject
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject submission</DialogTitle>
          <DialogDescription>A reason is required.</DialogDescription>
        </DialogHeader>

        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why is this submission being rejected?"
          aria-label="Rejection reason"
        />

        <DialogFooter>
          <Button
            variant="destructive"
            disabled={!reason.trim() || isPending}
            onClick={() => {
              onReject(reason.trim());
              setReason("");
              setOpen(false);
            }}
          >
            Confirm reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminCampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;

  const [editing, setEditing] = useState(false);

  const utils = trpc.useUtils();

  const detailQuery = trpc.campaigns.getById.useQuery({ id: campaignId });
  const chartQuery = trpc.campaigns.dailyViews.useQuery({ id: campaignId });
  const pendingQuery = trpc.submissions.pendingForCampaign.useQuery({
    id: campaignId,
  });

  const updateCampaign = trpc.campaigns.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.campaigns.getById.invalidate({ id: campaignId }),
        utils.campaigns.list.invalidate(),
      ]);
      toast.success("Campaign updated");
      setEditing(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const approve = trpc.submissions.approve.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.submissions.pendingForCampaign.invalidate({ id: campaignId }),
        utils.campaigns.getById.invalidate({ id: campaignId }),
        utils.campaigns.dailyViews.invalidate({ id: campaignId }),
      ]);
      toast.success("Submission approved");
    },
    onError: (error) => toast.error(error.message),
  });

  const reject = trpc.submissions.reject.useMutation({
    onSuccess: async () => {
      await utils.submissions.pendingForCampaign.invalidate({
        id: campaignId,
      });
      toast.success("Submission rejected");
    },
    onError: (error) => toast.error(error.message),
  });

  if (detailQuery.isPending) {
    return (
      <p className="text-sm text-muted-foreground">Loading campaign…</p>
    );
  }

  if (detailQuery.isError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {detailQuery.error.message}
      </p>
    );
  }

  const { campaign, budgetSpent, budgetLeft, totalApprovedViews } =
    detailQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{campaign.title}</h1>
          <Badge variant="outline" className="mt-1 capitalize">
            {campaign.status}
          </Badge>
        </div>

        <Button variant="outline" onClick={() => setEditing((v) => !v)}>
          {editing ? "Cancel" : "Edit campaign"}
        </Button>
      </div>

      {editing ? (
        <CampaignForm
          defaultValues={{
            title: campaign.title,
            platforms: campaign.platforms,
            payoutPer1kViews: campaign.payoutPer1kViews,
            totalBudget: campaign.totalBudget,
            status: campaign.status,
            startsAt: campaign.startsAt,
            endsAt: campaign.endsAt,
          }}
          isSubmitting={updateCampaign.isPending}
          submitLabel="Save changes"
          onSubmit={(values) =>
            updateCampaign.mutate({ id: campaignId, ...values })
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Total budget</CardTitle>
            </CardHeader>
            <CardContent>{formatCents(campaign.totalBudget)}</CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Budget spent</CardTitle>
            </CardHeader>
            <CardContent>{formatCents(budgetSpent)}</CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Budget left</CardTitle>
            </CardHeader>
            <CardContent>{formatCents(budgetLeft)}</CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Total approved views</CardTitle>
            </CardHeader>
            <CardContent>{formatNumber(totalApprovedViews)}</CardContent>
          </Card>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium">Daily views</h2>
        {chartQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Loading chart…</p>
        ) : chartQuery.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {chartQuery.error.message}
          </p>
        ) : (
          <DailyViewsChart data={chartQuery.data} />
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">Pending review queue</h2>

        {pendingQuery.isPending ? (
          <p className="text-sm text-muted-foreground">
            Loading submissions…
          </p>
        ) : pendingQuery.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {pendingQuery.error.message}
          </p>
        ) : pendingQuery.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No pending submissions.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creator</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Post URL</TableHead>
                <TableHead>Views</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {pendingQuery.data.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell>{submission.creatorEmail}</TableCell>
                  <TableCell className="capitalize">
                    {submission.platform}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate">
                    <a
                      href={submission.postUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                    >
                      {submission.postUrl}
                    </a>
                  </TableCell>
                  <TableCell>
                    {formatNumber(submission.currentViews)}
                  </TableCell>
                  <TableCell>{formatDate(submission.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        disabled={approve.isPending}
                        onClick={() =>
                          approve.mutate({ submissionId: submission.id })
                        }
                      >
                        Approve
                      </Button>
                      <RejectDialog
                        isPending={reject.isPending}
                        onReject={(reason) =>
                          reject.mutate({
                            submissionId: submission.id,
                            reason,
                          })
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
