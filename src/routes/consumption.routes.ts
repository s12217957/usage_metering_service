import { Router } from "express";
import { authenticateAccount } from "../middleware/authenticateAccount";
import { validateBody } from "../middleware/validateBody";
import { consumptionSchema } from "../validators/consumption";
import { consumeUnitsController, getConsumptionHistoryController } from "../controllers/consumption.controller";
import { getCurrentUsageController } from "../controllers/usage.controller";
import { validateQuery } from "../middleware/validateQuery";
import {
  currentUsageQuerySchema,
  usageHistoryQuerySchema,
} from "../validators/usage";


const router = Router();

router.post(
  "/consume",
  authenticateAccount,
  validateBody(consumptionSchema),
  consumeUnitsController,
);

router.get(
  "/",
  authenticateAccount,
  validateQuery(currentUsageQuerySchema),
  getCurrentUsageController,
);

router.get(
  "/history",
  authenticateAccount,
  validateQuery(usageHistoryQuerySchema),
  getConsumptionHistoryController,
);


export default router;
