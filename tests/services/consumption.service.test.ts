import { beforeEach, describe, expect, it, vi } from "vitest";
import { processConsumptionRequest } from "../../src/repositories/consumption.repository";
import { ConsumptionError } from "../../src/domain/consumptionErrors";
import { consumeUnits } from "../../src/services/consumption.service";

vi.mock("../../src/repositories/consumption.repository", () => ({
  processConsumptionRequest: vi.fn(),
  findConsumptionHistory: vi.fn(),
}));

const processConsumptionRequestMock = vi.mocked(
  processConsumptionRequest,
);

const input = {
  accountId: "account-123",
  externalId: "user-456",
  units: 5,
  requestId: "request-789",
};

describe("consumeUnits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the accepted decision with the request ID", async () => {
    processConsumptionRequestMock.mockResolvedValue({
      decision: "accepted",
      rejectionLevel: null,
      rejectionReason: null,
    });

    const result = await consumeUnits(input);

    expect(result).toEqual({
      requestId: input.requestId,
      decision: "accepted",
      rejectionLevel: null,
      rejectionReason: null,
    });
    expect(processConsumptionRequestMock).toHaveBeenCalledWith(input);
  });

  it("returns the rejection details with the request ID", async () => {
    processConsumptionRequestMock.mockResolvedValue({
      decision: "rejected",
      rejectionLevel: "user",
      rejectionReason: "monthly_limit",
    });

    const result = await consumeUnits(input);

    expect(result).toEqual({
      requestId: input.requestId,
      decision: "rejected",
      rejectionLevel: "user",
      rejectionReason: "monthly_limit",
    });
  });

  it("converts a missing account error to a 404 AppError", async () => {
    processConsumptionRequestMock.mockRejectedValue(
      new ConsumptionError("ACCOUNT_NOT_FOUND"),
    );

    await expect(consumeUnits(input)).rejects.toMatchObject({
      statusCode: 404,
      message: "Account not found",
    });
  });

  it("converts a missing user error to a 404 AppError", async () => {
    processConsumptionRequestMock.mockRejectedValue(
      new ConsumptionError("USER_NOT_FOUND"),
    );

    await expect(consumeUnits(input)).rejects.toMatchObject({
      statusCode: 404,
      message: "User not found in this account",
    });
  });

  it("converts a reused request ID with different data to a 409 AppError", async () => {
    processConsumptionRequestMock.mockRejectedValue(
      new ConsumptionError("REQUEST_ID_CONFLICT"),
    );

    await expect(consumeUnits(input)).rejects.toMatchObject({
      statusCode: 409,
      message: "Request ID was already used with different data",
    });
  });
});