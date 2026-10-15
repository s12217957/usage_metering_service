import type { RequestHandler } from "express";
import {
  consumeUnits,
  getConsumptionHistory,
} from "../services/consumption.service";

export const consumeUnitsController: RequestHandler = async (req, res) => {
  const result = await consumeUnits({
    accountId: res.locals.accountId,
    externalId: req.body.externalId,
    units: req.body.units,
    requestId: req.body.requestId,
  });

  res.status(200).json(result);
};

export const getConsumptionHistoryController: RequestHandler = async (
  _req,
  res,
) => {
  const { page, limit } = res.locals.query;
  const history = await getConsumptionHistory(
    res.locals.accountId,
    page,
    limit,
  );

  res.status(200).json(history);
};