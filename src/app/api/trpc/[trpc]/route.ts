import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { createTRPCContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/routers";

export const runtime = "nodejs";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,

    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(
              `tRPC failed on ${path ?? "<unknown>"}:`,
              error,
            );
          }
        : undefined,
  });
}

export {
  handler as GET,
  handler as POST,
};