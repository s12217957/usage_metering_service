import { z } from "zod";

export const userSchema = z.object({
  externalId: z.string().trim().min(1).max(100),
});