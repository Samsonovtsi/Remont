import { describe, expect, it } from 'vitest';
import { calculateEstimate } from '../src/calculator.js';
import { estimateRequestSchema } from '../src/schema.js';

describe('renovation calculator', () => {
  const exactComfort = estimateRequestSchema.parse({
    areaM2: 45.4,
    package: 'comfort',
    propertyType: 'apartment',
    condition: 'new_build',
    calculationMode: 'exact',
    bathrooms: 1,
    rooms: 2,
    doors: 4,
    needsFullElectrical: true,
    needsFullPlumbing: true,
    needsDemolition: false,
    needsCeiling: true,
    hasBalcony: false,
    warmFloorM2: 0,
    roughWallAreaM2: 129.39,
    cleanWallAreaM2: 104.88,
    roughFloorAreaM2: 45.4,
    dryFloorAreaM2: 36.8,
    wetTileAreaM2: 61.13,
    balconyTileAreaM2: 0,
    ceilingAreaM2: 45.4,
    demolitionAreaM2: 0,
    lights: 31,
    sockets: 41,
    finishLevel: 0.5
  });

  it('calculates realtor reward as 5% of works only', () => {
    const result = calculateEstimate(exactComfort);
    expect(result.agentRewardBase).toBe(result.worksTotal);
    expect(result.agentReward).toBe(Math.round(result.worksTotal * 0.05));
    expect(result.agentReward).not.toBe(Math.round(result.clientTotal * 0.05));
  });

  it('uses exact entered measurements', () => {
    const result = calculateEstimate(exactComfort);
    expect(result.measurementMode).toBe('exact');
    expect(result.assumptions.roughWallAreaM2).toBe(129.4);
    expect(result.assumptions.cleanWallAreaM2).toBe(104.9);
    expect(result.assumptions.lights).toBe(31);
    expect(result.assumptions.sockets).toBe(41);
  });

  it('keeps delivery and VAT separate from works', () => {
    const result = calculateEstimate(exactComfort);
    expect(result.deliveryTotal).toBe(Math.round(result.materialsTotal * 0.10));
    expect(result.vat).toBe(Math.round(result.subtotalBeforeVat * 0.05));
  });

  it('does not invent realtor reward where works/material split is unavailable', () => {
    const input = estimateRequestSchema.parse({ ...exactComfort, package: 'premium' });
    const result = calculateEstimate(input);
    expect(result.calculationMode).toBe('range');
    expect(result.agentReward).toBe(0);
    expect(result.agentRewardBase).toBe(0);
  });
});
