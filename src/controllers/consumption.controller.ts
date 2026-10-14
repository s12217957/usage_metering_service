import type { RequestHandler } from "express";
import {
  consumeUnits,
  getConsumptionHistory,
} from "../services/consumption.service";

export const consumeUnitsController: RequestHandler = async (req, res) => {
  try {
    const result = await consumeUnits({
      accountId: res.locals.accountId,
      externalId: req.body.externalId,
      units: req.body.units,
      requestId: req.body.requestId,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === "Account not found" ||
        error.message === "User not found in this account"
      ) {
        res.status(404).json({ error: error.message });
        return;
      }

      if (error.message === "Request ID was already used with different data") {
        res.status(409).json({ error: error.message });
        return;
      }
    }

    console.error("Consumption request failed:", error);
    res.status(500).json({ error: "Could not process consumption request" });
  }
};

export const getConsumptionHistoryController: RequestHandler = async (
  req,
  res,
) => {
  const pageQuery = req.query.page ?? "1";
  const limitQuery = req.query.limit ?? "20";

  if (
    typeof pageQuery !== "string" ||
    typeof limitQuery !== "string"
  ) {
    res.status(400).json({ error: "page and limit must be single values" });
    return;
  }

  const page = Number(pageQuery);
  const limit = Number(limitQuery);

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    res.status(400).json({
      error: "page must be positive; limit must be between 1 and 100",
    });
    return;
  }

  try {
    const history = await getConsumptionHistory(
      res.locals.accountId,
      page,
      limit,
    );

    res.status(200).json(history);
  } catch (error) {
    console.error("Consumption history lookup failed:", error);
    res.status(500).json({ error: "Could not get consumption history" });
  }
};
