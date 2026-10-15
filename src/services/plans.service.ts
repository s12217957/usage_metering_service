import {
  createCustomPlan as saveCustomPlan,
  findAvailablePlans,
  findAssignablePlan,
  updateCustomPlan,
} from "../repositories/plans.repository";

import { AppError } from "../errors/AppError";

import { updateAccountPlan } from "../repositories/accounts.repository";
import { updateUserPlan } from "../repositories/users.repository";

type CreateCustomPlanInput = {
  accountId: string;
  name: string;
  scope: "account" | "user";
  monthlyLimit: number;
  maxUnitsPerRequest: number;
};

export async function createCustomPlan(input: CreateCustomPlanInput) {
  return saveCustomPlan({
    ownerAccountId: input.accountId,
    name: input.name,
    scope: input.scope,
    monthlyLimit: input.monthlyLimit,
    maxUnitsPerRequest: input.maxUnitsPerRequest,
  });
}


export async function getAvailablePlans(accountId: string) {
  return findAvailablePlans(accountId);
}


export async function assignAccountPlan(accountId: string, planId: string) {
  const plan = await findAssignablePlan(accountId, planId, "account");

  if (!plan) {
    throw new AppError(
      404,
      "Account plan is not available for this account",
    );
  }

  return updateAccountPlan(accountId, planId);
}


export async function assignUserPlan(
  accountId: string,
  externalId: string,
  planId: string,
) {
  const plan = await findAssignablePlan(accountId, planId, "user");

  if (!plan) {
    throw new AppError(
      404,
      "User plan is not available for this account",
    );
  }

  const assignment = await updateUserPlan(accountId, externalId, planId);

  if (!assignment) {
    throw new AppError(404, "User not found in this account");
  }

  return assignment;
}

export async function editCustomPlan(
  accountId: string,
  planId: string,
  input: {
    name: string;
    monthlyLimit: number;
    maxUnitsPerRequest: number;
  },
) {
  const plan = await updateCustomPlan(accountId, planId, input);

  if (!plan) {
    throw new AppError(404, "Custom plan not found for this account");  
  }

  return plan;
}