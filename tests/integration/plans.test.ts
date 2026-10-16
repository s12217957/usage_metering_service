import { createHash, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "../../src/db";
import { accounts, plans } from "../../src/schema";
import { and, eq } from "drizzle-orm";
import {
    assignAccountPlan,
    assignUserPlan,
    createCustomPlan,
    editCustomPlan,
    getAvailablePlans,
} from "../../src/services/plans.service";
import { seedPredefinedPlans } from "../../src/seed";


if (!process.env.DATABASE_URL?.includes("usage_metering_test")) {
    throw new Error("Integration tests must use usage_metering_test");
}

describe("custom plan management", () => {
    it("creates and updates a plan visible only to its owning account", async () => {
        let accountAId: string | undefined;
        let accountBId: string | undefined;
        let planId: string | undefined;

        try {
            const suffix = randomUUID();

            const [accountA] = await db
                .insert(accounts)
                .values({
                    name: `Plan owner ${suffix}`,
                    apiKeyHash: createHash("sha256")
                        .update(`plan-owner-${suffix}`)
                        .digest("hex"),
                })
                .returning({ id: accounts.id });

            if (!accountA) {
                throw new Error("Could not create plan owner account");
            }
            accountAId = accountA.id;

            const [accountB] = await db
                .insert(accounts)
                .values({
                    name: `Other account ${suffix}`,
                    apiKeyHash: createHash("sha256")
                        .update(`other-account-${suffix}`)
                        .digest("hex"),
                })
                .returning({ id: accounts.id });

            if (!accountB) {
                throw new Error("Could not create second test account");
            }
            accountBId = accountB.id;

            const customPlan = await createCustomPlan({
                accountId: accountA.id,
                name: `Custom plan ${suffix}`,
                scope: "user",
                monthlyLimit: 500,
                maxUnitsPerRequest: 25,
            });
            planId = customPlan.id;

            const plansForA = await getAvailablePlans(accountA.id);
            const plansForB = await getAvailablePlans(accountB.id);

            expect(plansForA.some((plan) => plan.id === customPlan.id)).toBe(true);
            expect(plansForB.some((plan) => plan.id === customPlan.id)).toBe(false);

            const updatedPlan = await editCustomPlan(
                accountA.id,
                customPlan.id,
                {
                    name: `Updated plan ${suffix}`,
                    monthlyLimit: 800,
                    maxUnitsPerRequest: 40,
                },
            );

            expect(updatedPlan).toMatchObject({
                id: customPlan.id,
                name: `Updated plan ${suffix}`,
                scope: "user",
                monthlyLimit: 800,
                maxUnitsPerRequest: 40,
            });

            await expect(
                editCustomPlan(accountB.id, customPlan.id, {
                    name: "Unauthorized update",
                    monthlyLimit: 900,
                    maxUnitsPerRequest: 50,
                }),
            ).rejects.toMatchObject({
                statusCode: 404,
                message: "Custom plan not found for this account",
            });
        } finally {
            await db.transaction(async (tx) => {
                if (planId) {
                    await tx.delete(plans).where(eq(plans.id, planId));
                }

                if (accountAId) {
                    await tx.delete(accounts).where(eq(accounts.id, accountAId));
                }

                if (accountBId) {
                    await tx.delete(accounts).where(eq(accounts.id, accountBId));
                }
            });
        }
    });


    it("keeps predefined plans read-only and enforces their scope", async () => {
        let accountId: string | undefined;

        try {
            await seedPredefinedPlans();

            const suffix = randomUUID();
            const [account] = await db
                .insert(accounts)
                .values({
                    name: `Scope test account ${suffix}`,
                    apiKeyHash: createHash("sha256")
                        .update(`scope-test-${suffix}`)
                        .digest("hex"),
                })
                .returning({ id: accounts.id });

            if (!account) {
                throw new Error("Could not create scope test account");
            }
            accountId = account.id;

            const [starterPlan] = await db
                .select({ id: plans.id })
                .from(plans)
                .where(
                    and(
                        eq(plans.name, "Starter"),
                        eq(plans.scope, "account"),
                        eq(plans.isPredefined, true),
                    ),
                )
                .limit(1);

            const [basicPlan] = await db
                .select({ id: plans.id })
                .from(plans)
                .where(
                    and(
                        eq(plans.name, "Basic"),
                        eq(plans.scope, "user"),
                        eq(plans.isPredefined, true),
                    ),
                )
                .limit(1);

            if (!starterPlan || !basicPlan) {
                throw new Error("Predefined test plans are missing");
            }

            await expect(
                assignAccountPlan(account.id, basicPlan.id),
            ).rejects.toMatchObject({
                statusCode: 404,
                message: "Account plan is not available for this account",
            });

            await expect(
                assignUserPlan(account.id, "some-user", starterPlan.id),
            ).rejects.toMatchObject({
                statusCode: 404,
                message: "User plan is not available for this account",
            });

            await expect(
                editCustomPlan(account.id, starterPlan.id, {
                    name: "Changed Starter",
                    monthlyLimit: 999,
                    maxUnitsPerRequest: 10,
                }),
            ).rejects.toMatchObject({
                statusCode: 404,
                message: "Custom plan not found for this account",
            });
        } finally {
            if (accountId) {
                await db.delete(accounts).where(eq(accounts.id, accountId));
            }
        }
    });
});

afterAll(async () => {
    await db.$client.end();
});