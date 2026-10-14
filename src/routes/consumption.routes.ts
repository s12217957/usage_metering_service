import { Router } from "express";
import { authenticateAccount } from "../middleware/authenticateAccount";
import { validateBody } from "../middleware/validateBody";
import { consumptionSchema } from "../validators/consumption";
import { consumeUnitsController, getConsumptionHistoryController } from "../controllers/consumption.controller";
import { getCurrentUsageController } from "../controllers/usage.controller";

const router = Router();

router.post(
  "/consume",
  authenticateAccount,
  validateBody(consumptionSchema),
  consumeUnitsController,
);

router.get("/", authenticateAccount, getCurrentUsageController);

router.get(
  "/history",
  authenticateAccount,
  getConsumptionHistoryController,
);

export default router;
