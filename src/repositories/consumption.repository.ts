import { and, eq, sql, desc } from "drizzle-orm";
import { db } from "../db";
import {
  accountMonthlyUsage,
  accountPlanAssignments,
  accounts,
  consumptionRequests,
  plans,
  userMonthlyUsage,
  userPlanAssignments,
  users,
} from "../schema";
import { evaluateConsumption } from "../domain/consumptionRules";
import { ConsumptionError } from "../domain/consumptionErrors";

export async function processConsumptionRequest(input: {
  accountId: string;
  externalId: string;
  units: number;
  requestId: string;
}) {
  const { accountId, externalId, units, requestId } = input;

  return db.transaction(async (tx) => {
    const [account] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .for("update");

    if (!account) {
      throw new ConsumptionError("ACCOUNT_NOT_FOUND");
    }

    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.accountId, accountId),
          eq(users.externalId, externalId),
        ),
      )
      .limit(1);

    if (!user) {
      throw new ConsumptionError("USER_NOT_FOUND");
    }

    const [previousRequest] = await tx
      .select({
        userId: consumptionRequests.userId,
        units: consumptionRequests.units,
        decision: consumptionRequests.decision,
        rejectionLevel: consumptionRequests.rejectionLevel,
        rejectionReason: consumptionRequests.rejectionReason,
      })
      .from(consumptionRequests)
      .where(
        and(
          eq(consumptionRequests.accountId, accountId),
          eq(consumptionRequests.requestId, requestId),
        ),
      )
      .limit(1);

    if (previousRequest) {
      if (
        previousRequest.userId !== user.id ||
        previousRequest.units !== units
      ) {
        throw new ConsumptionError("REQUEST_ID_CONFLICT");
      }

      return {
        decision: previousRequest.decision,
        rejectionLevel: previousRequest.rejectionLevel,
        rejectionReason: previousRequest.rejectionReason,
      };
    }

    const [accountPlan] = await tx
      .select({
        monthlyLimit: plans.monthlyLimit,
        maxUnitsPerRequest: plans.maxUnitsPerRequest,
      })
      .from(accountPlanAssignments)
      .innerJoin(plans, eq(accountPlanAssignments.planId, plans.id))
      .where(eq(accountPlanAssignments.accountId, accountId))
      .limit(1);

    const [userPlan] = await tx
      .select({
        monthlyLimit: plans.monthlyLimit,
        maxUnitsPerRequest: plans.maxUnitsPerRequest,
      })
      .from(userPlanAssignments)
      .innerJoin(plans, eq(userPlanAssignments.planId, plans.id))
      .where(eq(userPlanAssignments.userId, user.id))
      .limit(1);

    if (!accountPlan || !userPlan) {
      throw new Error("A plan assignment is missing");
    }

    const periodStart = `${new Date().toISOString().slice(0, 7)}-01`;

    const [accountUsage] = await tx
      .select({ consumedUnits: accountMonthlyUsage.consumedUnits })
      .from(accountMonthlyUsage)
      .where(
        and(
          eq(accountMonthlyUsage.accountId, accountId),
          eq(accountMonthlyUsage.periodStart, periodStart),
        ),
      )
      .limit(1);

    const [userUsage] = await tx
      .select({ consumedUnits: userMonthlyUsage.consumedUnits })
      .from(userMonthlyUsage)
      .where(
        and(
          eq(userMonthlyUsage.userId, user.id),
          eq(userMonthlyUsage.periodStart, periodStart),
        ),
      )
      .limit(1);

    const result = evaluateConsumption({
      units,
      account: {
        ...accountPlan,
        consumedUnits: accountUsage?.consumedUnits ?? 0,
      },
      user: {
        ...userPlan,
        consumedUnits: userUsage?.consumedUnits ?? 0,
      },
    });

    if (result.decision === "accepted") {
      await tx
        .insert(accountMonthlyUsage)
        .values({ accountId, periodStart, consumedUnits: units })
        .onConflictDoUpdate({
          target: [
            accountMonthlyUsage.accountId,
            accountMonthlyUsage.periodStart,
          ],
          set: {
            consumedUnits: sql`${accountMonthlyUsage.consumedUnits} + ${units}`,
          },
        });

      await tx
        .insert(userMonthlyUsage)
        .values({ userId: user.id, periodStart, consumedUnits: units })
        .onConflictDoUpdate({
          target: [userMonthlyUsage.userId, userMonthlyUsage.periodStart],
          set: {
            consumedUnits: sql`${userMonthlyUsage.consumedUnits} + ${units}`,
          },
        });
    }

    await tx.insert(consumptionRequests).values({
      accountId,
      userId: user.id,
      requestId,
      units,
      decision: result.decision,
      rejectionLevel: result.rejectionLevel,
      rejectionReason: result.rejectionReason,
    });

    return result;
  });
}



export async function findConsumptionHistory(
  accountId: string,
  limit: number,
  offset: number,
) {
  return db
    .select({
      externalId: users.externalId,
      requestId: consumptionRequests.requestId,
      units: consumptionRequests.units,
      decision: consumptionRequests.decision,
      rejectionLevel: consumptionRequests.rejectionLevel,
      rejectionReason: consumptionRequests.rejectionReason,
      createdAt: consumptionRequests.createdAt,
    })
    .from(consumptionRequests)
    .innerJoin(users, eq(consumptionRequests.userId, users.id))
    .where(eq(consumptionRequests.accountId, accountId))
    .orderBy(desc(consumptionRequests.createdAt), desc(consumptionRequests.id))
    .limit(limit)
    .offset(offset);
}
