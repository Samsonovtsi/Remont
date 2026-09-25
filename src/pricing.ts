export type PackageCode = 'minimal' | 'standard' | 'comfort' | 'premium';
export type PropertyType = 'apartment' | 'house' | 'commercial';
export type Condition = 'new_build' | 'secondary_good' | 'secondary_worn' | 'shell';

export interface PackagePrice {
  title: string;
  minPerM2: number;
  maxPerM2: number;
  description: string;
  calculationMode: 'fixed' | 'smeta';
  included: string[];
  roomFinish: string[];
  bathroomFinish: string[];
  gifts: string[];
  notes: string[];
}

export const PACKAGE_PRICES: Record<PackageCode, PackagePrice> = {
  minimal: {
    title: 'Минимальный',
    minPerM2: 17_100,
    maxPerM2: 27_600,
    description: 'Доступный ремонт для создания функциональной основы.',
    calculationMode: 'smeta',
    included: ['Работы', 'Черновые материалы', 'Чистовые материалы', 'Доставка', 'Вынос мусора'],
    roomFinish: [
      'Выравнивание стен под правило в местах примыкания',
      'Флизелиновые обои',
      'Натяжной потолок',
      'Закладные для карнизов',
      'Оконные откосы: сэндвич-панели / уголки',
      'Подоконники ПВХ',
      'Ламинат',
      'Напольный плинтус ПВХ'
    ],
    bathroomFinish: [
      'Принудительная вентиляция',
      'Стены: керамическая плитка / керамогранит 60×30',
      'Пол: керамогранит 60×60',
      'Выводы под чистовую сантехнику'
    ],
    gifts: [
      'Один бесплатный клининг после строительных работ',
      'Технические чертежи',
      'Страхование ремонта после завершения работ',
      'Профессиональная фото/видео съёмка готового ремонта'
    ],
    notes: [
      'Электрика рассчитывается дополнительно',
      'Освещение рассчитывается дополнительно',
      'Дополнительные работы рассчитываются по фактическим объёмам'
    ]
  },
  standard: {
    title: 'Стандарт',
    minPerM2: 22_700,
    maxPerM2: 37_600,
    description: 'Быстрый и эффективный способ обновить интерьер с доступными материалами.',
    calculationMode: 'smeta',
    included: ['Работы', 'Черновые материалы', 'Чистовые материалы', 'Сантехника', 'Доставка', 'Вынос мусора'],
    roomFinish: [
      'Выравнивание стен под правило в местах примыкания',
      'Флизелиновые обои',
      'Натяжной потолок',
      'Закладные для карнизов',
      'Оконные откосы: сэндвич-панели / уголки',
      'Подоконники ПВХ',
      'Ламинат',
      'Напольный плинтус ПВХ',
      'Межкомнатные двери по проекту',
      'Облагораживание дверных проёмов',
      'Облагораживание входной двери: МДФ'
    ],
    bathroomFinish: [
      'Принудительная вентиляция',
      'Стены: плитка / керамогранит 60×30, металлический уголок на торцах',
      'Пол: керамогранит 60×60',
      'Акриловая ванна — 1 шт.',
      'Пластиковый экран для ванной — 1 шт.',
      'Напольный унитаз — 1 шт.',
      'Тумба с раковиной и смесителем — 1 шт.',
      'Душевая стойка с тропическим душем — 1 шт.',
      'Электрический полотенцесушитель — 1 шт.',
      'Зеркало над раковиной — 1 шт.'
    ],
    gifts: [
      'Один бесплатный клининг после строительных работ',
      'Технические чертежи',
      'Страхование ремонта после завершения работ',
      'Профессиональная фото/видео съёмка готового ремонта'
    ],
    notes: [
      'Электрика рассчитывается дополнительно',
      'Освещение рассчитывается дополнительно',
      'Дополнительные работы рассчитываются по фактическим объёмам'
    ]
  },
  comfort: {
    title: 'Комфорт',
    minPerM2: 32_200,
    maxPerM2: 47_300,
    description: 'Продуманное решение с улучшенными материалами, деталями и атмосферой.',
    calculationMode: 'smeta',
    included: ['Работы', 'Черновые материалы', 'Чистовые материалы', 'Сантехника', 'Доставка', 'Вынос мусора'],
    roomFinish: [
      'Подготовка и выравнивание всех поверхностей под правило',
      'Обои под покраску и окрашивание обоев',
      'Натяжной потолок',
      'Ниши для карнизов',
      'Оконные откосы: сэндвич-панели / уголки',
      'Подоконники ПВХ',
      'Клеевой кварцвинил',
      'Напольный плинтус ПВХ',
      'Межкомнатные двери по проекту',
      'Облагораживание дверных проёмов',
      'Облагораживание входной двери: МДФ'
    ],
    bathroomFinish: [
      'Принудительная вентиляция',
      'Стены: керамогранит 60×60, запил углов под 45°',
      'Пол: керамогранит 60×60',
      'Акриловая ванна — 1 шт.',
      'Пластиковый экран для ванной — 1 шт.',
      'Инсталляция — 1 шт.',
      'Тумба с раковиной и смесителем — 1 шт.',
      'Душевая система с тропическим душем — 1 шт.',
      'Электрический полотенцесушитель — 1 шт.',
      'Зеркало с подсветкой — 1 шт.'
    ],
    gifts: [
      'Один бесплатный клининг после строительных работ',
      'Технические чертежи',
      'Страхование ремонта после завершения работ',
      'Профессиональная фото/видео съёмка готового ремонта'
    ],
    notes: [
      'Электрика рассчитывается дополнительно',
      'Освещение рассчитывается дополнительно',
      'Дополнительные работы рассчитываются по фактическим объёмам'
    ]
  },
  premium: {
    title: 'Премиум',
    minPerM2: 42_800,
    maxPerM2: 61_600,
    description: 'Комплексное преображение пространства с вниманием к каждой детали.',
    calculationMode: 'fixed',
    included: ['Работы', 'Черновые материалы', 'Чистовые материалы', 'Сантехника', 'Доставка', 'Вынос мусора'],
    roomFinish: [
      'Подготовка и выравнивание всех поверхностей под маяк',
      'Окрашивание стен + одна акцентная стена с декоративной штукатуркой',
      'Натяжной потолок',
      'Ниши для карнизов',
      'Оконные откосы: ГКЛ с окрашиванием',
      'Подоконники Danke',
      'Замковый кварцвинил',
      'Окрашенный дюрополимерный плинтус',
      'Межкомнатные двери по проекту',
      'Дверные проёмы в кухне / гостиной / кухне-гостиной',
      'Облагораживание входной двери ГКЛ с окрашиванием'
    ],
    bathroomFinish: [
      'Принудительная вентиляция',
      'Стены: керамогранит 60×60 + акцентная стена 120×60, запил углов под 45°',
      'Пол: керамогранит 60×60',
      'Акриловая ванна — 1 шт.',
      'Экран для ванной из керамогранита — 1 шт.',
      'Инсталляция — 1 шт.',
      'Тумба с раковиной и смесителем — 1 шт.',
      'Душевая система с тропическим душем — 1 шт.',
      'Электрический полотенцесушитель — 1 шт.',
      'Зеркало с подсветкой — 1 шт.'
    ],
    gifts: [
      'Один бесплатный клининг после строительных работ',
      'Технические чертежи',
      'Страхование ремонта после завершения работ',
      'Профессиональная фото/видео съёмка готового ремонта'
    ],
    notes: [
      'Электрика рассчитывается дополнительно',
      'Освещение рассчитывается дополнительно',
      'Дополнительные работы рассчитываются по фактическим объёмам'
    ]
  }
};

export interface OfficialApartmentPriceBand {
  minArea: number;
  maxArea: number;
  label: string;
  prices: Record<PackageCode, number>;
}

// Официальная матрица из листа «2026 ГОД квартиры» файла «Тех карта менеджера.xlsx».
// Стоимость за м²: работы + черновые материалы + чистовые материалы, без доп. услуг.
export const OFFICIAL_APARTMENT_PRICE_BANDS_2026: OfficialApartmentPriceBand[] = [
  { minArea: 20, maxArea: 29.999, label: '20–29 м²', prices: { minimal: 27_600, standard: 37_600, comfort: 47_300, premium: 61_600 } },
  { minArea: 30, maxArea: 39.999, label: '30–39 м²', prices: { minimal: 26_800, standard: 33_700, comfort: 41_200, premium: 53_900 } },
  { minArea: 40, maxArea: 49.999, label: '40–49 м²', prices: { minimal: 25_600, standard: 28_300, comfort: 36_800, premium: 47_400 } },
  { minArea: 50, maxArea: 59.999, label: '50–59 м²', prices: { minimal: 19_600, standard: 26_400, comfort: 35_100, premium: 45_300 } },
  { minArea: 60, maxArea: 69.999, label: '60–69 м²', prices: { minimal: 18_300, standard: 24_600, comfort: 34_400, premium: 43_400 } },
  { minArea: 70, maxArea: 79.999, label: '70–79 м²', prices: { minimal: 17_500, standard: 24_200, comfort: 33_300, premium: 43_300 } },
  { minArea: 80, maxArea: 89.999, label: '80–89 м²', prices: { minimal: 17_100, standard: 22_700, comfort: 32_200, premium: 42_800 } }
];

export function getOfficialApartmentPackageRate(areaM2: number, code: PackageCode) {
  const exactBand = OFFICIAL_APARTMENT_PRICE_BANDS_2026.find(
    band => areaM2 >= band.minArea && areaM2 <= band.maxArea
  );

  if (exactBand) {
    return {
      rate: exactBand.prices[code],
      band: exactBand.label,
      outsideOfficialRange: false
    };
  }

  const nearest =
    areaM2 < 20
      ? OFFICIAL_APARTMENT_PRICE_BANDS_2026[0]
      : OFFICIAL_APARTMENT_PRICE_BANDS_2026[OFFICIAL_APARTMENT_PRICE_BANDS_2026.length - 1];

  return {
    rate: nearest.prices[code],
    band: nearest.label,
    outsideOfficialRange: true
  };
}

export let AGENT_REWARD_RATE = 0.05;
export let VAT_RATE = 0.05;
export let DELIVERY_RATE = 0.10;

export function setPricingConstant(
  key: 'agentRewardRate' | 'vatRate' | 'deliveryRate',
  value: number
) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Некорректное значение коэффициента');
  }

  if (key === 'agentRewardRate') AGENT_REWARD_RATE = value;
  if (key === 'vatRate') VAT_RATE = value;
  if (key === 'deliveryRate') DELIVERY_RATE = value;
}

// В предоставленных сметах нет подтверждённых процентных надбавок
// по типу/состоянию объекта. Поэтому эти параметры не меняют цену автоматически.
// Коэффициенты состояния применяются только к базовым отделочным работам.
 // Это настраиваемая модель оценки дополнительной трудоёмкости, а не ставка из конкретной сметы.
export const CONDITION_FACTOR: Record<Condition, number> = {
  new_build: 1.00,
  secondary_good: 1.04,
  secondary_worn: 1.12,
  shell: 1.08
};

export function setConditionFactor(condition: Condition, value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Некорректный коэффициент состояния');
  }
  CONDITION_FACTOR[condition] = value;
}

export const PROPERTY_FACTOR: Record<PropertyType, number> = {
  apartment: 1.00,
  house: 1.00,
  commercial: 1.00
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

export const SMETA_RATES: Record<'minimal' | 'standard' | 'comfort' | 'premium', SmetaRates> = {
  minimal: {
    roughWallPerM2: 832.5,
    cleanWallPerM2: 536.5,
    roughFloorPerM2: 462.5,
    cleanFloorPerM2: 823.25,
    tilePerM2: 3_700,
    plumbingRough: 40_700,
    plumbingClean: 27_750,
    roughMaterialsFactor: 0.44,
    cleanMaterialsFactor: 0.99
  },
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
  },
  premium: {
    roughWallPerM2: 3_000,
    cleanWallPerM2: 1_500,
    roughFloorPerM2: 700,
    cleanFloorPerM2: 1_990,
    tilePerM2: 7_000,
    plumbingRough: 50_000,
    plumbingClean: 25_000,
    roughMaterialsFactor: 0.55,
    cleanMaterialsFactor: 1.26
  }
};

export interface ExtraRates {
  electricalPerM2: number;
  ceilingMaterialPerM2: number;
  ceilingInstallPerM2: number;
  doorMaterial: number;
  doorInstall: number;
  doorwayMaterial: number;
  doorwayInstall: number;
  lightMaterial: number;
  lightInstall: number;
  socketMaterial: number;
  socketInstall: number;
  warmFloorMaterialUpTo3M2: number;
  warmFloorInstallPerM2: number;
  balconyTileWorkPerM2: number;
  demolitionPerM2: number;
}

export const EXTRA_RATES_BY_PACKAGE: Record<'minimal' | 'standard' | 'comfort' | 'premium', ExtraRates> = {
  minimal: {
    electricalPerM2: 1_850,
    ceilingMaterialPerM2: 715,
    ceilingInstallPerM2: 2_560,
    doorMaterial: 7_521.86,
    doorInstall: 10_000,
    doorwayMaterial: 4_720,
    doorwayInstall: 7_000,
    lightMaterial: 187.58,
    lightInstall: 600,
    socketMaterial: 209,
    socketInstall: 600,
    warmFloorMaterialUpTo3M2: 9_922.8,
    warmFloorInstallPerM2: 4_255,
    balconyTileWorkPerM2: 3_700,
    demolitionPerM2: 1_100
  },
  standard: {
    electricalPerM2: 1_961,
    ceilingMaterialPerM2: 319,
    ceilingInstallPerM2: 0,
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
  },
  comfort: {
    electricalPerM2: 1_961,
    ceilingMaterialPerM2: 319,
    ceilingInstallPerM2: 0,
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
  },
  premium: {
    electricalPerM2: 1_961,
    ceilingMaterialPerM2: 605,
    ceilingInstallPerM2: 1_980,
    doorMaterial: 22_920,
    doorInstall: 10_000,
    doorwayMaterial: 8_200,
    doorwayInstall: 7_000,
    lightMaterial: 352.94,
    lightInstall: 600,
    socketMaterial: 518,
    socketInstall: 600,
    warmFloorMaterialUpTo3M2: 11_576.6,
    warmFloorInstallPerM2: 4_255,
    balconyTileWorkPerM2: 3_700,
    demolitionPerM2: 1_100
  }
};

// Ориентир для отдельной коммерческой плиточной сметы (Новосёлов 92).
export const COMMERCIAL_TILE_RATES = {
  floorPrimerWorkPerM2: 120,
  tileWorkPerM2: 3_552,
  tileMaterialPerM2: 1_200
} as const;
