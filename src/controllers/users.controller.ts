import type { RequestHandler } from "express";
import { registerUser } from "../services/users.service";

export const createUserController: RequestHandler = async (req, res) => {
  try {
    const user = await registerUser(
      res.locals.accountId,
      req.body.externalId,
    );

    res.status(201).json(user);
  } catch (error) {
    console.error("User creation failed:", error);
    res.status(500).json({ error: "Could not create user" });
  }
};