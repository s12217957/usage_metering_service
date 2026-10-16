import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { authenticateAccount } from "../../src/middleware/authenticateAccount";
import { findAccountByApiKeyHash } from "../../src/repositories/accounts.repository";

vi.mock("../../src/repositories/accounts.repository", () => ({
  findAccountByApiKeyHash: vi.fn(),
}));

const findAccountMock = vi.mocked(findAccountByApiKeyHash);

const app = express();

app.get("/protected", authenticateAccount, (_req, res) => {
  res.json({ accountId: res.locals.accountId });
});

describe("authenticateAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a request without an API key", async () => {
    const response = await request(app).get("/protected");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Missing API key" });
    expect(findAccountMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid API key", async () => {
    findAccountMock.mockResolvedValue(undefined);

    const response = await request(app)
      .get("/protected")
      .set("X-API-Key", "invalid-key");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Invalid API key" });
  });

  it("sets the account ID when the API key is valid", async () => {
    const apiKey = "valid-test-key";
    findAccountMock.mockResolvedValue({ id: "account-123" });

    const response = await request(app)
      .get("/protected")
      .set("X-API-Key", apiKey);

    const expectedHash = createHash("sha256").update(apiKey).digest("hex");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ accountId: "account-123" });
    expect(findAccountMock).toHaveBeenCalledWith(expectedHash);
  });
});