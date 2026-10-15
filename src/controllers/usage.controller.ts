import type { RequestHandler } from "express";
import { getCurrentUsage } from "../services/usage.service";

export const getCurrentUsageController: RequestHandler = async (_req, res) => {
  const { externalId, period } = res.locals.query;

  const usage = await getCurrentUsage(
    res.locals.accountId,
    externalId,
    period,
  );

  res.status(200).json(usage);
};