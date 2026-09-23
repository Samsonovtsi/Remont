import { describe, expect, it } from 'vitest';
import { calculateEstimate } from '../src/calculator.js';
import { estimateRequestSchema } from '../src/schema.js';

describe('renovation calculator', () => {
  const comfortInput = estimateRequestSchema.parse({
    areaM2: 40,
    package: 'comfort',
    propertyType: 'apartment',
    condition: 'new_build',
    bathrooms: 1,
    rooms: 2,
    doors: 2,
    needsFullElectrical: true,
    needsFullPlumbing: true,
    needsDemolition: false,
    needsCeiling: true,
    hasBalcony: false,
    warmFloorM2: 0,
    finishLevel: 0.5
  });

  it('calculates realtor reward as 5% of client total', () => {
    const result = calculateEstimate(comfortInput);
    expect(result.agentReward).toBe(Math.round(result.clientTotal * 0.05));
  });

  it('uses smeta mode for Standard and Comfort', () => {
    const result = calculateEstimate(comfortInput);
    expect(result.calculationMode).toBe('smeta');
    expect(result.deliveryTotal).toBe(Math.round(result.materialsTotal * 0.10));
    expect(result.vat).toBe(Math.round(result.subtotalBeforeVat * 0.05));
  });

  it('uses range mode for packages without detailed estimates', () => {
    const input = estimateRequestSchema.parse({
      ...comfortInput,
      package: 'premium'
    });
    expect(calculateEstimate(input).calculationMode).toBe('range');
  });
});
