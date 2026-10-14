import type { RequestHandler } from "express";
import { getCurrentUsage } from "../services/usage.service";

export const getCurrentUsageController: RequestHandler = async (req, res) => {
  const externalId = req.query.externalId;

  if (typeof externalId !== "string" || externalId.trim().length === 0) {
    res.status(400).json({ error: "externalId query parameter is required" });
    return;
  }

  try {
    const usage = await getCurrentUsage(
      res.locals.accountId,
      externalId.trim(),
    );

    res.status(200).json(usage);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "User not found in this account") {
      res.status(404).json({ error: "User not found in this account" });
      return;
    }

    console.error("Current usage lookup failed:", error);
    res.status(500).json({ error: "Could not get current usage" });
  }
};
