import { createHash, randomBytes } from "node:crypto";
import { createAccountWithPlan } from "../repositories/accounts.repository";
import { findPredefinedPlan } from "../repositories/plans.repository";

export async function registerAccount(name: string) {
  const starterPlan = await findPredefinedPlan("Starter", "account");

  if (!starterPlan) {
    throw new Error("Starter plan is not available");
  }

  const apiKey = randomBytes(32).toString("hex");
  const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");

  const account = await createAccountWithPlan(
    name,
    apiKeyHash,
    starterPlan.id,
  );

  return { ...account, apiKey };
}