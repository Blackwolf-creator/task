"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/react";

export function DevUserSwitcher() {
  const utils = trpc.useUtils();

  const usersQuery =
    trpc.auth.devUsers.useQuery();

  const meQuery =
    trpc.auth.me.useQuery();

  const [selectedUserId, setSelectedUserId] =
    useState("");

  const switchUser =
    trpc.auth.switchUser.useMutation({
      onSuccess: async () => {
        await utils.auth.me.invalidate();
      },
    });

  const clearUser =
    trpc.auth.clearUser.useMutation({
      onSuccess: async () => {
        setSelectedUserId("");
        await utils.auth.me.invalidate();
      },
    });

  return (
    <div className="flex max-w-xl flex-col gap-4 rounded-xl border p-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Current user
        </p>

        <p className="font-medium">
          {meQuery.data
            ? `${meQuery.data.email} (${meQuery.data.role})`
            : "No user selected"}
        </p>
      </div>

      <select
        className="h-10 rounded-md border bg-background px-3"
        value={selectedUserId}
        onChange={(event) =>
          setSelectedUserId(event.target.value)
        }
      >
        <option value="">
          Select development user
        </option>

        {usersQuery.data?.map((user) => (
          <option
            key={user.id}
            value={user.id}
          >
            {user.email} — {user.role}
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        <Button
          disabled={
            !selectedUserId ||
            switchUser.isPending
          }
          onClick={() =>
            switchUser.mutate({
              userId: selectedUserId,
            })
          }
        >
          Switch user
        </Button>

        <Button
          variant="outline"
          disabled={clearUser.isPending}
          onClick={() =>
            clearUser.mutate()
          }
        >
          Clear
        </Button>
      </div>
    </div>
  );
}