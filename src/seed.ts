import { db } from "./db";
import { plans } from "./schema";

const predefinedPlans = [
  {
    name: "Starter",
    scope: "account",
    monthlyLimit: 10_000,
    maxUnitsPerRequest: 100,
  },
  {
    name: "Pro",
    scope: "account",
    monthlyLimit: 100_000,
    maxUnitsPerRequest: 1_000,
  },
  {
    name: "Basic",
    scope: "user",
    monthlyLimit: 1_000,
    maxUnitsPerRequest: 20,
  },
  {
    name: "Premium",
    scope: "user",
    monthlyLimit: 5_000,
    maxUnitsPerRequest: 100,
  },
];

export async function seedPredefinedPlans() {
  for (const plan of predefinedPlans) {
    await db.insert(plans).values({
      ...plan,
      ownerAccountId: null,
      isPredefined: true,
    })
    .onConflictDoNothing();
  }
}
