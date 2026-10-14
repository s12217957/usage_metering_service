import "dotenv/config";
import express from "express";
import { seedPredefinedPlans } from "./seed";
import accountsRouter from "./routes/accounts.routes";
import usersRouter from "./routes/users.routes";
import consumptionRouter from "./routes/consumption.routes";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());

app.use("/accounts", accountsRouter);
app.use("/users", usersRouter);
app.use("/usage", consumptionRouter);

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
