import { createHash, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import {
  accountPlanAssignments,
  accounts,
  plans,
  userPlanAssignments,
  users,
} from "../../src/schema";
import { registerAccount } from "../../src/services/accounts.service";
import { registerUser } from "../../src/services/users.service";
import { seedPredefinedPlans } from "../../src/seed";

if (!process.env.DATABASE_URL?.includes("usage_metering_test")) {
  throw new Error("Integration tests must use usage_metering_test");
}

describe("account and user registration", () => {
  it("creates an account and a user with their predefined plans", async () => {
    let accountId: string | undefined;
    let userId: string | undefined;

    try {
      await seedPredefinedPlans();

      const suffix = randomUUID();
      const account = await registerAccount(`Test account ${suffix}`);
      accountId = account.id;

      const [savedAccount] = await db
        .select({ apiKeyHash: accounts.apiKeyHash })
        .from(accounts)
        .where(eq(accounts.id, account.id));

      expect(account.apiKey).toBeTruthy();
      expect(savedAccount?.apiKeyHash).toBe(
        createHash("sha256").update(account.apiKey).digest("hex"),
      );

      const [accountPlan] = await db
        .select({ name: plans.name, scope: plans.scope })
        .from(accountPlanAssignments)
        .innerJoin(plans, eq(accountPlanAssignments.planId, plans.id))
        .where(eq(accountPlanAssignments.accountId, account.id));

      expect(accountPlan).toEqual({
        name: "Starter",
        scope: "account",
      });

      const externalId = `test-user-${suffix}`;
      const user = await registerUser(account.id, externalId);
      userId = user.id;

      const [userPlan] = await db
        .select({ name: plans.name, scope: plans.scope })
        .from(userPlanAssignments)
        .innerJoin(plans, eq(userPlanAssignments.planId, plans.id))
        .where(eq(userPlanAssignments.userId, user.id));

      expect(user.externalId).toBe(externalId);
      expect(userPlan).toEqual({
        name: "Basic",
        scope: "user",
      });
    } finally {
      await db.transaction(async (tx) => {
        if (userId) {
          await tx
            .delete(userPlanAssignments)
            .where(eq(userPlanAssignments.userId, userId));

          await tx.delete(users).where(eq(users.id, userId));
        }

        if (accountId) {
          await tx
            .delete(accountPlanAssignments)
            .where(eq(accountPlanAssignments.accountId, accountId));

          await tx.delete(accounts).where(eq(accounts.id, accountId));
        }
      });
    }
  });
});

afterAll(async () => {
  await db.$client.end();
});