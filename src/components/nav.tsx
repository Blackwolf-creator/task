"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/trpc/react";

const links = [
  { href: "/admin/campaigns", label: "Admin: Campaigns" },
  { href: "/campaigns", label: "Browse campaigns" },
  { href: "/submissions", label: "My submissions" },
];

export function Nav() {
  const pathname = usePathname();
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery();
  const usersQuery = trpc.auth.devUsers.useQuery();

  const switchUser = trpc.auth.switchUser.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
    },
  });

  const clearUser = trpc.auth.clearUser.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
    },
  });

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 p-4">
        <nav
          aria-label="Main navigation"
          className="flex flex-wrap items-center gap-1"
        >
          <Link
            href="/"
            className="mr-2 font-heading text-sm font-semibold"
          >
            Clipping Marketplace
          </Link>

          {links.map((link) => (
            <Button
              key={link.href}
              variant={pathname === link.href ? "secondary" : "ghost"}
              size="sm"
              nativeButton={false}
              render={<Link href={link.href} />}
            >
              {link.label}
            </Button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {meQuery.data ? (
            <Badge variant="outline">
              {meQuery.data.email} · {meQuery.data.role}
            </Badge>
          ) : (
            <Badge variant="secondary">No dev user selected</Badge>
          )}

          <Select
            value={meQuery.data?.id ?? ""}
            onValueChange={(value) => {
              if (typeof value === "string" && value) {
                switchUser.mutate({ userId: value });
              }
            }}
          >
            <SelectTrigger
              size="sm"
              aria-label="Switch dev user"
            >
              <SelectValue placeholder="Switch user">
                {(value: string | null) =>
                  usersQuery.data?.find((user) => user.id === value)
                    ?.email ?? "Switch user"
                }
              </SelectValue>
            </SelectTrigger>

            <SelectContent>
              {usersQuery.data?.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.email} — {user.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            disabled={clearUser.isPending}
            onClick={() => clearUser.mutate()}
          >
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
