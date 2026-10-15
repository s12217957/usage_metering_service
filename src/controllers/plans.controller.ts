import type { RequestHandler } from "express";
import {
  createCustomPlan,
  getAvailablePlans,
  assignAccountPlan,
  assignUserPlan,
  editCustomPlan,
} from "../services/plans.service";

export const createCustomPlanController: RequestHandler = async (
  req,
  res,
) => {
  const plan = await createCustomPlan({
    accountId: res.locals.accountId,
    name: req.body.name,
    scope: req.body.scope,
    monthlyLimit: req.body.monthlyLimit,
    maxUnitsPerRequest: req.body.maxUnitsPerRequest,
  });

  res.status(201).json(plan);
};


export const listPlansController: RequestHandler = async (_req, res) => {
  const plans = await getAvailablePlans(res.locals.accountId);
  res.status(200).json({ plans });
};

export const assignAccountPlanController: RequestHandler = async (
  req,
  res,
) => {
  const assignment = await assignAccountPlan(
    res.locals.accountId,
    req.body.planId,
  );

  res.status(200).json(assignment);
};


export const assignUserPlanController: RequestHandler = async (req, res) => {
  const assignment = await assignUserPlan(
    res.locals.accountId,
    req.body.externalId,
    req.body.planId,
  );

  res.status(200).json(assignment);
};


export const editCustomPlanController: RequestHandler = async (req, res) => {
  const planId = req.params.planId as string;

  const plan = await editCustomPlan(
    res.locals.accountId,
    planId,
    {
      name: req.body.name,
      monthlyLimit: req.body.monthlyLimit,
      maxUnitsPerRequest: req.body.maxUnitsPerRequest,
    },
  );

  res.status(200).json(plan);
};