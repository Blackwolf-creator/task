import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { users } from "@/db/schema";
import {
  clearSessionCookie,
  createSessionCookie,
} from "@/server/auth/session";

import {
  createTRPCRouter,
  publicProcedure,
} from "../init";

const devProcedure = publicProcedure.use(
  async ({ next }) => {
    if (
      process.env.ENABLE_DEV_USER_SWITCHER !==
      "true"
    ) {
      throw new TRPCError({
        code: "NOT_FOUND",
      });
    }

    return next();
  },
);

export const authRouter = createTRPCRouter({
  me: publicProcedure.query(({ ctx }) => {
    return ctx.user;
  }),

  devUsers: devProcedure.query(
    async ({ ctx }) => {
      return ctx.db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .orderBy(users.email);
    },
  ),

  switchUser: devProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      ctx.resHeaders.append(
        "set-cookie",
        createSessionCookie(user.id),
      );

      return user;
    }),

  clearUser: devProcedure.mutation(
    ({ ctx }) => {
      ctx.resHeaders.append(
        "set-cookie",
        clearSessionCookie(),
      );

      return {
        success: true,
      };
    },
  ),
});