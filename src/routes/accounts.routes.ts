import { Router } from "express";
import { createAccountController } from "../controllers/accounts.controller";

const router = Router();

router.post("/", createAccountController);

export default router;