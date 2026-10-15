import type { RequestHandler } from "express";
import { registerAccount } from "../services/accounts.service";

export const createAccountController: RequestHandler = async (req, res) => {
  const account = await registerAccount(req.body.name);
  res.status(201).json(account);
};