const { randomUUID } = require("node:crypto");

const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
);

async function apiRequest(path, { method = "GET", apiKey, body } = {}) {
    const response = await fetch(baseUrl + path, {
        method,
        headers: {
            ...(apiKey ? { "X-API-Key": apiKey } : {}),
            ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(
            method +
            " " +
            path +
            " returned " +
            response.status +
            ": " +
            JSON.stringify(data),
        );
    }

    return data;
}

async function main() {
    const account = await apiRequest("/accounts", {
        method: "POST",
        body: { name: "Demo account " + randomUUID() },
    });

    if (!account.apiKey) {
        throw new Error("Account creation did not return an API key");
    }

    const apiKey = account.apiKey;

    const accountPlan = await apiRequest("/plans", {
        method: "POST",
        apiKey,
        body: {
            name: "Demo shared limit " + randomUUID(),
            scope: "account",
            monthlyLimit: 30,
            maxUnitsPerRequest: 100,
        },
    });

    await apiRequest("/plans/account", {
        method: "PUT",
        apiKey,
        body: { planId: accountPlan.id },
    });

    const userOneId = "demo-user-one-" + randomUUID();
    const userTwoId = "demo-user-two-" + randomUUID();

    await apiRequest("/users", {
        method: "POST",
        apiKey,
        body: { externalId: userOneId },
    });

    await apiRequest("/users", {
        method: "POST",
        apiKey,
        body: { externalId: userTwoId },
    });

    const basicAttempt = await apiRequest("/usage/consume", {
        method: "POST",
        apiKey,
        body: {
            externalId: userOneId,
            units: 25,
            requestId: "basic-attempt-" + randomUUID(),
        },
    });

    const usageAfterBasicAttempt = await apiRequest(
        "/usage?externalId=" + encodeURIComponent(userOneId),
        { apiKey },
    );

    const availablePlans = await apiRequest("/plans", { apiKey });

    const premiumUserPlan = availablePlans.plans.find(
        (plan) => plan.name === "Premium" && plan.scope === "user",
    );

    if (!premiumUserPlan) {
        throw new Error("Predefined Premium user plan was not found");
    }

    await apiRequest("/plans/user", {
        method: "PUT",
        apiKey,
        body: {
            externalId: userOneId,
            planId: premiumUserPlan.id,
        },
    });

    const premiumAttempt = await apiRequest("/usage/consume", {
        method: "POST",
        apiKey,
        body: {
            externalId: userOneId,
            units: 25,
            requestId: "premium-attempt-" + randomUUID(),
        },
    });

    const usageAfterPremiumAttempt = await apiRequest(
        "/usage?externalId=" + encodeURIComponent(userOneId),
        { apiKey },
    );

    const accountLimitAttempt = await apiRequest("/usage/consume", {
        method: "POST",
        apiKey,
        body: {
            externalId: userTwoId,
            units: 10,
            requestId: "account-limit-attempt-" + randomUUID(),
        },
    });

    const usageAfterAccountLimitAttempt = await apiRequest(
        "/usage?externalId=" + encodeURIComponent(userTwoId),
        { apiKey },
    );


    console.log("\nDemo account:", account.name);
    console.log("Account plan: shared monthly limit of 30 units");
    console.log("Users: both started on Basic");

    console.log("\nUser one on Basic requests 25 units:");
    console.log("Decision:", basicAttempt.decision);
    console.log(
      "Rejected by:",
      basicAttempt.rejectionLevel + " / " + basicAttempt.rejectionReason,
    );
    console.log(
      "Account remaining:",
      usageAfterBasicAttempt.account.remainingUnits,
    );
    console.log("User remaining:", usageAfterBasicAttempt.user.remainingUnits);

    console.log("\nChanged user one to Premium.");

    console.log("\nUser one on Premium requests 25 units:");
    console.log("Decision:", premiumAttempt.decision);
    console.log(
      "Account remaining:",
      usageAfterPremiumAttempt.account.remainingUnits,
    );
    console.log("User remaining:", usageAfterPremiumAttempt.user.remainingUnits);

    console.log("\nUser two on Basic requests 10 units:");
    console.log("Decision:", accountLimitAttempt.decision);
    console.log(
      "Rejected by:",
      accountLimitAttempt.rejectionLevel +
        " / " +
        accountLimitAttempt.rejectionReason,
    );
    console.log(
      "Account remaining:",
      usageAfterAccountLimitAttempt.account.remainingUnits,
    );
    console.log(
      "User two remaining:",
      usageAfterAccountLimitAttempt.user.remainingUnits,
    );
}

main().catch((error) => {
    console.error("Demo failed:", error);
    process.exitCode = 1;
});