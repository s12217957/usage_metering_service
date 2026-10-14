import { z } from "zod";

export const consumptionSchema = z.object({
  externalId: z.string().trim().min(1).max(100),
  units: z.number().int().positive(),
  requestId: z.string().trim().min(1).max(200),
});