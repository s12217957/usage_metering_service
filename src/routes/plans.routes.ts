import { Router } from "express";
import {
  assignAccountPlanController,
  assignUserPlanController,
  createCustomPlanController,
  editCustomPlanController,
  listPlansController,
} from "../controllers/plans.controller";
import {
  planAssignmentSchema,
  planIdParamsSchema,
  planSchema,
  updateCustomPlanSchema,
  userPlanAssignmentSchema,
} from "../validators/plan";
import { authenticateAccount } from "../middleware/authenticateAccount";
import { validateBody } from "../middleware/validateBody";
import { validateParams } from "../middleware/validateParams";

const router = Router();

router.post(
  "/",
  authenticateAccount,
  validateBody(planSchema),
  createCustomPlanController,
);


router.get("/", authenticateAccount, listPlansController);



router.put(
  "/account",
  authenticateAccount,
  validateBody(planAssignmentSchema),
  assignAccountPlanController,
);

router.put(
  "/user",
  authenticateAccount,
  validateBody(userPlanAssignmentSchema),
  assignUserPlanController,
);

router.put(
  "/:planId",
  authenticateAccount,
  validateParams(planIdParamsSchema),
  validateBody(updateCustomPlanSchema),
  editCustomPlanController,
);

export default router;