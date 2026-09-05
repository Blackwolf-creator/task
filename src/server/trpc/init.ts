import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import type { TRPCContext } from "./context";

const t = initTRPC
  .context<TRPCContext>()
  .create({
    transformer: superjson,
  });

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(
  async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  },
);

export const protectedProcedure =
  t.procedure.use(requireUser);

export const adminProcedure =
  protectedProcedure.use(
    async ({ ctx, next }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required",
        });
      }

      return next({
        ctx,
      });
    },
  );

export const creatorProcedure =
  protectedProcedure.use(
    async ({ ctx, next }) => {
      if (ctx.user.role !== "creator") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Creator access required",
        });
      }

      return next({
        ctx,
      });
    },
  );