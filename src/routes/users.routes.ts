import { Router } from "express";
import { createUserController } from "../controllers/users.controller";
import { authenticateAccount } from "../middleware/authenticateAccount";
import { validateBody } from "../middleware/validateBody";
import { userSchema } from "../validators/user";

const router = Router();

router.post(
  "/",
  authenticateAccount,
  validateBody(userSchema),
  createUserController,
);

export default router;