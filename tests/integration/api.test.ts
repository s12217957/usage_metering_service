import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import app from "../../src/app";
import { db } from "../../src/db";
import {
  accountMonthlyUsage,
  consumptionRequests,
  userMonthlyUsage,
} from "../../src/schema";
import {
  createConsumptionFixture,
  removeConsumptionFixture,
} from "../fixtures/consumption.fixture";

if (!process.env.DATABASE_URL?.includes("usage_metering_test")) {
  throw new Error("Integration tests must use usage_metering_test");
}

describe("HTTP API", () => {
  it("authenticates requests and keeps usage isolated by account", async () => {
    const fixtureA = await createConsumptionFixture();
    const fixtureB = await createConsumptionFixture();

    try {
      const body = {
        externalId: fixtureA.externalId,
        units: 5,
        requestId: fixtureA.requestId,
      };

      const missingKeyResponse = await request(app)
        .post("/usage/consume")
        .send(body);

      expect(missingKeyResponse.status).toBe(401);

      const invalidKeyResponse = await request(app)
        .post("/usage/consume")
        .set("X-API-Key", "invalid-api-key")
        .send(body);

      expect(invalidKeyResponse.status).toBe(401);

      const consumeResponse = await request(app)
        .post("/usage/consume")
        .set("X-API-Key", fixtureA.apiKey)
        .send(body);

      expect(consumeResponse.status).toBe(200);
      expect(consumeResponse.body).toMatchObject({
        decision: "accepted",
        requestId: fixtureA.requestId,
      });

      const ownUsageResponse = await request(app)
        .get("/usage")
        .set("X-API-Key", fixtureA.apiKey)
        .query({ externalId: fixtureA.externalId });

      expect(ownUsageResponse.status).toBe(200);
      expect(ownUsageResponse.body.account.consumedUnits).toBe(5);
      expect(ownUsageResponse.body.user.consumedUnits).toBe(5);

      const otherAccountResponse = await request(app)
        .get("/usage")
        .set("X-API-Key", fixtureB.apiKey)
        .query({ externalId: fixtureA.externalId });

      expect(otherAccountResponse.status).toBe(404);
    } finally {
      await removeConsumptionFixture(fixtureA);
      await removeConsumptionFixture(fixtureB);
    }
  });

  it("rejects invalid consumption input without writing to the database", async () => {
    const fixture = await createConsumptionFixture();

    try {
      const invalidBodies = [
        {
          externalId: fixture.externalId,
          units: 0,
          requestId: `${fixture.requestId}-zero`,
        },
        {
          externalId: fixture.externalId,
          units: 1.5,
          requestId: `${fixture.requestId}-fraction`,
        },
        {
          externalId: " ",
          units: 1,
          requestId: `${fixture.requestId}-blank-user`,
        },
      ];

      for (const body of invalidBodies) {
        const response = await request(app)
          .post("/usage/consume")
          .set("X-API-Key", fixture.apiKey)
          .send(body);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid request body");
      }

      const requests = await db
        .select({ id: consumptionRequests.id })
        .from(consumptionRequests)
        .where(eq(consumptionRequests.accountId, fixture.accountId));

      const accountUsages = await db
        .select({ consumedUnits: accountMonthlyUsage.consumedUnits })
        .from(accountMonthlyUsage)
        .where(eq(accountMonthlyUsage.accountId, fixture.accountId));

      const userUsages = await db
        .select({ consumedUnits: userMonthlyUsage.consumedUnits })
        .from(userMonthlyUsage)
        .where(eq(userMonthlyUsage.userId, fixture.userId));

      expect(requests).toHaveLength(0);
      expect(accountUsages).toHaveLength(0);
      expect(userUsages).toHaveLength(0);
    } finally {
      await removeConsumptionFixture(fixture);
    }
  });

  it("validates usage query parameters and applies history defaults", async () => {
    const fixture = await createConsumptionFixture();

    try {
      const missingExternalId = await request(app)
        .get("/usage")
        .set("X-API-Key", fixture.apiKey);

      expect(missingExternalId.status).toBe(400);
      expect(missingExternalId.body.error).toBe("Invalid request query");

      const invalidPeriod = await request(app)
        .get("/usage")
        .set("X-API-Key", fixture.apiKey)
        .query({
          externalId: fixture.externalId,
          period: "2026-13",
        });

      expect(invalidPeriod.status).toBe(400);
      expect(invalidPeriod.body.error).toBe("Invalid request query");

      const defaultHistory = await request(app)
        .get("/usage/history")
        .set("X-API-Key", fixture.apiKey);

      expect(defaultHistory.status).toBe(200);
      expect(defaultHistory.body).toEqual({
        page: 1,
        limit: 20,
        items: [],
      });

      const invalidPage = await request(app)
        .get("/usage/history")
        .set("X-API-Key", fixture.apiKey)
        .query({ page: 0 });

      expect(invalidPage.status).toBe(400);
      expect(invalidPage.body.error).toBe("Invalid request query");

      const invalidLimit = await request(app)
        .get("/usage/history")
        .set("X-API-Key", fixture.apiKey)
        .query({ limit: 101 });

      expect(invalidLimit.status).toBe(400);
      expect(invalidLimit.body.error).toBe("Invalid request query");
    } finally {
      await removeConsumptionFixture(fixture);
    }
  });

  it("validates the plan ID route parameter before editing a plan", async () => {
    const fixture = await createConsumptionFixture();

    try {
      const body = {
        name: "Updated test plan",
        monthlyLimit: 500,
        maxUnitsPerRequest: 25,
      };

      const invalidIdResponse = await request(app)
        .put("/plans/not-a-uuid")
        .set("X-API-Key", fixture.apiKey)
        .send(body);

      expect(invalidIdResponse.status).toBe(400);
      expect(invalidIdResponse.body.error).toBe(
        "Invalid route parameters",
      );

      const unknownPlanResponse = await request(app)
        .put(`/plans/${randomUUID()}`)
        .set("X-API-Key", fixture.apiKey)
        .send(body);

      expect(unknownPlanResponse.status).toBe(404);
      expect(unknownPlanResponse.body).toEqual({
        error: "Custom plan not found for this account",
      });
    } finally {
      await removeConsumptionFixture(fixture);
    }
  });

  it("manages a custom plan through the API only for its owning account", async () => {
    const fixtureA = await createConsumptionFixture();
    const fixtureB = await createConsumptionFixture();

    try {
      const suffix = randomUUID();

      const createResponse = await request(app)
        .post("/plans")
        .set("X-API-Key", fixtureA.apiKey)
        .send({
          name: `API custom plan ${suffix}`,
          scope: "user",
          monthlyLimit: 500,
          maxUnitsPerRequest: 25,
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body).toMatchObject({
        name: `API custom plan ${suffix}`,
        scope: "user",
        monthlyLimit: 500,
        maxUnitsPerRequest: 25,
      });

      const planId = createResponse.body.id;

      const plansForA = await request(app)
        .get("/plans")
        .set("X-API-Key", fixtureA.apiKey);

      const plansForB = await request(app)
        .get("/plans")
        .set("X-API-Key", fixtureB.apiKey);

      expect(plansForA.status).toBe(200);
      expect(
        plansForA.body.plans.some(
          (plan: { id: string }) => plan.id === planId,
        ),
      ).toBe(true);

      expect(plansForB.status).toBe(200);
      expect(
        plansForB.body.plans.some(
          (plan: { id: string }) => plan.id === planId,
        ),
      ).toBe(false);

      const updateResponse = await request(app)
        .put(`/plans/${planId}`)
        .set("X-API-Key", fixtureA.apiKey)
        .send({
          name: `Updated API plan ${suffix}`,
          monthlyLimit: 800,
          maxUnitsPerRequest: 40,
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body).toMatchObject({
        id: planId,
        name: `Updated API plan ${suffix}`,
        monthlyLimit: 800,
        maxUnitsPerRequest: 40,
      });

      const unauthorizedUpdate = await request(app)
        .put(`/plans/${planId}`)
        .set("X-API-Key", fixtureB.apiKey)
        .send({
          name: "Unauthorized plan update",
          monthlyLimit: 900,
          maxUnitsPerRequest: 50,
        });

      expect(unauthorizedUpdate.status).toBe(404);
    } finally {
      await removeConsumptionFixture(fixtureA);
      await removeConsumptionFixture(fixtureB);
    }
  });

  it("assigns account and user plans through the API", async () => {
    const fixtureA = await createConsumptionFixture();
    const fixtureB = await createConsumptionFixture();

    try {
      const suffix = randomUUID();

      const accountPlanResponse = await request(app)
        .post("/plans")
        .set("X-API-Key", fixtureA.apiKey)
        .send({
          name: `Assigned account plan ${suffix}`,
          scope: "account",
          monthlyLimit: 2000,
          maxUnitsPerRequest: 80,
        });

      expect(accountPlanResponse.status).toBe(201);

      const accountAssignmentResponse = await request(app)
        .put("/plans/account")
        .set("X-API-Key", fixtureA.apiKey)
        .send({ planId: accountPlanResponse.body.id });

      expect(accountAssignmentResponse.status).toBe(200);
      expect(accountAssignmentResponse.body).toMatchObject({
        accountId: fixtureA.accountId,
        planId: accountPlanResponse.body.id,
      });

      const userPlanResponse = await request(app)
        .post("/plans")
        .set("X-API-Key", fixtureA.apiKey)
        .send({
          name: `Assigned user plan ${suffix}`,
          scope: "user",
          monthlyLimit: 500,
          maxUnitsPerRequest: 25,
        });

      expect(userPlanResponse.status).toBe(201);

      const userAssignmentResponse = await request(app)
        .put("/plans/user")
        .set("X-API-Key", fixtureA.apiKey)
        .send({
          externalId: fixtureA.externalId,
          planId: userPlanResponse.body.id,
        });

      expect(userAssignmentResponse.status).toBe(200);
      expect(userAssignmentResponse.body).toMatchObject({
        userId: fixtureA.userId,
        planId: userPlanResponse.body.id,
      });

      const usageResponse = await request(app)
        .get("/usage")
        .set("X-API-Key", fixtureA.apiKey)
        .query({ externalId: fixtureA.externalId });

      expect(usageResponse.status).toBe(200);
      expect(usageResponse.body.account).toMatchObject({
        monthlyLimit: 2000,
        maxUnitsPerRequest: 80,
        consumedUnits: 0,
        remainingUnits: 2000,
      });
      expect(usageResponse.body.user).toMatchObject({
        monthlyLimit: 500,
        maxUnitsPerRequest: 25,
        consumedUnits: 0,
        remainingUnits: 500,
      });

      const otherAccountAssignment = await request(app)
        .put("/plans/user")
        .set("X-API-Key", fixtureB.apiKey)
        .send({
          externalId: fixtureB.externalId,
          planId: userPlanResponse.body.id,
        });

      expect(otherAccountAssignment.status).toBe(404);
    } finally {
      await removeConsumptionFixture(fixtureA);
      await removeConsumptionFixture(fixtureB);
    }
  });
});

afterAll(async () => {
  await db.$client.end();
});