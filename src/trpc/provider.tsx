"use client";

import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";

import { trpc } from "./react";

function isRetriableError(error: unknown): boolean {
  if (!(error instanceof TRPCClientError)) {
    return true;
  }

  // 4xx tRPC errors (UNAUTHORIZED, FORBIDDEN, BAD_REQUEST, NOT_FOUND,
  // CONFLICT, PRECONDITION_FAILED, ...) are never transient — retrying
  // them just delays showing the error state to the user.
  const httpStatus = error.data?.httpStatus as number | undefined;
  return !httpStatus || httpStatus < 400 || httpStatus >= 500;
}

export function TRPCProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) =>
              failureCount < 1 && isRetriableError(error),
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider
      client={trpcClient}
      queryClient={queryClient}
    >
      <QueryClientProvider
        client={queryClient}
      >
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}