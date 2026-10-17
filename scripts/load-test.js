const { randomUUID } = require("node:crypto");

const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);
const requestCount = Number(process.env.REQUEST_COUNT || 500);
const concurrency = Number(process.env.CONCURRENCY || 20);

if (
  !Number.isInteger(requestCount) ||
  requestCount < 1 ||
  !Number.isInteger(concurrency) ||
  concurrency < 1
) {
  throw new Error("REQUEST_COUNT and CONCURRENCY must be positive integers");
}

async function sendRequest(path, { method = "GET", apiKey, body } = {}) {
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
  const account = await sendRequest("/accounts", {
    method: "POST",
    body: { name: "Load test " + randomUUID() },
  });

  if (!account.apiKey) {
    throw new Error("Account creation did not return an API key");
  }

  const externalId = "load-user-" + randomUUID();

  await sendRequest("/users", {
    method: "POST",
    apiKey: account.apiKey,
    body: { externalId },
  });

  const latencies = [];
  const errors = [];
  let accepted = 0;
  let rejected = 0;
  let nextRequest = 0;

  async function worker() {
    while (nextRequest < requestCount) {
      const requestNumber = nextRequest++;
      const startedAt = performance.now();

      try {
        const result = await sendRequest("/usage/consume", {
          method: "POST",
          apiKey: account.apiKey,
          body: {
            externalId,
            units: 1,
            requestId: "load-" + randomUUID() + "-" + requestNumber,
          },
        });

        latencies.push(performance.now() - startedAt);

        if (result.decision === "accepted") {
          accepted++;
        } else {
          rejected++;
        }
      } catch (error) {
        latencies.push(performance.now() - startedAt);
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  const startedAt = performance.now();

  await Promise.all(
    Array.from({ length: Math.min(concurrency, requestCount) }, () => worker()),
  );

  const durationMs = performance.now() - startedAt;
  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  const averageLatencyMs =
    latencies.reduce((sum, value) => sum + value, 0) / latencies.length;
  const p95Index = Math.ceil(sortedLatencies.length * 0.95) - 1;

  console.log(
    JSON.stringify(
      {
        baseUrl,
        requestCount,
        concurrency,
        durationMs: Number(durationMs.toFixed(2)),
        requestsPerSecond: Number(
          (requestCount / (durationMs / 1000)).toFixed(2),
        ),
        averageLatencyMs: Number(averageLatencyMs.toFixed(2)),
        p95LatencyMs: Number(sortedLatencies[p95Index].toFixed(2)),
        accepted,
        rejected,
        errors: errors.length,
        firstErrors: errors.slice(0, 3),
      },
      null,
      2,
    ),
  );

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Load test setup failed:", error);
  process.exitCode = 1;
});