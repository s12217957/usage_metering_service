import { createUserWithPlan } from "../repositories/users.repository";
import { findPredefinedPlan } from "../repositories/plans.repository";

export async function registerUser(accountId: string, externalId: string) {
  const basicPlan = await findPredefinedPlan("Basic", "user");

  if (!basicPlan) {
    throw new Error("Basic user plan is not available");
  }

  return createUserWithPlan(accountId, externalId, basicPlan.id);
}