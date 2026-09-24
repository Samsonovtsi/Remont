import { describe, expect, it } from 'vitest';
import { calculateEstimate } from '../src/calculator.js';
import { estimateRequestSchema } from '../src/schema.js';

describe('renovation calculator', () => {
  const futuroComfort = estimateRequestSchema.parse({
    areaM2: 45.4,
    package: 'comfort',
    propertyType: 'apartment',
    condition: 'new_build',
    calculationMode: 'exact',
    bathrooms: 1,
    rooms: 2,
    doors: 4,
    doorways: 1,
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
    ceilingAreaM2: 47.4,
    ceilingWorkAreaM2: 0,
    electricalAreaM2: 45.4,
    demolitionAreaM2: 0,
    lights: 31,
    sockets: 41
  });

  const rentalMinimal = estimateRequestSchema.parse({
    areaM2: 42.2,
    package: 'minimal',
    propertyType: 'apartment',
    condition: 'new_build',
    calculationMode: 'exact',
    bathrooms: 1,
    rooms: 2,
    doors: 2,
    doorways: 1,
    needsFullElectrical: true,
    needsFullPlumbing: true,
    needsDemolition: false,
    needsCeiling: true,
    hasBalcony: true,
    warmFloorM2: 0,
    roughWallAreaM2: 101.9,
    cleanWallAreaM2: 90.37,
    roughFloorAreaM2: 4.27,
    dryFloorAreaM2: 33.47,
    wetTileAreaM2: 28.63,
    balconyTileAreaM2: 0,
    ceilingAreaM2: 39.74,
    ceilingWorkAreaM2: 37.74,
    electricalAreaM2: 37.74,
    demolitionAreaM2: 0,
    lights: 26,
    sockets: 36
  });

  it('reproduces Futuro Comfort estimate from source line items', () => {
    const result = calculateEstimate(futuroComfort);
    expect(result.worksTotal).toBe(875_204);
    expect(result.materialsTotal).toBe(876_185);
    expect(result.deliveryTotal).toBe(87_619);
    expect(result.vat).toBe(91_950);
    expect(result.clientTotal).toBe(1_930_958);
  });

  it('reproduces rental/minimal estimate from source line items', () => {
    const result = calculateEstimate(rentalMinimal);
    expect(result.worksTotal).toBe(567_859);
    expect(result.materialsTotal).toBe(355_024);
    expect(result.deliveryTotal).toBe(35_502);
    expect(result.vat).toBe(47_919);
    expect(result.clientTotal).toBe(1_006_304);
  });

  it('calculates realtor reward as 5% of works only', () => {
    const result = calculateEstimate(futuroComfort);
    expect(result.agentRewardBase).toBe(result.worksTotal);
    expect(result.agentReward).toBe(Math.round(result.worksTotal * 0.05));
    expect(result.agentReward).not.toBe(Math.round(result.clientTotal * 0.05));
  });

  it('uses exact entered measurements including electrical area', () => {
    const result = calculateEstimate(rentalMinimal);
    expect(result.measurementMode).toBe('exact');
    expect(result.assumptions.roughWallAreaM2).toBe(101.9);
    expect(result.assumptions.electricalAreaM2).toBe(37.7);
    expect(result.assumptions.ceilingWorkAreaM2).toBe(37.7);
    expect(result.assumptions.lights).toBe(26);
    expect(result.assumptions.sockets).toBe(36);
  });

  it('keeps delivery and VAT separate from works', () => {
    const result = calculateEstimate(futuroComfort);
    expect(result.deliveryTotal).toBe(Math.round(result.materialsTotal * 0.10));
    expect(result.vat).toBe(Math.round(result.subtotalBeforeVat * 0.05));
  });

  it('calculates Premium works and realtor reward in exact mode', () => {
    const input = estimateRequestSchema.parse({
      areaM2: 59.82,
      package: 'premium',
      propertyType: 'apartment',
      condition: 'new_build',
      calculationMode: 'exact',
      bathrooms: 1,
      rooms: 2,
      doors: 0,
      doorways: 0,
      needsFullElectrical: false,
      needsFullPlumbing: true,
      needsDemolition: false,
      needsCeiling: false,
      hasBalcony: false,
      warmFloorM2: 0,
      roughWallAreaM2: 158.16,
      cleanWallAreaM2: 158.16,
      roughFloorAreaM2: 54.27,
      dryFloorAreaM2: 52.72,
      wetTileAreaM2: 25.9,
      balconyTileAreaM2: 0,
      ceilingAreaM2: 0,
      ceilingWorkAreaM2: 0,
      electricalAreaM2: 0,
      demolitionAreaM2: 0,
      lights: 0,
      sockets: 0
    });
    const result = calculateEstimate(input);
    expect(result.calculationMode).toBe('smeta');
    expect(result.worksTotal).toBeGreaterThan(0);
    expect(result.agentRewardBase).toBe(result.worksTotal);
    expect(result.agentReward).toBe(Math.round(result.worksTotal * 0.05));
  });
  it('uses uploaded-estimate rates as the primary model in quick mode', () => {
    const input = estimateRequestSchema.parse({
      areaM2: 55,
      package: 'comfort',
      propertyType: 'apartment',
      condition: 'new_build',
      calculationMode: 'quick',
      bathrooms: 1,
      rooms: 2,
      doors: 2,
      doorways: 1,
      needsFullElectrical: false,
      needsFullPlumbing: true,
      needsDemolition: false,
      needsCeiling: true,
      hasBalcony: false,
      warmFloorM2: 0
    });
    const result = calculateEstimate(input);
    expect(result.calculationMode).toBe('smeta');
    expect(result.measurementMode).toBe('quick');
    expect(result.worksTotal).toBeGreaterThan(0);
    expect(result.materialsTotal).toBeGreaterThan(0);
    expect(result.deliveryTotal).toBe(Math.round(result.materialsTotal * 0.10));
    expect(result.vat).toBe(Math.round(result.subtotalBeforeVat * 0.05));
  });

  it('uses uploaded-estimate Premium rates in quick mode', () => {
    const input = estimateRequestSchema.parse({
      areaM2: 35,
      package: 'premium',
      propertyType: 'apartment',
      condition: 'new_build',
      calculationMode: 'quick',
      bathrooms: 1,
      rooms: 1,
      doors: 1,
      doorways: 0,
      needsFullElectrical: false,
      needsFullPlumbing: true,
      needsDemolition: false,
      needsCeiling: true,
      hasBalcony: false,
      warmFloorM2: 0
    });
    const result = calculateEstimate(input);
    expect(result.calculationMode).toBe('smeta');
    expect(result.worksTotal).toBeGreaterThan(0);
    expect(result.agentRewardBase).toBe(result.worksTotal);
  });

});
