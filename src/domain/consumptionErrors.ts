export type ConsumptionErrorCode =
  | "ACCOUNT_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "REQUEST_ID_CONFLICT";

export class ConsumptionError extends Error {
  constructor(public readonly code: ConsumptionErrorCode) {
    super(code);
    this.name = "ConsumptionError";
  }
}