# Local Performance Results

## Environment

- Operating system: Windows
- Node.js: v24.13.1
- PostgreSQL: 17, running through Docker Compose
- API: http://localhost:3000
- Database: usage_metering_test

## Method

The API was started with .env.test. The load script created a new account and user for each run, then sent 500 consumption requests for one unit each. Every request used a unique request ID. The script measured the consumption requests, excluding account and user setup.

## Results

| Concurrency | Requests | Duration (ms) | Requests/second | Average latency (ms) | p95 latency (ms) | Accepted | Rejected | Errors |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 500 | 6173.81 | 80.99 | 12.35 | 16.96 | 500 | 0 | 0 |
| 20 | 500 | 4897.02 | 102.10 | 192.69 | 265.68 | 500 | 0 | 0 |
| 50 | 500 | 4839.47 | 103.32 | 462.38 | 578.03 | 500 | 0 | 0 |

## Observations and Limitations

Throughput increased from about 81 requests per second at concurrency 1 to about 102 at concurrency 20. Raising concurrency to 50 barely increased throughput, while average and p95 latency rose considerably.

This is consistent with the consumption transaction locking the account row while it checks and updates usage. That lock helps preserve correct limits for simultaneous requests, but requests for one account wait on one another.

These are local results from one run per concurrency setting, using 500 requests and a local database. They are a reproducible baseline, not a production capacity guarantee. Re-run the script after any performance-related change and compare the same measurements.

## Reproducing the Run

Start the API against the test database in one terminal:

    npx.cmd dotenv -e .env.test -- npm.cmd run dev

In a second terminal, run:

    $env:CONCURRENCY = "1"
    node scripts/load-test.js

    $env:CONCURRENCY = "20"
    node scripts/load-test.js

    $env:CONCURRENCY = "50"
    node scripts/load-test.js

The script defaults to 500 requests. Each run creates a new account, user, and usage history in the test database.