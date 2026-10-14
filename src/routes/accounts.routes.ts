import { Router } from "express";
import { createAccountController } from "../controllers/accounts.controller";
import { validateBody } from "../middleware/validateBody";
import { accountSchema } from "../validators/account";

const router = Router();

router.post("/", validateBody(accountSchema), createAccountController);

export default router;