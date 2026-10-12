import "dotenv/config";
import express from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { seedPredefinedPlans } from "./seed";
import accountsRouter from "./routes/accounts.routes";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/health/db", async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Database connection failed:", error);
    res.status(500).json({ status: "error", database: "disconnected" });
  }
});

app.use("/accounts", accountsRouter);

async function start() {
  try {
    await seedPredefinedPlans();

    app.listen(port, () => {
      console.log(`Server listening at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Service startup failed:", error);
    process.exit(1);
  }
}

void start();