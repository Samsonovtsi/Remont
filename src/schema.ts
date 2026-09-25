import { z } from 'zod';

const nonNegative = z.number().min(0).max(10000).optional();

export const estimateRequestSchema = z.object({
  areaM2: z.number().positive().max(3000),
  package: z.enum(['minimal', 'standard', 'comfort', 'premium']),
  propertyType: z.enum(['apartment', 'apartment_new_build', 'apartment_secondary', 'house', 'commercial']).default('apartment_new_build'),
  condition: z.enum(['shell', 'white_box', 'developer_finish', 'secondary_good', 'secondary_cosmetic', 'secondary_worn']).default('shell'),

  calculationMode: z.enum(['quick', 'exact']).default('quick'),

  bathrooms: z.number().int().min(0).max(20).default(1),
  rooms: z.number().int().min(0).max(50).default(1),
  doors: z.number().int().min(0).max(100).default(2),
  doorways: z.number().int().min(0).max(100).default(1),

  needsFullElectrical: z.boolean().default(false),
  needsFullPlumbing: z.boolean().default(false),
  needsDemolition: z.boolean().default(false),
  needsCeiling: z.boolean().default(true),
  hasBalcony: z.boolean().default(false),
  warmFloorM2: z.number().min(0).max(1000).default(0),

  // Точные замеры. В quick-режиме они игнорируются.
  roughWallAreaM2: nonNegative,
  cleanWallAreaM2: nonNegative,
  roughFloorAreaM2: nonNegative,
  dryFloorAreaM2: nonNegative,
  wetTileAreaM2: nonNegative,
  balconyTileAreaM2: nonNegative,
  ceilingAreaM2: nonNegative,
  ceilingWorkAreaM2: nonNegative,
  electricalAreaM2: nonNegative,
  demolitionAreaM2: nonNegative,
  lights: z.number().int().min(0).max(1000).optional(),
  sockets: z.number().int().min(0).max(2000).optional(),

  // Для фиксированного Премиум-пакета.
  finishLevel: z.number().min(0).max(1).default(0.5)
});

export type EstimateRequest = z.infer<typeof estimateRequestSchema>;
