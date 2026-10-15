import {
  findConsumptionHistory,
  processConsumptionRequest,
} from "../repositories/consumption.repository";
import { ConsumptionError } from "../domain/consumptionErrors";
import { AppError } from "../errors/AppError";

type ConsumeUnitsInput = {
  accountId: string;
  externalId: string;
  units: number;
  requestId: string;
};

export async function consumeUnits(input: ConsumeUnitsInput) {
  let result;

  try {
    result = await processConsumptionRequest(input);
  } catch (error) {
    if (error instanceof ConsumptionError) {
      switch (error.code) {
        case "ACCOUNT_NOT_FOUND":
          throw new AppError(404, "Account not found");

        case "USER_NOT_FOUND":
          throw new AppError(404, "User not found in this account");

        case "REQUEST_ID_CONFLICT":
          throw new AppError(
            409,
            "Request ID was already used with different data",
          );
      }
    }

    throw error;
  }

  return {
    requestId: input.requestId,
    ...result,
  };
}

export async function getConsumptionHistory(
  accountId: string,
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;
  const items = await findConsumptionHistory(accountId, limit, offset);

  return {
    page,
    limit,
    items,
  };
}