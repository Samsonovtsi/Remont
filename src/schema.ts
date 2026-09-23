import { z } from 'zod';

export const estimateRequestSchema = z.object({
  areaM2: z.number().positive().max(3000),
  package: z.enum(['minimal', 'standard', 'comfort', 'premium']),
  propertyType: z.enum(['apartment', 'house', 'commercial']).default('apartment'),
  condition: z.enum(['new_build', 'secondary_good', 'secondary_worn', 'shell']).default('new_build'),

  bathrooms: z.number().int().min(0).max(20).default(1),
  rooms: z.number().int().min(0).max(50).default(1),
  doors: z.number().int().min(0).max(100).default(2),

  needsFullElectrical: z.boolean().default(false),
  needsFullPlumbing: z.boolean().default(false),
  needsDemolition: z.boolean().default(false),
  needsCeiling: z.boolean().default(true),
  hasBalcony: z.boolean().default(false),
  warmFloorM2: z.number().min(0).max(1000).default(0),

  // 0 = нижняя граница пакета, 1 = верхняя. По умолчанию берём середину.
  finishLevel: z.number().min(0).max(1).default(0.5)
});

export type EstimateRequest = z.infer<typeof estimateRequestSchema>;
