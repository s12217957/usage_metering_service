import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "../../src/db";
import {
    accountMonthlyUsage,
    consumptionRequests,
    userMonthlyUsage,
    userPlanAssignments,
    users,
} from "../../src/schema";
import { consumeUnits } from "../../src/services/consumption.service";
import {
    createConsumptionFixture,
    removeConsumptionFixture,
} from "../fixtures/consumption.fixture";


if (!process.env.DATABASE_URL?.includes("usage_metering_test")) {
    throw new Error("Integration tests must use usage_metering_test");
}


describe("consumption processing", () => {
    it("does not count the same request twice", async () => {
        const fixture = await createConsumptionFixture();

        try {
            const input = {
                accountId: fixture.accountId,
                externalId: fixture.externalId,
                units: 5,
                requestId: fixture.requestId,
            };

            const firstResult = await consumeUnits(input);
            const retryResult = await consumeUnits(input);

            expect(firstResult.decision).toBe("accepted");
            expect(retryResult).toEqual(firstResult);

            const accountUsages = await db
                .select({ consumedUnits: accountMonthlyUsage.consumedUnits })
                .from(accountMonthlyUsage)
                .where(eq(accountMonthlyUsage.accountId, fixture.accountId));

            const userUsages = await db
                .select({ consumedUnits: userMonthlyUsage.consumedUnits })
                .from(userMonthlyUsage)
                .where(eq(userMonthlyUsage.userId, fixture.userId));

            const requests = await db
                .select({ id: consumptionRequests.id })
                .from(consumptionRequests)
                .where(
                    and(
                        eq(consumptionRequests.accountId, fixture.accountId),
                        eq(consumptionRequests.requestId, fixture.requestId),
                    ),
                );

            expect(accountUsages).toHaveLength(1);
            expect(accountUsages[0].consumedUnits).toBe(5);
            expect(userUsages).toHaveLength(1);
            expect(userUsages[0].consumedUnits).toBe(5);
            expect(requests).toHaveLength(1);
        } finally {
            await removeConsumptionFixture(fixture);
        }
    });

    it("counts concurrent retries with the same request ID only once", async () => {
        const fixture = await createConsumptionFixture();

        try {
            const input = {
                accountId: fixture.accountId,
                externalId: fixture.externalId,
                units: 5,
                requestId: fixture.requestId,
            };

            const results = await Promise.all([
                consumeUnits(input),
                consumeUnits(input),
            ]);

            expect(results[0].decision).toBe("accepted");
            expect(results[1]).toEqual(results[0]);

            const accountUsages = await db
                .select({ consumedUnits: accountMonthlyUsage.consumedUnits })
                .from(accountMonthlyUsage)
                .where(eq(accountMonthlyUsage.accountId, fixture.accountId));

            const userUsages = await db
                .select({ consumedUnits: userMonthlyUsage.consumedUnits })
                .from(userMonthlyUsage)
                .where(eq(userMonthlyUsage.userId, fixture.userId));

            const requests = await db
                .select({ id: consumptionRequests.id })
                .from(consumptionRequests)
                .where(
                    and(
                        eq(consumptionRequests.accountId, fixture.accountId),
                        eq(consumptionRequests.requestId, fixture.requestId),
                    ),
                );

            expect(accountUsages).toEqual([{ consumedUnits: 5 }]);
            expect(userUsages).toEqual([{ consumedUnits: 5 }]);
            expect(requests).toHaveLength(1);
        } finally {
            await removeConsumptionFixture(fixture);
        }
    });
    it("records an account per-request-limit rejection without changing usage", async () => {
        const fixture = await createConsumptionFixture();

        try {
            const result = await consumeUnits({
                accountId: fixture.accountId,
                externalId: fixture.externalId,
                units: 101,
                requestId: fixture.requestId,
            });

            expect(result).toMatchObject({
                decision: "rejected",
                rejectionLevel: "account",
                rejectionReason: "max_units_per_request",
            });

            const accountUsages = await db
                .select({ consumedUnits: accountMonthlyUsage.consumedUnits })
                .from(accountMonthlyUsage)
                .where(eq(accountMonthlyUsage.accountId, fixture.accountId));

            const userUsages = await db
                .select({ consumedUnits: userMonthlyUsage.consumedUnits })
                .from(userMonthlyUsage)
                .where(eq(userMonthlyUsage.userId, fixture.userId));

            const requests = await db
                .select({
                    decision: consumptionRequests.decision,
                    rejectionLevel: consumptionRequests.rejectionLevel,
                    rejectionReason: consumptionRequests.rejectionReason,
                })
                .from(consumptionRequests)
                .where(
                    and(
                        eq(consumptionRequests.accountId, fixture.accountId),
                        eq(consumptionRequests.requestId, fixture.requestId),
                    ),
                );

            expect(accountUsages).toHaveLength(0);
            expect(userUsages).toHaveLength(0);
            expect(requests).toEqual([
                {
                    decision: "rejected",
                    rejectionLevel: "account",
                    rejectionReason: "max_units_per_request",
                },
            ]);
        } finally {
            await removeConsumptionFixture(fixture);
        }
    });

    it("records a user monthly-limit rejection without changing usage", async () => {
        const fixture = await createConsumptionFixture();

        try {
            const periodStart = `${new Date().toISOString().slice(0, 7)}-01`;

            await db.insert(userMonthlyUsage).values({
                userId: fixture.userId,
                periodStart,
                consumedUnits: 995,
            });

            const result = await consumeUnits({
                accountId: fixture.accountId,
                externalId: fixture.externalId,
                units: 10,
                requestId: fixture.requestId,
            });

            expect(result).toMatchObject({
                decision: "rejected",
                rejectionLevel: "user",
                rejectionReason: "monthly_limit",
            });

            const accountUsages = await db
                .select({ consumedUnits: accountMonthlyUsage.consumedUnits })
                .from(accountMonthlyUsage)
                .where(eq(accountMonthlyUsage.accountId, fixture.accountId));

            const userUsages = await db
                .select({ consumedUnits: userMonthlyUsage.consumedUnits })
                .from(userMonthlyUsage)
                .where(eq(userMonthlyUsage.userId, fixture.userId));

            const requests = await db
                .select({
                    decision: consumptionRequests.decision,
                    rejectionLevel: consumptionRequests.rejectionLevel,
                    rejectionReason: consumptionRequests.rejectionReason,
                })
                .from(consumptionRequests)
                .where(
                    and(
                        eq(consumptionRequests.accountId, fixture.accountId),
                        eq(consumptionRequests.requestId, fixture.requestId),
                    ),
                );

            expect(accountUsages).toHaveLength(0);
            expect(userUsages).toEqual([{ consumedUnits: 995 }]);
            expect(requests).toEqual([
                {
                    decision: "rejected",
                    rejectionLevel: "user",
                    rejectionReason: "monthly_limit",
                },
            ]);
        } finally {
            await removeConsumptionFixture(fixture);
        }
    });

    it("rejects reusing a request ID with different units without counting it again", async () => {
        const fixture = await createConsumptionFixture();

        try {
            const firstResult = await consumeUnits({
                accountId: fixture.accountId,
                externalId: fixture.externalId,
                units: 5,
                requestId: fixture.requestId,
            });

            expect(firstResult.decision).toBe("accepted");

            await expect(
                consumeUnits({
                    accountId: fixture.accountId,
                    externalId: fixture.externalId,
                    units: 6,
                    requestId: fixture.requestId,
                })
            ).rejects.toMatchObject({
                statusCode: 409,
                message: "Request ID was already used with different data",
            });

            const accountUsages = await db
                .select({ consumedUnits: accountMonthlyUsage.consumedUnits })
                .from(accountMonthlyUsage)
                .where(eq(accountMonthlyUsage.accountId, fixture.accountId));

            const userUsages = await db
                .select({ consumedUnits: userMonthlyUsage.consumedUnits })
                .from(userMonthlyUsage)
                .where(eq(userMonthlyUsage.userId, fixture.userId));

            const requests = await db
                .select({ id: consumptionRequests.id })
                .from(consumptionRequests)
                .where(
                    and(
                        eq(consumptionRequests.accountId, fixture.accountId),
                        eq(consumptionRequests.requestId, fixture.requestId),
                    ),
                );

            expect(accountUsages).toEqual([{ consumedUnits: 5 }]);
            expect(userUsages).toEqual([{ consumedUnits: 5 }]);
            expect(requests).toHaveLength(1);
        } finally {
            await removeConsumptionFixture(fixture);
        }
    });

    it("keeps usage separate when different accounts use the same request ID", async () => {
        const fixtureA = await createConsumptionFixture();
        const fixtureB = await createConsumptionFixture();
        try {

            const sharedRequestId = "shared-request-id";

            const resultA = await consumeUnits({
                accountId: fixtureA.accountId,
                externalId: fixtureA.externalId,
                units: 5,
                requestId: sharedRequestId,
            });

            const resultB = await consumeUnits({
                accountId: fixtureB.accountId,
                externalId: fixtureB.externalId,
                units: 7,
                requestId: sharedRequestId,
            });

            expect(resultA.decision).toBe("accepted");
            expect(resultB.decision).toBe("accepted");

            const accountUsageA = await db
                .select({ consumedUnits: accountMonthlyUsage.consumedUnits })
                .from(accountMonthlyUsage)
                .where(eq(accountMonthlyUsage.accountId, fixtureA.accountId));

            const accountUsageB = await db
                .select({ consumedUnits: accountMonthlyUsage.consumedUnits })
                .from(accountMonthlyUsage)
                .where(eq(accountMonthlyUsage.accountId, fixtureB.accountId));

            const userUsageA = await db
                .select({ consumedUnits: userMonthlyUsage.consumedUnits })
                .from(userMonthlyUsage)
                .where(eq(userMonthlyUsage.userId, fixtureA.userId));

            const userUsageB = await db
                .select({ consumedUnits: userMonthlyUsage.consumedUnits })
                .from(userMonthlyUsage)
                .where(eq(userMonthlyUsage.userId, fixtureB.userId));

            expect(accountUsageA).toEqual([{ consumedUnits: 5 }]);
            expect(accountUsageB).toEqual([{ consumedUnits: 7 }]);
            expect(userUsageA).toEqual([{ consumedUnits: 5 }]);
            expect(userUsageB).toEqual([{ consumedUnits: 7 }]);
        } finally {
            await removeConsumptionFixture(fixtureA);
            await removeConsumptionFixture(fixtureB);

        }
    });


    it("enforces the account limit when concurrent requests reach it", async () => {
        const fixture = await createConsumptionFixture();

        try {
            const periodStart = `${new Date().toISOString().slice(0, 7)}-01`;

            await db.insert(accountMonthlyUsage).values({
                accountId: fixture.accountId,
                periodStart,
                consumedUnits: 995,
            });

            const results = await Promise.all([
                consumeUnits({
                    accountId: fixture.accountId,
                    externalId: fixture.externalId,
                    units: 5,
                    requestId: `${fixture.requestId}-parallel-a`,
                }),
                consumeUnits({
                    accountId: fixture.accountId,
                    externalId: fixture.externalId,
                    units: 5,
                    requestId: `${fixture.requestId}-parallel-b`,
                }),
            ]);

            expect(results.filter((result) => result.decision === "accepted"))
                .toHaveLength(1);
            expect(results.filter((result) => result.decision === "rejected"))
                .toHaveLength(1);

            const rejected = results.find((result) => result.decision === "rejected");
            expect(rejected).toMatchObject({
                rejectionLevel: "account",
                rejectionReason: "monthly_limit",
            });

            const accountUsages = await db
                .select({ consumedUnits: accountMonthlyUsage.consumedUnits })
                .from(accountMonthlyUsage)
                .where(eq(accountMonthlyUsage.accountId, fixture.accountId));

            const userUsages = await db
                .select({ consumedUnits: userMonthlyUsage.consumedUnits })
                .from(userMonthlyUsage)
                .where(eq(userMonthlyUsage.userId, fixture.userId));

            expect(accountUsages).toEqual([{ consumedUnits: 1000 }]);
            expect(userUsages).toEqual([{ consumedUnits: 5 }]);
        } finally {
            await removeConsumptionFixture(fixture);
        }
    });

    it("enforces the user limit when concurrent requests reach it", async () => {
        const fixture = await createConsumptionFixture();

        try {
            const periodStart = `${new Date().toISOString().slice(0, 7)}-01`;

            await db.insert(userMonthlyUsage).values({
                userId: fixture.userId,
                periodStart,
                consumedUnits: 995,
            });

            const results = await Promise.all([
                consumeUnits({
                    accountId: fixture.accountId,
                    externalId: fixture.externalId,
                    units: 5,
                    requestId: `${fixture.requestId}-parallel-a`,
                }),
                consumeUnits({
                    accountId: fixture.accountId,
                    externalId: fixture.externalId,
                    units: 5,
                    requestId: `${fixture.requestId}-parallel-b`,
                }),
            ]);

            expect(results.filter((result) => result.decision === "accepted"))
                .toHaveLength(1);
            expect(results.filter((result) => result.decision === "rejected"))
                .toHaveLength(1);

            const rejected = results.find((result) => result.decision === "rejected");
            expect(rejected).toMatchObject({
                rejectionLevel: "user",
                rejectionReason: "monthly_limit",
            });

            const accountUsages = await db
                .select({ consumedUnits: accountMonthlyUsage.consumedUnits })
                .from(accountMonthlyUsage)
                .where(eq(accountMonthlyUsage.accountId, fixture.accountId));

            const userUsages = await db
                .select({ consumedUnits: userMonthlyUsage.consumedUnits })
                .from(userMonthlyUsage)
                .where(eq(userMonthlyUsage.userId, fixture.userId));

            expect(accountUsages).toEqual([{ consumedUnits: 5 }]);
            expect(userUsages).toEqual([{ consumedUnits: 1000 }]);
        } finally {
            await removeConsumptionFixture(fixture);
        }
    });

    it("rejects reusing a request ID for a different user in the same account", async () => {
        const fixture = await createConsumptionFixture();
        let secondUserId: string | undefined;

        try {
            const [existingAssignment] = await db
                .select({ planId: userPlanAssignments.planId })
                .from(userPlanAssignments)
                .where(eq(userPlanAssignments.userId, fixture.userId));

            if (!existingAssignment) {
                throw new Error("Test user plan assignment is missing");
            }

            const secondExternalId = `second-user-${randomUUID()}`;

            const [secondUser] = await db
                .insert(users)
                .values({
                    accountId: fixture.accountId,
                    externalId: secondExternalId,
                })
                .returning({ id: users.id });

            if (!secondUser) {
                throw new Error("Could not create second test user");
            }

            secondUserId = secondUser.id;

            await db.insert(userPlanAssignments).values({
                userId: secondUser.id,
                planId: existingAssignment.planId,
            });

            const firstResult = await consumeUnits({
                accountId: fixture.accountId,
                externalId: fixture.externalId,
                units: 5,
                requestId: fixture.requestId,
            });

            expect(firstResult.decision).toBe("accepted");

            await expect(
                consumeUnits({
                    accountId: fixture.accountId,
                    externalId: secondExternalId,
                    units: 5,
                    requestId: fixture.requestId,
                }),
            ).rejects.toMatchObject({
                statusCode: 409,
                message: "Request ID was already used with different data",
            });

            const accountUsages = await db
                .select({ consumedUnits: accountMonthlyUsage.consumedUnits })
                .from(accountMonthlyUsage)
                .where(eq(accountMonthlyUsage.accountId, fixture.accountId));

            const userUsages = await db
                .select({ consumedUnits: userMonthlyUsage.consumedUnits })
                .from(userMonthlyUsage)
                .where(eq(userMonthlyUsage.userId, fixture.userId));

            const requests = await db
                .select({ id: consumptionRequests.id })
                .from(consumptionRequests)
                .where(
                    and(
                        eq(consumptionRequests.accountId, fixture.accountId),
                        eq(consumptionRequests.requestId, fixture.requestId),
                    ),
                );

            expect(accountUsages).toEqual([{ consumedUnits: 5 }]);
            expect(userUsages).toEqual([{ consumedUnits: 5 }]);
            expect(requests).toHaveLength(1);
        } finally {
            if (secondUserId) {
                await db
                    .delete(userPlanAssignments)
                    .where(eq(userPlanAssignments.userId, secondUserId));

                await db
                    .delete(userMonthlyUsage)
                    .where(eq(userMonthlyUsage.userId, secondUserId));

                await db.delete(users).where(eq(users.id, secondUserId));
            }

            await removeConsumptionFixture(fixture);
        }
    });

});


afterAll(async () => {
    await db.$client.end();
});



