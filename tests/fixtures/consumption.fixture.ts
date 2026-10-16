import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import {
  accountMonthlyUsage,
  accountPlanAssignments,
  accounts,
  consumptionRequests,
  plans,
  userMonthlyUsage,
  userPlanAssignments,
  users,
} from "../../src/schema";

export async function createConsumptionFixture() {
  const suffix = randomUUID();

  return db.transaction(async (tx) => {
    const [account] = await tx
      .insert(accounts)
      .values({
        name: `Test account ${suffix}`,
        apiKeyHash: createHash("sha256").update(suffix).digest("hex"),
      })
      .returning({ id: accounts.id });

    if (!account) throw new Error("Could not create test account");

    const [accountPlan] = await tx
      .insert(plans)
      .values({
        name: `Account plan ${suffix}`,
        scope: "account",
        monthlyLimit: 1000,
        maxUnitsPerRequest: 100,
        ownerAccountId: account.id,
      })
      .returning({ id: plans.id });

    const [userPlan] = await tx
      .insert(plans)
      .values({
        name: `User plan ${suffix}`,
        scope: "user",
        monthlyLimit: 1000,
        maxUnitsPerRequest: 100,
        ownerAccountId: account.id,
      })
      .returning({ id: plans.id });

    if (!accountPlan || !userPlan) {
      throw new Error("Could not create test plans");
    }

    await tx.insert(accountPlanAssignments).values({
      accountId: account.id,
      planId: accountPlan.id,
    });

    const externalId = `test-user-${suffix}`;
    const [user] = await tx
      .insert(users)
      .values({ accountId: account.id, externalId })
      .returning({ id: users.id });

    if (!user) throw new Error("Could not create test user");

    await tx.insert(userPlanAssignments).values({
      userId: user.id,
      planId: userPlan.id,
    });

    return {
      accountId: account.id,
      userId: user.id,
      externalId,
      requestId: `retry-${suffix}`,
      apiKey: suffix,
    };
  });
}

export async function removeConsumptionFixture(
  fixture: Awaited<ReturnType<typeof createConsumptionFixture>>,
) {
  await db.transaction(async (tx) => {
    await tx
      .delete(consumptionRequests)
      .where(eq(consumptionRequests.accountId, fixture.accountId));

    await tx
      .delete(accountMonthlyUsage)
      .where(eq(accountMonthlyUsage.accountId, fixture.accountId));

    await tx
      .delete(userMonthlyUsage)
      .where(eq(userMonthlyUsage.userId, fixture.userId));

    await tx
      .delete(userPlanAssignments)
      .where(eq(userPlanAssignments.userId, fixture.userId));

    await tx.delete(users).where(eq(users.id, fixture.userId));

    await tx
      .delete(accountPlanAssignments)
      .where(eq(accountPlanAssignments.accountId, fixture.accountId));

    await tx
      .delete(plans)
      .where(eq(plans.ownerAccountId, fixture.accountId));

    await tx.delete(accounts).where(eq(accounts.id, fixture.accountId));
  });
}