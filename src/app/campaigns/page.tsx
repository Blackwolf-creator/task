"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCents, formatDate } from "@/shared/format";
import { trpc } from "@/trpc/react";

function SubmitClipDialog({
  campaignId,
  campaignTitle,
}: {
  campaignId: string;
  campaignTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [postUrl, setPostUrl] = useState("");
  const utils = trpc.useUtils();

  const submit = trpc.submissions.submit.useMutation({
    onSuccess: async () => {
      await utils.submissions.mine.invalidate();
      toast.success("Clip submitted for review");
      setPostUrl("");
      setOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        Submit a clip
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit a clip to {campaignTitle}</DialogTitle>
          <DialogDescription>
            Paste the URL of your published post.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Label htmlFor="postUrl">Post URL</Label>
          <Input
            id="postUrl"
            value={postUrl}
            onChange={(event) => setPostUrl(event.target.value)}
            placeholder="https://..."
          />
        </div>

        <DialogFooter>
          <Button
            disabled={!postUrl.trim() || submit.isPending}
            onClick={() =>
              submit.mutate({ campaignId, postUrl: postUrl.trim() })
            }
          >
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BrowseCampaignsPage() {
  const query = trpc.campaigns.listActive.useQuery();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Active campaigns</h1>

      {query.isPending ? (
        <p className="text-sm text-muted-foreground">
          Loading campaigns…
        </p>
      ) : query.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {query.error.message}
        </p>
      ) : query.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active campaigns right now.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {query.data.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader>
                <CardTitle>{campaign.title}</CardTitle>
                <CardDescription className="capitalize">
                  {campaign.platforms.join(", ")} ·{" "}
                  {formatDate(campaign.startsAt)} –{" "}
                  {formatDate(campaign.endsAt)}
                </CardDescription>
              </CardHeader>

              <CardContent className="text-sm text-muted-foreground">
                {formatCents(campaign.payoutPer1kViews)} per 1,000 views
              </CardContent>

              <CardFooter>
                <SubmitClipDialog
                  campaignId={campaign.id}
                  campaignTitle={campaign.title}
                />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
