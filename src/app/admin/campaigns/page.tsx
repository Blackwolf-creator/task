"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCents, formatDate } from "@/shared/format";
import { CAMPAIGN_STATUSES, type CampaignStatus } from "@/shared/schemas/campaign";
import { trpc } from "@/trpc/react";

const PAGE_SIZE = 10;

export default function AdminCampaignsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const status =
    statusFilter === "all" ? undefined : (statusFilter as CampaignStatus);

  const query = trpc.campaigns.list.useQuery({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    status,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Campaigns</h1>

        <Button
          nativeButton={false}
          render={<Link href="/admin/campaigns/new" />}
        >
          New campaign
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search by title"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="max-w-xs"
          aria-label="Search campaigns by title"
        />

        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(String(value));
            setPage(1);
          }}
        >
          <SelectTrigger aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {CAMPAIGN_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isPending ? (
        <p className="text-sm text-muted-foreground">Loading campaigns…</p>
      ) : query.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {query.error.message}
        </p>
      ) : query.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No campaigns match your filters.
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Platforms</TableHead>
                <TableHead>Payout / 1k views</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Window</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {query.data.items.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <Link
                      className="underline underline-offset-2"
                      href={`/admin/campaigns/${campaign.id}`}
                    >
                      {campaign.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{campaign.status}</Badge>
                  </TableCell>
                  <TableCell>{campaign.platforms.join(", ")}</TableCell>
                  <TableCell>
                    {formatCents(campaign.payoutPer1kViews)}
                  </TableCell>
                  <TableCell>{formatCents(campaign.totalBudget)}</TableCell>
                  <TableCell>
                    {formatDate(campaign.startsAt)} –{" "}
                    {formatDate(campaign.endsAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {query.data.page} of {query.data.pageCount} (
              {query.data.total} total)
            </p>

            <Pagination className="justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled={page <= 1}
                    className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((current) => Math.max(1, current - 1));
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled={page >= query.data.pageCount}
                    className={
                      page >= query.data.pageCount
                        ? "pointer-events-none opacity-50"
                        : ""
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((current) =>
                        Math.min(query.data.pageCount, current + 1),
                      );
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </>
      )}
    </div>
  );
}
