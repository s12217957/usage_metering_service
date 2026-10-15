import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { userPlanAssignments, users } from "../schema";

export async function createUserWithPlan(
  accountId: string,
  externalId: string,
  planId: string,
) {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ accountId, externalId })
      .returning({
        id: users.id,
        externalId: users.externalId,
      });

    if (!user) {
      throw new Error("User was not created");
    }

    await tx.insert(userPlanAssignments).values({
      userId: user.id,
      planId,
    });

    return user;
  });
}


export async function updateUserPlan(
  accountId: string,
  externalId: string,
  planId: string,
) {
  const [user] = await db
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
    return undefined;
  }

  const [assignment] = await db
    .update(userPlanAssignments)
    .set({ planId })
    .where(eq(userPlanAssignments.userId, user.id))
    .returning({
      userId: userPlanAssignments.userId,
      planId: userPlanAssignments.planId,
    });

  if (!assignment) {
    throw new Error("User plan assignment was not found");
  }

  return assignment;
}
