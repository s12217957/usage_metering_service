import { db } from "../db";
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
