import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUserIdFromRequest } from "@/server/auth/session";

export async function createTRPCContext({
  req,
  resHeaders,
}: FetchCreateContextFnOptions) {
  const userId = getSessionUserIdFromRequest(req);

  let user: {
    id: string;
    email: string;
    role: "admin" | "creator";
  } | null = null;

  if (userId) {
    const [databaseUser] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    user = databaseUser ?? null;
  }

  return {
    db,
    req,
    resHeaders,
    user,
  };
}

export type TRPCContext = Awaited<
  ReturnType<typeof createTRPCContext>
>;