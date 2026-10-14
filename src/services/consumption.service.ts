import {
  findConsumptionHistory,
  processConsumptionRequest,
} from "../repositories/consumption.repository";
type ConsumeUnitsInput = {
  accountId: string;
  externalId: string;
  units: number;
  requestId: string;
};

export async function consumeUnits(input: ConsumeUnitsInput) {
  const result = await processConsumptionRequest(input);

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