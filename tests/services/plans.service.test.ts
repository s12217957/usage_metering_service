import { beforeEach, describe, expect, it, vi } from "vitest";
import { findAssignablePlan } from "../../src/repositories/plans.repository";
import { updateUserPlan } from "../../src/repositories/users.repository";
import { assignUserPlan } from "../../src/services/plans.service";

vi.mock("../../src/repositories/plans.repository", () => ({
  findAssignablePlan: vi.fn(),
}));

vi.mock("../../src/repositories/users.repository", () => ({
  updateUserPlan: vi.fn(),
}));

const findAssignablePlanMock = vi.mocked(findAssignablePlan);
const updateUserPlanMock = vi.mocked(updateUserPlan);

describe("assignUserPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects assigning a plan that is not available to the account", async () => {
    findAssignablePlanMock.mockResolvedValue(undefined);

    await expect(
      assignUserPlan("account-a", "user-123", "plan-owned-by-account-b"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "User plan is not available for this account",
    });

    expect(updateUserPlanMock).not.toHaveBeenCalled();
  });

  it("does not assign a plan to a user outside the account", async () => {
    findAssignablePlanMock.mockResolvedValue({ id: "basic-plan" });
    updateUserPlanMock.mockResolvedValue(undefined);

    await expect(
      assignUserPlan("account-a", "user-from-account-b", "basic-plan"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "User not found in this account",
    });

    expect(updateUserPlanMock).toHaveBeenCalledWith(
      "account-a",
      "user-from-account-b",
      "basic-plan",
    );
  });

  it("assigns an available plan to a user in the account", async () => {
    findAssignablePlanMock.mockResolvedValue({ id: "plan-123" });
    updateUserPlanMock.mockResolvedValue({
      userId: "user-123",
      planId: "plan-123",
    });

    const result = await assignUserPlan(
      "account-a",
      "external-user-123",
      "plan-123",
    );

    expect(result).toEqual({
      userId: "user-123",
      planId: "plan-123",
    });

    expect(findAssignablePlanMock).toHaveBeenCalledWith(
      "account-a",
      "plan-123",
      "user",
    );

    expect(updateUserPlanMock).toHaveBeenCalledWith(
      "account-a",
      "external-user-123",
      "plan-123",
    );
  });
});