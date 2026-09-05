import { z } from "zod";
import type { Blueprint } from "@/assessment/generator";

// DATA_MODEL.md §3.3: `assessment_configs.blueprint` is "validated by zod
// BlueprintSchema at load time" — that schema didn't exist yet anywhere in
// the codebase (the assessment-engine engineer's generator.ts only declares
// the TS shape). This is the runner's read path for it, so it lives here.

const blueprintBlockSchema = z.object({
  key: z.string().min(1),
  pillar: z.enum(["speed", "reasoning", "tech", "independence"]),
  count: z.number().int().positive(),
  time_limit_s: z.number().int().positive(),
  pool: z.string().min(1),
});

export const blueprintSchema = z.object({
  version: z.number().int().positive(),
  blocks: z.array(blueprintBlockSchema).min(1),
  weights: z.record(z.string(), z.number()),
  session_wall_clock_min: z.number().int().positive(),
});

export function parseBlueprint(raw: unknown): Blueprint {
  return blueprintSchema.parse(raw);
}
