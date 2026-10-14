import { findCurrentUsage } from "../repositories/usage.repository";

export async function getCurrentUsage(accountId: string, externalId: string) {
  const periodStart = `${new Date().toISOString().slice(0, 7)}-01`;
  const { accountUsage, userUsage } = await findCurrentUsage(
    accountId,
    externalId,
    periodStart,
  );

  if (!accountUsage) {
    throw new Error("Account plan assignment is missing");
  }

  if (!userUsage) {
    throw new Error("User not found in this account");
  }

  if (
    userUsage.monthlyLimit === null ||
    userUsage.maxUnitsPerRequest === null
  ) {
    throw new Error("User plan assignment is missing");
  }

  const accountConsumedUnits = accountUsage.consumedUnits ?? 0;
  const userConsumedUnits = userUsage.consumedUnits ?? 0;

  return {
    periodStart,
    account: {
      monthlyLimit: accountUsage.monthlyLimit,
      maxUnitsPerRequest: accountUsage.maxUnitsPerRequest,
      consumedUnits: accountConsumedUnits,
      remainingUnits: Math.max(
        0,
        accountUsage.monthlyLimit - accountConsumedUnits,
      ),
    },
    user: {
      monthlyLimit: userUsage.monthlyLimit,
      maxUnitsPerRequest: userUsage.maxUnitsPerRequest,
      consumedUnits: userConsumedUnits,
      remainingUnits: Math.max(
        0,
        userUsage.monthlyLimit - userConsumedUnits,
      ),
    },
  };
}
