import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import {
    accountMonthlyUsage,
    plans,
    userMonthlyUsage,
} from "../../src/schema";
import {
    assignAccountPlan,
    assignUserPlan,
} from "../../src/services/plans.service";
import { consumeUnits } from "../../src/services/consumption.service";
import { getCurrentUsage } from "../../src/services/usage.service";
import {
    createConsumptionFixture,
    removeConsumptionFixture,
} from "../fixtures/consumption.fixture";

if (!process.env.DATABASE_URL?.includes("usage_metering_test")) {
    throw new Error("Integration tests must use usage_metering_test");
}



describe("plan changes", () => {
    it("preserves user usage when the new plan limit is lower", async () => {
        const fixture = await createConsumptionFixture();

        try {
            const periodStart = `${new Date().toISOString().slice(0, 7)}-01`;

            const [reducedPlan] = await db
                .insert(plans)
                .values({
                    name: `Reduced user plan ${randomUUID()}`,
                    scope: "user",
                    monthlyLimit: 20,
                    maxUnitsPerRequest: 10,
                    ownerAccountId: fixture.accountId,
                })
                .returning({ id: plans.id });

            if (!reducedPlan) {
                throw new Error("Could not create reduced user plan");
            }

            await db.insert(userMonthlyUsage).values({
                userId: fixture.userId,
                periodStart,
                consumedUnits: 25,
            });

            await assignUserPlan(
                fixture.accountId,
                fixture.externalId,
                reducedPlan.id,
            );

            const usage = await getCurrentUsage(
                fixture.accountId,
                fixture.externalId,
            );

            expect(usage.user).toEqual({
                monthlyLimit: 20,
                maxUnitsPerRequest: 10,
                consumedUnits: 25,
                remainingUnits: 0,
            });

            const result = await consumeUnits({
                accountId: fixture.accountId,
                externalId: fixture.externalId,
                units: 1,
                requestId: fixture.requestId,
            });

            expect(result).toMatchObject({
                decision: "rejected",
                rejectionLevel: "user",
                rejectionReason: "monthly_limit",
            });

            const userUsages = await db
                .select({ consumedUnits: userMonthlyUsage.consumedUnits })
                .from(userMonthlyUsage)
                .where(eq(userMonthlyUsage.userId, fixture.userId));

            expect(userUsages).toEqual([{ consumedUnits: 25 }]);
        } finally {
            await removeConsumptionFixture(fixture);
        }
    });

    it("preserves account usage when the new plan limit is lower", async () => {
        const fixture = await createConsumptionFixture();

        try {
            const periodStart = `${new Date().toISOString().slice(0, 7)}-01`;

            const [reducedPlan] = await db
                .insert(plans)
                .values({
                    name: `Reduced account plan ${randomUUID()}`,
                    scope: "account",
                    monthlyLimit: 20,
                    maxUnitsPerRequest: 10,
                    ownerAccountId: fixture.accountId,
                })
                .returning({ id: plans.id });

            if (!reducedPlan) {
                throw new Error("Could not create reduced account plan");
            }

            await db.insert(accountMonthlyUsage).values({
                accountId: fixture.accountId,
                periodStart,
                consumedUnits: 25,
            });

            await assignAccountPlan(fixture.accountId, reducedPlan.id);

            const usage = await getCurrentUsage(
                fixture.accountId,
                fixture.externalId,
            );

            expect(usage.account).toEqual({
                monthlyLimit: 20,
                maxUnitsPerRequest: 10,
                consumedUnits: 25,
                remainingUnits: 0,
            });

            const result = await consumeUnits({
                accountId: fixture.accountId,
                externalId: fixture.externalId,
                units: 1,
                requestId: fixture.requestId,
            });

            expect(result).toMatchObject({
                decision: "rejected",
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

            expect(accountUsages).toEqual([{ consumedUnits: 25 }]);
            expect(userUsages).toHaveLength(0);
        } finally {
            await removeConsumptionFixture(fixture);
        }
    });
});

afterAll(async () => {
    await db.$client.end();
});

