import { createHash, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../src/db";
import {
  accounts,
  plans,
  userPlanAssignments,
  users,
} from "../../src/schema";
import { updateUserPlan } from "../../src/repositories/users.repository";

if (!process.env.DATABASE_URL?.includes("usage_metering_test")) {
  throw new Error("Integration tests must use usage_metering_test");
}

async function createFixture() {
  const suffix = randomUUID();

  return db.transaction(async (tx) => {
    const [accountA] = await tx
      .insert(accounts)
      .values({
        name: `Test account A ${suffix}`,
        apiKeyHash: createHash("sha256")
          .update(`account-a-${suffix}`)
          .digest("hex"),
      })
      .returning({ id: accounts.id });

    const [accountB] = await tx
      .insert(accounts)
      .values({
        name: `Test account B ${suffix}`,
        apiKeyHash: createHash("sha256")
          .update(`account-b-${suffix}`)
          .digest("hex"),
      })
      .returning({ id: accounts.id });

    if (!accountA || !accountB) {
      throw new Error("Could not create test accounts");
    }

    const [oldPlanA] = await tx
      .insert(plans)
      .values({
        name: `Old plan A ${suffix}`,
        scope: "user",
        monthlyLimit: 100,
        maxUnitsPerRequest: 10,
        ownerAccountId: accountA.id,
      })
      .returning({ id: plans.id });

    const [newPlanA] = await tx
      .insert(plans)
      .values({
        name: `New plan A ${suffix}`,
        scope: "user",
        monthlyLimit: 200,
        maxUnitsPerRequest: 20,
        ownerAccountId: accountA.id,
      })
      .returning({ id: plans.id });

    const [planB] = await tx
      .insert(plans)
      .values({
        name: `Plan B ${suffix}`,
        scope: "user",
        monthlyLimit: 300,
        maxUnitsPerRequest: 30,
        ownerAccountId: accountB.id,
      })
      .returning({ id: plans.id });

    if (!oldPlanA || !newPlanA || !planB) {
      throw new Error("Could not create test plans");
    }

    const externalId = `shared-user-${suffix}`;

    const [userA] = await tx
      .insert(users)
      .values({ accountId: accountA.id, externalId })
      .returning({ id: users.id });

    const [userB] = await tx
      .insert(users)
      .values({ accountId: accountB.id, externalId })
      .returning({ id: users.id });

    if (!userA || !userB) {
      throw new Error("Could not create test users");
    }

    await tx.insert(userPlanAssignments).values([
      { userId: userA.id, planId: oldPlanA.id },
      { userId: userB.id, planId: planB.id },
    ]);

    return {
      accountAId: accountA.id,
      accountBId: accountB.id,
      userAId: userA.id,
      userBId: userB.id,
      externalId,
      oldPlanAId: oldPlanA.id,
      newPlanAId: newPlanA.id,
      planBId: planB.id,
    };
  });
}

async function removeFixture(
  fixture: Awaited<ReturnType<typeof createFixture>>,
) {
  await db.transaction(async (tx) => {
    await tx
      .delete(userPlanAssignments)
      .where(
        inArray(userPlanAssignments.userId, [
          fixture.userAId,
          fixture.userBId,
        ]),
      );

    await tx
      .delete(users)
      .where(inArray(users.id, [fixture.userAId, fixture.userBId]));

    await tx
      .delete(plans)
      .where(
        inArray(plans.id, [
          fixture.oldPlanAId,
          fixture.newPlanAId,
          fixture.planBId,
        ]),
      );

    await tx
      .delete(accounts)
      .where(
        inArray(accounts.id, [fixture.accountAId, fixture.accountBId]),
      );
  });
}

describe("user plan account isolation", () => {
  it("changes the plan only for the user in the specified account", async () => {
    const fixture = await createFixture();

    try {
      const updatedAssignment = await updateUserPlan(
        fixture.accountAId,
        fixture.externalId,
        fixture.newPlanAId,
      );

      const [assignmentA] = await db
        .select({ planId: userPlanAssignments.planId })
        .from(userPlanAssignments)
        .where(eq(userPlanAssignments.userId, fixture.userAId));

      const [assignmentB] = await db
        .select({ planId: userPlanAssignments.planId })
        .from(userPlanAssignments)
        .where(eq(userPlanAssignments.userId, fixture.userBId));

      expect(updatedAssignment).toEqual({
        userId: fixture.userAId,
        planId: fixture.newPlanAId,
      });
      expect(assignmentA.planId).toBe(fixture.newPlanAId);
      expect(assignmentB.planId).toBe(fixture.planBId);
    } finally {
      await removeFixture(fixture);
    }
  });
});

afterAll(async () => {
  await db.$client.end();
});