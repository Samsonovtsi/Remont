export type PackageCode = 'minimal' | 'standard' | 'comfort' | 'premium';
export type PropertyType = 'apartment' | 'house' | 'commercial';
export type Condition = 'new_build' | 'secondary_good' | 'secondary_worn' | 'shell';

export interface PackagePrice {
  title: string;
  minPerM2: number;
  maxPerM2: number;
  description: string;
  calculationMode: 'fixed' | 'smeta';
}

export const PACKAGE_PRICES: Record<PackageCode, PackagePrice> = {
  minimal: {
    title: 'Минимальный',
    minPerM2: 20_500,
    maxPerM2: 20_500,
    description: 'От 20 500 ₽/м². Включены работы, черновые и чистовые материалы и сантехника; электрика и освещение рассчитываются дополнительно.',
    calculationMode: 'fixed'
  },
  standard: {
    title: 'Стандарт',
    minPerM2: 22_700,
    maxPerM2: 37_600,
    description: 'Расчёт по структуре и тарифам загруженных смет',
    calculationMode: 'smeta'
  },
  comfort: {
    title: 'Комфорт',
    minPerM2: 32_200,
    maxPerM2: 47_300,
    description: 'Расчёт по структуре и тарифам загруженных смет',
    calculationMode: 'smeta'
  },
  premium: {
    title: 'Премиум',
    minPerM2: 42_800,
    maxPerM2: 42_800,
    description: 'От 42 800 ₽/м². Включены работы, черновые и чистовые материалы и сантехника; электрика и освещение рассчитываются дополнительно.',
    calculationMode: 'fixed'
  }
};

export const AGENT_REWARD_RATE = 0.05;
export const VAT_RATE = 0.05;
export const DELIVERY_RATE = 0.10;

export const CONDITION_FACTOR: Record<Condition, number> = {
  new_build: 1.00,
  secondary_good: 1.05,
  secondary_worn: 1.15,
  shell: 1.10
};

export const PROPERTY_FACTOR: Record<PropertyType, number> = {
  apartment: 1.00,
  house: 1.08,
  commercial: 0.95
};

export interface SmetaRates {
  roughWallPerM2: number;
  cleanWallPerM2: number;
  roughFloorPerM2: number;
  cleanFloorPerM2: number;
  tilePerM2: number;
  plumbingRough: number;
  plumbingClean: number;
  roughMaterialsFactor: number;
  cleanMaterialsFactor: number;
}

export const SMETA_RATES: Record<'standard' | 'comfort', SmetaRates> = {
  standard: {
    roughWallPerM2: 962,
    cleanWallPerM2: 536.5,
    roughFloorPerM2: 462.5,
    cleanFloorPerM2: 823.25,
    tilePerM2: 3_700,
    plumbingRough: 40_700,
    plumbingClean: 24_975,
    roughMaterialsFactor: 0.55,
    cleanMaterialsFactor: 1.265
  },
  comfort: {
    roughWallPerM2: 1_637.25,
    cleanWallPerM2: 814,
    roughFloorPerM2: 647.5,
    cleanFloorPerM2: 915.75,
    tilePerM2: 4_347.5,
    plumbingRough: 46_250,
    plumbingClean: 27_750,
    roughMaterialsFactor: 0.55,
    cleanMaterialsFactor: 1.265
  }
};

export const EXTRA_RATES = {
  electricalPerM2: 1_961,
  ceilingMaterialPerM2: 319,
  doorMaterial: 22_920,
  doorInstall: 10_000,
  doorwayMaterial: 8_200,
  doorwayInstall: 7_000,
  lightMaterial: 352.94,
  lightInstall: 600,
  socketMaterial: 518,
  socketInstall: 500,
  warmFloorMaterialUpTo3M2: 9_922.8,
  warmFloorInstallPerM2: 4_255,
  balconyTileWorkPerM2: 3_663,
  demolitionPerM2: 1_100
} as const;
