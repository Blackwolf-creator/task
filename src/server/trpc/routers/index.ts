import { createTRPCRouter } from "../init";
import { authRouter } from "./auth";
import { campaignsRouter } from "./campaigns";
import { submissionsRouter } from "./submissions";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  campaigns: campaignsRouter,
  submissions: submissionsRouter,
});

export type AppRouter = typeof appRouter;