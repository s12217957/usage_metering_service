import type { Request, Response } from "express";
import { accountSchema } from "../validators/account";
import { registerAccount } from "../services/accounts.service";

export async function createAccountController(req: Request, res: Response) {
  const result = accountSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Invalid account data",
      details: result.error.issues.map((issue) => issue.message),
    });
  }

  try {
    const account = await registerAccount(result.data.name);
    return res.status(201).json(account);
  } catch (error) {
    console.error("Account creation failed:", error);
    return res.status(500).json({ error: "Could not create account" });
  }
}