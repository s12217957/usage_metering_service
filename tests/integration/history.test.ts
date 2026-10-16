import { afterAll, describe, expect, it } from "vitest";
import { db } from "../../src/db";
import { consumptionRequests } from "../../src/schema";
import { getConsumptionHistory } from "../../src/services/consumption.service";
import {
  createConsumptionFixture,
  removeConsumptionFixture,
} from "../fixtures/consumption.fixture";

if (!process.env.DATABASE_URL?.includes("usage_metering_test")) {
  throw new Error("Integration tests must use usage_metering_test");
}

describe("consumption history", () => {
  it("returns the account's history in pages, newest first", async () => {
    const fixtureA = await createConsumptionFixture();
    const fixtureB = await createConsumptionFixture();

    try {
      await db.insert(consumptionRequests).values([
        {
          accountId: fixtureA.accountId,
          userId: fixtureA.userId,
          requestId: `${fixtureA.requestId}-old`,
          units: 1,
          decision: "accepted",
          rejectionLevel: null,
          rejectionReason: null,
          createdAt: new Date("2025-01-01T00:00:00.000Z"),
        },
        {
          accountId: fixtureA.accountId,
          userId: fixtureA.userId,
          requestId: `${fixtureA.requestId}-middle`,
          units: 2,
          decision: "accepted",
          rejectionLevel: null,
          rejectionReason: null,
          createdAt: new Date("2025-01-02T00:00:00.000Z"),
        },
        {
          accountId: fixtureA.accountId,
          userId: fixtureA.userId,
          requestId: `${fixtureA.requestId}-new`,
          units: 3,
          decision: "accepted",
          rejectionLevel: null,
          rejectionReason: null,
          createdAt: new Date("2025-01-03T00:00:00.000Z"),
        },
        {
          accountId: fixtureB.accountId,
          userId: fixtureB.userId,
          requestId: `${fixtureB.requestId}-other-account`,
          units: 4,
          decision: "accepted",
          rejectionLevel: null,
          rejectionReason: null,
          createdAt: new Date("2025-01-04T00:00:00.000Z"),
        },
      ]);

      const firstPage = await getConsumptionHistory(
        fixtureA.accountId,
        1,
        2,
      );

      const secondPage = await getConsumptionHistory(
        fixtureA.accountId,
        2,
        2,
      );

      expect(firstPage.page).toBe(1);
      expect(firstPage.limit).toBe(2);
      expect(firstPage.items.map((item) => item.requestId)).toEqual([
        `${fixtureA.requestId}-new`,
        `${fixtureA.requestId}-middle`,
      ]);

      expect(secondPage.page).toBe(2);
      expect(secondPage.limit).toBe(2);
      expect(secondPage.items.map((item) => item.requestId)).toEqual([
        `${fixtureA.requestId}-old`,
      ]);

      expect(
        [...firstPage.items, ...secondPage.items].every(
          (item) => item.externalId === fixtureA.externalId,
        ),
      ).toBe(true);
    } finally {
      await removeConsumptionFixture(fixtureA);
      await removeConsumptionFixture(fixtureB);
    }
  });
});

afterAll(async () => {
  await db.$client.end();
});