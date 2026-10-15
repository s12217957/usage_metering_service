import type { RequestHandler } from "express";
import { registerUser } from "../services/users.service";

export const createUserController: RequestHandler = async (req, res) => {
  const user = await registerUser(
    res.locals.accountId,
    req.body.externalId,
  );

  res.status(201).json(user);
};