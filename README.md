# Usage Metering Service

A TypeScript and Express API that lets client applications check and record unit consumption for their accounts and users. PostgreSQL stores plans, assignments, monthly usage, and request history.

## Requirements

- Docker Desktop with Docker Compose
- Node.js 24 or later and npm, if running the API outside Docker

## Run the complete example with Docker

From the project root, run:

```powershell
docker compose up --build
```

Compose starts PostgreSQL, builds and starts the API, applies pending Drizzle migrations, seeds predefined plans, then runs the example client. The example container exits with code `0` after it finishes; PostgreSQL and the API should remain running. The API is available at `http://localhost:3000` and PostgreSQL is exposed on host port `5433`.

To see service status and the example output:

```powershell
docker compose ps -a
docker compose logs example
```

Stop the services with `Ctrl+C` in the attached terminal, or run `docker compose down` from another terminal. PostgreSQL data is kept in the `postgres_data` volume. To remove the database and all its data, run `docker compose down -v`.

## Run locally

1. Start PostgreSQL, for example with `docker compose up -d postgres`.
2. Create a root `.env` file with the connection string for the local database:

   ```env
   DATABASE_URL=postgres://app:dev_password@localhost:5433/usage_metering
   PORT=3000
   ```

3. Install dependencies and apply migrations:

   ```powershell
   npm.cmd ci
   npx.cmd drizzle-kit migrate
   ```

4. Start the API. Startup seeds predefined plans:

   ```powershell
   npm.cmd run dev
   ```

5. In another terminal, run the example client:

   ```powershell
   node example-client/demo.js
   ```

The example client can also be pointed at a different API URL by setting `BASE_URL`. The API key is returned once when an account is created; store it securely and send it in the `X-API-Key` header for that account's operations.

## Account, user, and plan model

- An **account** is a client application or company. Its API key identifies it and restricts operations to its data.
- A **user** is identified by an `externalId` supplied by the client and belongs to one account.
- An **account plan** sets the shared monthly allowance and maximum units per request across the account's users.
- A **user plan** sets that user's individual monthly allowance and per-request maximum. Users may share a plan definition, but their usage totals remain separate.
- A request is accepted only when both account and user rules allow it. Accepted units count once toward each level. Rejected requests add no usage.
- Usage periods use UTC calendar months. Historical usage queries return consumed totals for the requested month; remaining limits are returned for the current month only.
- A request ID makes retries safe. Reusing it with the same request data returns the recorded decision; reusing it with different data returns `409 Conflict`.
- Plan updates apply to later requests and preserve existing usage. Predefined plans are read-only; custom plans belong to the account that created them.

## Predefined plans

| Scope | Plan | Monthly limit | Maximum per request |
| --- | --- | ---: | ---: |
| Account | Starter | 10,000 units | 100 units |
| Account | Pro | 100,000 units | 1,000 units |
| User | Basic | 1,000 units | 20 units |
| User | Premium | 5,000 units | 100 units |

These are example limits for this project and are inserted idempotently at API startup.

## API

All JSON request bodies must use `Content-Type: application/json`. Account creation is public because it issues the account's API key. All other listed endpoints require `X-API-Key`.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/accounts` | Create an account and receive its API key |
| `POST` | `/users` | Register an external user under the authenticated account |
| `GET` | `/plans` | List predefined plans and this account's custom plans |
| `POST` | `/plans` | Create an account-owned custom account or user plan |
| `PUT` | `/plans/account` | Assign an account plan |
| `PUT` | `/plans/user` | Assign a plan to one user |
| `PUT` | `/plans/:planId` | Update one of this account's custom plans |
| `POST` | `/usage/consume` | Evaluate and record a consumption request |
| `GET` | `/usage?externalId=...` | Get current usage and remaining allowance for account and user |
| `GET` | `/usage?externalId=...&period=YYYY-MM` | Get historical consumed totals for a UTC month |
| `GET` | `/usage/history?page=1&limit=20` | Get account request history, newest first |

### Example requests

Create an account:

```http
POST /accounts
Content-Type: application/json

{"name":"Example company"}
```

The response contains `id`, `name`, and `apiKey`. Save the key; it is not returned by later requests.

Register a user:

```http
POST /users
X-API-Key: <account-api-key>
Content-Type: application/json

{"externalId":"customer-123"}
```

Consume units:

```http
POST /usage/consume
X-API-Key: <account-api-key>
Content-Type: application/json

{"externalId":"customer-123","units":5,"requestId":"order-987-process"}
```

A consumption decision includes `decision`, `rejectionLevel`, and `rejectionReason`. A rejection identifies whether the account or user rule blocked the request. Invalid input returns `400`; missing or invalid API keys return `401`; unknown users return `404`; a request ID reused with different request data returns `409`.

Get current usage:

```http
GET /usage?externalId=customer-123
X-API-Key: <account-api-key>
```

For an earlier month, pass `period=YYYY-MM`. Historical responses include consumed totals; current remaining allowances are not reconstructed from historical plan settings.

History pagination defaults to page `1` and limit `20`; maximum limit is `100`.

## Tests

The test command loads `.env.test` so tests use the separate `usage_metering_test` database:

```powershell
npm.cmd test
```

Before running integration tests, start PostgreSQL and apply migrations to the test database. Do not point `.env.test` at the development database; integration tests verify that the configured database name contains `usage_metering_test`.

Build the TypeScript project with:

```powershell
npm.cmd run build
```

## Performance baseline

The load script sends 500 one-unit consumption requests using unique request IDs. It creates a new account and user for each run. Results below were measured on a local Windows environment with PostgreSQL 17 and the test database; they are a baseline, not a production capacity guarantee.

| Concurrency | Requests/second | Average latency | p95 latency | Accepted | Errors |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 80.99 | 12.35 ms | 16.96 ms | 500 | 0 |
| 20 | 102.10 | 192.69 ms | 265.68 ms | 500 | 0 |
| 50 | 103.32 | 462.38 ms | 578.03 ms | 500 | 0 |

The measurements show that throughput leveled off between concurrency 20 and 50 while latency rose. The consumption transaction serializes requests for the same account to protect usage totals and limits. See [`performance/results.md`](performance/results.md) for the method and commands to reproduce the measurements.

## Known limitations

- The example client is a one-shot command-line demonstration, not an interactive customer application.
- The API key is shown only at account creation; callers are responsible for storing it securely.
- Performance results are local measurements with a small request count and do not predict production capacity.
