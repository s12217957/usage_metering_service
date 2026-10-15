import { z } from "zod";

export const planSchema = z.object({
  name: z.string().trim().min(1).max(100),
  scope: z.enum(["account", "user"]),
  monthlyLimit: z.number().int().nonnegative(),
  maxUnitsPerRequest: z.number().int().positive(),
});

export const planAssignmentSchema = z.object({
  planId: z.string().uuid(),
});

export const userPlanAssignmentSchema = z.object({
  externalId: z.string().trim().min(1).max(100),
  planId: z.string().uuid(),
});

export const updateCustomPlanSchema = z.object({
  name: z.string().trim().min(1).max(100),
  monthlyLimit: z.number().int().nonnegative(),
  maxUnitsPerRequest: z.number().int().positive(),
});

export const planIdParamsSchema = z.object({
  planId: z.string().uuid(),
});