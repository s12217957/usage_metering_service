import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { findAccountByApiKeyHash } from "../repositories/accounts.repository";

export const authenticateAccount: RequestHandler = async (req, res, next) => {
  const apiKey = req.header("X-API-Key");

  if (!apiKey) {
    res.status(401).json({ error: "Missing API key" });
    return;
  }

  const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");
  const account = await findAccountByApiKeyHash(apiKeyHash);

  if (!account) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }

  res.locals.accountId = account.id;
  next();
};