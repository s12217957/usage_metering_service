import { z } from "zod";

export const currentUsageQuerySchema = z.object({
  externalId: z.string().trim().min(1).max(100),
  period: z
    .string()
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "period must use YYYY-MM format")
    .optional(),
});

export const usageHistoryQuerySchema = z.object({
  page: z.preprocess(
    (value) => (value === undefined ? "1" : value),
    z
      .string()
      .regex(/^[1-9]\d*$/, "page must be a positive whole number")
      .transform(Number)
      .pipe(z.number().int().positive()),
  ),
  limit: z.preprocess(
    (value) => (value === undefined ? "20" : value),
    z
      .string()
      .regex(/^[1-9]\d*$/, "limit must be a positive whole number")
      .transform(Number)
      .pipe(z.number().int().min(1).max(100)),
  ),
});