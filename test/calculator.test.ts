import { describe, expect, it } from 'vitest';
import { calculateEstimate } from '../src/calculator.js';
import { estimateRequestSchema } from '../src/schema.js';

describe('renovation calculator', () => {
  it('calculates 5% agent reward', () => {
    const input = estimateRequestSchema.parse({
      areaM2: 40,
      package: 'standard',
      propertyType: 'apartment',
      condition: 'new_build',
      bathrooms: 1,
      rooms: 1,
      doors: 2,
      needsFullElectrical: false,
      needsFullPlumbing: false,
      needsDemolition: false,
      needsCeiling: false,
      hasBalcony: false,
      warmFloorM2: 0,
      finishLevel: 0.5
    });

    const result = calculateEstimate(input);
    expect(result.agentReward).toBe(Math.round(result.estimateBeforeReward * 0.05));
  });
});
