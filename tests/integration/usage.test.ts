import { afterAll, describe, expect, it } from "vitest";
import { db } from "../../src/db";
import { randomUUID } from "node:crypto";
import {
    accountMonthlyUsage,
    userMonthlyUsage,
} from "../../src/schema";
import { getCurrentUsage } from "../../src/services/usage.service";
import {
    createConsumptionFixture,
    removeConsumptionFixture,
} from "../fixtures/consumption.fixture";

if (!process.env.DATABASE_URL?.includes("usage_metering_test")) {
    throw new Error("Integration tests must use usage_metering_test");
}

describe("usage lookup", () => {
    it("returns current usage with limits and remaining units", async () => {
        const fixture = await createConsumptionFixture();

        try {
            const periodStart = `${new Date().toISOString().slice(0, 7)}-01`;

            await db.insert(accountMonthlyUsage).values({
                accountId: fixture.accountId,
                periodStart,
                consumedUnits: 20,
            });

            await db.insert(userMonthlyUsage).values({
                userId: fixture.userId,
                periodStart,
                consumedUnits: 5,
            });

            const result = await getCurrentUsage(
                fixture.accountId,
                fixture.externalId,
            );

            expect(result).toEqual({
                periodStart,
                account: {
                    monthlyLimit: 1000,
                    maxUnitsPerRequest: 100,
                    consumedUnits: 20,
                    remainingUnits: 980,
                },
                user: {
                    monthlyLimit: 1000,
                    maxUnitsPerRequest: 100,
                    consumedUnits: 5,
                    remainingUnits: 995,
                },
            });
        } finally {
            await removeConsumptionFixture(fixture);
        }
    });

    it("returns only consumed units for a previous month", async () => {
        const fixture = await createConsumptionFixture();

        try {
            const now = new Date();
            const previousMonth = new Date(
                Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
            )
                .toISOString()
                .slice(0, 7);

            const periodStart = `${previousMonth}-01`;

            await db.insert(accountMonthlyUsage).values({
                accountId: fixture.accountId,
                periodStart,
                consumedUnits: 120,
            });

            await db.insert(userMonthlyUsage).values({
                userId: fixture.userId,
                periodStart,
                consumedUnits: 30,
            });

            const result = await getCurrentUsage(
                fixture.accountId,
                fixture.externalId,
                previousMonth,
            );

            expect(result).toEqual({
                periodStart,
                account: {
                    consumedUnits: 120,
                },
                user: {
                    consumedUnits: 30,
                },
            });
        } finally {
            await removeConsumptionFixture(fixture);
        }
    });

    it("rejects a future usage period", async () => {
        const now = new Date();
        const futurePeriod = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
        )
            .toISOString()
            .slice(0, 7);

        await expect(
            getCurrentUsage("unused-account-id", "unused-user-id", futurePeriod),
        ).rejects.toMatchObject({
            statusCode: 400,
            message: "Future usage periods are not available",
        });
    });

    it("returns not found when the user does not belong to the account", async () => {
        const fixture = await createConsumptionFixture();

        try {
            await expect(
                getCurrentUsage(
                    fixture.accountId,
                    `unknown-user-${randomUUID()}`,
                ),
            ).rejects.toMatchObject({
                statusCode: 404,
                message: "User not found in this account",
            });
        } finally {
            await removeConsumptionFixture(fixture);
        }
    });

});

afterAll(async () => {
    await db.$client.end();
});