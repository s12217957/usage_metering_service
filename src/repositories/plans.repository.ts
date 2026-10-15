import { and, asc, eq, or } from "drizzle-orm";
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


export async function createCustomPlan(input: {
  ownerAccountId: string;
  name: string;
  scope: "account" | "user";
  monthlyLimit: number;
  maxUnitsPerRequest: number;
}) {
  const [plan] = await db
    .insert(plans)
    .values({
      ownerAccountId: input.ownerAccountId,
      name: input.name,
      scope: input.scope,
      monthlyLimit: input.monthlyLimit,
      maxUnitsPerRequest: input.maxUnitsPerRequest,
      isPredefined: false,
    })
    .returning({
      id: plans.id,
      name: plans.name,
      scope: plans.scope,
      monthlyLimit: plans.monthlyLimit,
      maxUnitsPerRequest: plans.maxUnitsPerRequest,
      createdAt: plans.createdAt,
    });

  if (!plan) {
    throw new Error("Plan was not created");
  }

  return plan;
}


export async function findAvailablePlans(accountId: string) {
  return db
    .select({
      id: plans.id,
      name: plans.name,
      scope: plans.scope,
      monthlyLimit: plans.monthlyLimit,
      maxUnitsPerRequest: plans.maxUnitsPerRequest,
      isPredefined: plans.isPredefined,
    })
    .from(plans)
    .where(
      or(
        eq(plans.isPredefined, true),
        eq(plans.ownerAccountId, accountId),
      ),
    )
    .orderBy(asc(plans.scope), asc(plans.name));
}

export async function findAssignablePlan(
  accountId: string,
  planId: string,
  scope: "account" | "user",
) {
  const [plan] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(
      and(
        eq(plans.id, planId),
        eq(plans.scope, scope),
        or(
          eq(plans.isPredefined, true),
          eq(plans.ownerAccountId, accountId),
        ),
      ),
    )
    .limit(1);

  return plan;
}

export async function updateCustomPlan(
  accountId: string,
  planId: string,
  input: {
    name: string;
    monthlyLimit: number;
    maxUnitsPerRequest: number;
  },
) {
  const [plan] = await db
    .update(plans)
    .set({
      name: input.name,
      monthlyLimit: input.monthlyLimit,
      maxUnitsPerRequest: input.maxUnitsPerRequest,
    })
    .where(
      and(
        eq(plans.id, planId),
        eq(plans.ownerAccountId, accountId),
        eq(plans.isPredefined, false),
      ),
    )
    .returning({
      id: plans.id,
      name: plans.name,
      scope: plans.scope,
      monthlyLimit: plans.monthlyLimit,
      maxUnitsPerRequest: plans.maxUnitsPerRequest,
    });

  return plan;
}