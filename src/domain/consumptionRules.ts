type Limits = {
  monthlyLimit: number;
  maxUnitsPerRequest: number;
  consumedUnits: number;
};

type EvaluateConsumptionInput = {
  units: number;
  account: Limits;
  user: Limits;
};

export function evaluateConsumption({
  units,
  account,
  user,
}: EvaluateConsumptionInput) {
  if (units > account.maxUnitsPerRequest) {
    return {
      decision: "rejected" as const,
      rejectionLevel: "account" as const,
      rejectionReason: "max_units_per_request",
    };
  }

  if (units > user.maxUnitsPerRequest) {
    return {
      decision: "rejected" as const,
      rejectionLevel: "user" as const,
      rejectionReason: "max_units_per_request",
    };
  }

  if (account.consumedUnits + units > account.monthlyLimit) {
    return {
      decision: "rejected" as const,
      rejectionLevel: "account" as const,
      rejectionReason: "monthly_limit",
    };
  }

  if (user.consumedUnits + units > user.monthlyLimit) {
    return {
      decision: "rejected" as const,
      rejectionLevel: "user" as const,
      rejectionReason: "monthly_limit",
    };
  }

  return {
    decision: "accepted" as const,
    rejectionLevel: null,
    rejectionReason: null,
  };
}