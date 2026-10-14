import type { RequestHandler } from "express";
import { registerAccount } from "../services/accounts.service";

export const createAccountController: RequestHandler = async (req, res) => {
  try {
    const account = await registerAccount(req.body.name);
    res.status(201).json(account);
  } catch (error) {
    console.error("Account creation failed:", error);
    res.status(500).json({ error: "Could not create account" });
  }
};