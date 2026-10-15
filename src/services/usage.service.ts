import { AppError } from "../errors/AppError";
import { findCurrentUsage } from "../repositories/usage.repository";

export async function getCurrentUsage(
  accountId: string,
  externalId: string,
  period?: string,
) {
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const requestedPeriod = period ?? currentPeriod;

  if (requestedPeriod > currentPeriod) {
    throw new AppError(400, "Future usage periods are not available");
  }

  const periodStart = `${requestedPeriod}-01`;

  const { accountUsage, userUsage } = await findCurrentUsage(
    accountId,
    externalId,
    periodStart,
  );

  if (!userUsage) {
    throw new AppError(404, "User not found in this account");
  }

  const accountConsumedUnits = accountUsage?.consumedUnits ?? 0;
  const userConsumedUnits = userUsage.consumedUnits ?? 0;


  if (requestedPeriod < currentPeriod) {
    return {
      periodStart,
      account: {
        consumedUnits: accountConsumedUnits,
      },
      user: {
        consumedUnits: userConsumedUnits,
      },
    };
  }


  if (!accountUsage) {
    throw new Error("Account plan assignment is missing");
  }

  if (
    userUsage.monthlyLimit === null ||
    userUsage.maxUnitsPerRequest === null
  ) {
    throw new Error("User plan assignment is missing");
  }

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