import { createHash, randomBytes, randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import { accounts } from "../../src/schema";
import { authenticateAccount } from "../../src/middleware/authenticateAccount";

if (!process.env.DATABASE_URL?.includes("usage_metering_test")) {
  throw new Error("Integration tests must use usage_metering_test");
}

const app = express();

app.get("/protected", authenticateAccount, (_req, res) => {
  res.json({ accountId: res.locals.accountId });
});

let accountId: string;
let apiKey: string;

beforeAll(async () => {
  apiKey = randomBytes(32).toString("hex");

  const [account] = await db
    .insert(accounts)
    .values({
      name: `Authentication test ${randomUUID()}`,
      apiKeyHash: createHash("sha256").update(apiKey).digest("hex"),
    })
    .returning({ id: accounts.id });

  if (!account) {
    throw new Error("Could not create authentication test account");
  }

  accountId = account.id;
});

afterAll(async () => {
  try {
    if (accountId) {
      await db.delete(accounts).where(eq(accounts.id, accountId));
    }
  } finally {
    await db.$client.end();
  }
});

describe("API key authentication with PostgreSQL", () => {
  it("rejects a request without an API key", async () => {
    const response = await request(app).get("/protected");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Missing API key" });
  });

  it("rejects an API key that is not stored in the database", async () => {
    const response = await request(app)
      .get("/protected")
      .set("X-API-Key", "invalid-key");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Invalid API key" });
  });

  it("finds the account belonging to a valid API key", async () => {
    const response = await request(app)
      .get("/protected")
      .set("X-API-Key", apiKey);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ accountId });
  });
});