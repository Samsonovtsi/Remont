export type PackageCode = 'minimal' | 'standard' | 'comfort' | 'premium';
export type PropertyType = 'apartment' | 'house' | 'commercial';
export type Condition = 'new_build' | 'secondary_good' | 'secondary_worn' | 'shell';

export interface PackagePrice {
  title: string;
  minPerM2: number;
  maxPerM2: number;
  description: string;
}

// Текущие публичные диапазоны etagi.com/t/renovation/ на момент настройки калькулятора.
export const PACKAGE_PRICES: Record<PackageCode, PackagePrice> = {
  minimal: {
    title: 'Минимальный',
    minPerM2: 17_100,
    maxPerM2: 27_600,
    description: 'Базовый ремонт для быстрой сдачи или продажи'
  },
  standard: {
    title: 'Стандарт',
    minPerM2: 22_700,
    maxPerM2: 37_600,
    description: 'Современный дизайн и качественные материалы'
  },
  comfort: {
    title: 'Комфорт',
    minPerM2: 32_200,
    maxPerM2: 47_300,
    description: 'Улучшенная комплектация, стиль и комфорт'
  },
  premium: {
    title: 'Премиум',
    minPerM2: 42_800,
    maxPerM2: 61_600,
    description: 'Авторский дизайн и материалы премиум-класса'
  }
};

export const AGENT_REWARD_RATE = 0.05;

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
