import { and, eq } from "drizzle-orm";
import { db } from "../db";
import {
  accountMonthlyUsage,
  accountPlanAssignments,
  plans,
  userMonthlyUsage,
  userPlanAssignments,
  users,
} from "../schema";

export async function findCurrentUsage(
  accountId: string,
  externalId: string,
  periodStart: string,
) {
  const [accountUsage] = await db
    .select({
      monthlyLimit: plans.monthlyLimit,
      maxUnitsPerRequest: plans.maxUnitsPerRequest,
      consumedUnits: accountMonthlyUsage.consumedUnits,
    })
    .from(accountPlanAssignments)
    .innerJoin(plans, eq(accountPlanAssignments.planId, plans.id))
    .leftJoin(
      accountMonthlyUsage,
      and(
        eq(accountMonthlyUsage.accountId, accountPlanAssignments.accountId),
        eq(accountMonthlyUsage.periodStart, periodStart),
      ),
    )
    .where(eq(accountPlanAssignments.accountId, accountId))
    .limit(1);

  const [userUsage] = await db
    .select({
      userId: users.id,
      monthlyLimit: plans.monthlyLimit,
      maxUnitsPerRequest: plans.maxUnitsPerRequest,
      consumedUnits: userMonthlyUsage.consumedUnits,
    })
    .from(users)
    .leftJoin(userPlanAssignments, eq(userPlanAssignments.userId, users.id))
    .leftJoin(plans, eq(userPlanAssignments.planId, plans.id))
    .leftJoin(
      userMonthlyUsage,
      and(
        eq(userMonthlyUsage.userId, users.id),
        eq(userMonthlyUsage.periodStart, periodStart),
      ),
    )
    .where(and(eq(users.accountId, accountId), eq(users.externalId, externalId)))
    .limit(1);

  return { accountUsage, userUsage };
}
