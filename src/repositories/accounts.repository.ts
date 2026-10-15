import { eq } from "drizzle-orm";
import { db } from "../db";
import { accountPlanAssignments, accounts } from "../schema";

export async function findAccountByApiKeyHash(apiKeyHash: string) {
  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.apiKeyHash, apiKeyHash))
    .limit(1);

  return account;
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


export async function updateAccountPlan(accountId: string, planId: string) {
  const [assignment] = await db
    .update(accountPlanAssignments)
    .set({ planId })
    .where(eq(accountPlanAssignments.accountId, accountId))
    .returning({
      accountId: accountPlanAssignments.accountId,
      planId: accountPlanAssignments.planId,
    });

  if (!assignment) {
    throw new Error("Account plan assignment was not found");
  }

  return assignment;
}
