import express from "express";
import accountsRouter from "./routes/accounts.routes";
import usersRouter from "./routes/users.routes";
import consumptionRouter from "./routes/consumption.routes";
import plansRouter from "./routes/plans.routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(express.json());

app.use("/accounts", accountsRouter);
app.use("/users", usersRouter);
app.use("/usage", consumptionRouter);
app.use("/plans", plansRouter);

app.use(errorHandler);

export default app;