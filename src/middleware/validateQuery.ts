import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export function validateQuery(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      res.status(400).json({
        error: "Invalid request query",
        details: result.error.issues.map((issue) => issue.message),
      });
      return;
    }

    res.locals.query = result.data;
    next();
  };
}