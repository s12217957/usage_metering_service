import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { plans } from "../schema";

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
