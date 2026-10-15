import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export function validateParams(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      res.status(400).json({
        error: "Invalid route parameters",
        details: result.error.issues.map((issue) => issue.message),
      });
      return;
    }

    next();
  };
}