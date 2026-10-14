import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export function validateBody(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: result.error.issues.map((issue) => issue.message),
      });
      return;
    }

    req.body = result.data;
    next();
  };
}