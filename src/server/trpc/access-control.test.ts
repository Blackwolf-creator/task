import { afterAll, describe, expect, it } from "vitest";

import { closeTestDb, testDb } from "@/test/db";
import {
  createTestCampaign,
  createTestSubmission,
  createTestUser,
} from "@/test/fixtures";

import type { TRPCContext } from "./context";
import { appRouter } from "./routers";

function contextFor(
  user: TRPCContext["user"],
): TRPCContext {
  return {
    db: testDb,
    req: new Request("http://localhost/api/trpc"),
    resHeaders: new Headers(),
    user,
  };
}

afterAll(async () => {
  await closeTestDb();
});

describe("access control", () => {
  it("rejects unauthenticated access to a protected procedure", async () => {
    const caller = appRouter.createCaller(contextFor(null));

    await expect(caller.campaigns.listActive()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects a creator calling an admin-only procedure", async () => {
    const creator = await createTestUser("creator");
    const caller = appRouter.createCaller(contextFor(creator));

    await expect(
      caller.campaigns.list({ page: 1, pageSize: 10 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects an admin calling a creator-only procedure", async () => {
    const admin = await createTestUser("admin");
    const campaign = await createTestCampaign();
    const caller = appRouter.createCaller(contextFor(admin));

    await expect(
      caller.submissions.submit({
        campaignId: campaign.id,
        postUrl: "https://youtu.be/dQw4w9WgXcQ",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("never lets a creator see another creator's submissions, even by hand-crafted input", async () => {
    const alice = await createTestUser("creator");
    const bob = await createTestUser("creator");
    const campaign = await createTestCampaign();

    await createTestSubmission({
      campaignId: campaign.id,
      creatorId: bob.id,
      postUrl: "https://youtu.be/bobOnlyVideo1",
    });

    const aliceSubmission = await createTestSubmission({
      campaignId: campaign.id,
      creatorId: alice.id,
      postUrl: "https://youtu.be/aliceOnlyVideo1",
    });

    const aliceCaller = appRouter.createCaller(contextFor(alice));
    const results = await aliceCaller.submissions.mine();

    // `mine` takes no id input at all — it's always scoped to ctx.user.id
    // server-side, so there is nothing a client could hand-craft to reach
    // another creator's rows.
    expect(results.map((s) => s.id)).toContain(aliceSubmission.id);
    expect(results.map((s) => s.postUrl)).not.toContain(
      "https://youtu.be/bobOnlyVideo1",
    );
  });
});
