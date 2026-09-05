"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCents, formatDate, formatNumber } from "@/shared/format";
import { trpc } from "@/trpc/react";

const STATUS_VARIANT = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  paid: "outline",
} as const;

export default function MySubmissionsPage() {
  const query = trpc.submissions.mine.useQuery();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My submissions</h1>

      {query.isPending ? (
        <p className="text-sm text-muted-foreground">
          Loading submissions…
        </p>
      ) : query.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {query.error.message}
        </p>
      ) : query.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t submitted any clips yet.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Post URL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Estimated earnings</TableHead>
              <TableHead>Submitted</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {query.data.map((submission) => (
              <TableRow key={submission.id}>
                <TableCell>{submission.campaignTitle}</TableCell>
                <TableCell className="capitalize">
                  {submission.platform}
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
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
                  <Badge variant={STATUS_VARIANT[submission.status]}>
                    {submission.status}
                  </Badge>
                  {submission.status === "rejected" &&
                    submission.rejectionReason && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {submission.rejectionReason}
                      </p>
                    )}
                </TableCell>
                <TableCell>
                  {formatNumber(submission.currentViews)}
                </TableCell>
                <TableCell>
                  {formatCents(submission.earningsCents)}
                </TableCell>
                <TableCell>{formatDate(submission.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
