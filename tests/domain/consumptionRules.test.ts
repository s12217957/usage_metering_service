import { describe, expect, it } from "vitest";
import { evaluateConsumption } from "../../src/domain/consumptionRules";

describe("evaluateConsumption", () => {
  it("accepts when both account and user limits allow the request", () => {
    const result = evaluateConsumption({
      units: 10,
      account: {
        monthlyLimit: 1000,
        maxUnitsPerRequest: 100,
        consumedUnits: 0,
      },
      user: {
        monthlyLimit: 100,
        maxUnitsPerRequest: 20,
        consumedUnits: 0,
      },
    });

    expect(result).toEqual({
      decision: "accepted",
      rejectionLevel: null,
      rejectionReason: null,
    });
  });

  it("rejects when the account per-request limit is exceeded", () => {
    const result = evaluateConsumption({
      units: 101,
      account: {
        monthlyLimit: 1000,
        maxUnitsPerRequest: 100,
        consumedUnits: 0,
      },
      user: {
        monthlyLimit: 500,
        maxUnitsPerRequest: 200,
        consumedUnits: 0,
      },
    });

    expect(result).toEqual({
      decision: "rejected",
      rejectionLevel: "account",
      rejectionReason: "max_units_per_request",
    });
  });

  it("rejects when the user per-request limit is exceeded", () => {
    const result = evaluateConsumption({
      units: 21,
      account: {
        monthlyLimit: 1000,
        maxUnitsPerRequest: 100,
        consumedUnits: 0,
      },
      user: {
        monthlyLimit: 500,
        maxUnitsPerRequest: 20,
        consumedUnits: 0,
      },
    });

    expect(result).toEqual({
      decision: "rejected",
      rejectionLevel: "user",
      rejectionReason: "max_units_per_request",
    });
  });

  it("rejects when the account monthly limit is exceeded", () => {
    const result = evaluateConsumption({
      units: 10,
      account: {
        monthlyLimit: 100,
        maxUnitsPerRequest: 100,
        consumedUnits: 95,
      },
      user: {
        monthlyLimit: 500,
        maxUnitsPerRequest: 20,
        consumedUnits: 0,
      },
    });

    expect(result).toEqual({
      decision: "rejected",
      rejectionLevel: "account",
      rejectionReason: "monthly_limit",
    });
  });

  it("rejects when the user monthly limit is exceeded", () => {
    const result = evaluateConsumption({
      units: 10,
      account: {
        monthlyLimit: 1000,
        maxUnitsPerRequest: 100,
        consumedUnits: 0,
      },
      user: {
        monthlyLimit: 100,
        maxUnitsPerRequest: 20,
        consumedUnits: 95,
      },
    });

    expect(result).toEqual({
      decision: "rejected",
      rejectionLevel: "user",
      rejectionReason: "monthly_limit",
    });
  });

  it("accepts when the request uses the exact remaining limits", () => {
  const result = evaluateConsumption({
    units: 20,
    account: {
      monthlyLimit: 100,
      maxUnitsPerRequest: 20,
      consumedUnits: 80,
    },
    user: {
      monthlyLimit: 50,
      maxUnitsPerRequest: 20,
      consumedUnits: 30,
    },
  });

  expect(result).toEqual({
    decision: "accepted",
    rejectionLevel: null,
    rejectionReason: null,
  });
});
});