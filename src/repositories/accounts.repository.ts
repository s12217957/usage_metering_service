import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { accountPlanAssignments, accounts, plans } from "../schema";

export async function findPredefinedPlan(name: string, scope: string) {
  const [plan] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(
      and(
        eq(plans.name, name),
        eq(plans.scope, scope),
        eq(plans.isPredefined, true),
      ),
    )
    .limit(1);

  return plan;
}

export async function createAccountWithPlan(
  name: string,
  apiKeyHash: string,
  planId: string,
) {
  return db.transaction(async (tx) => {
    const [account] = await tx
      .insert(accounts)
      .values({ name, apiKeyHash })
      .returning({ id: accounts.id, name: accounts.name });

    if (!account) {
      throw new Error("Account was not created");
    }

    await tx.insert(accountPlanAssignments).values({
      accountId: account.id,
      planId,
    });

    return account;
  });
}