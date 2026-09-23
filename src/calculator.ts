import {
  AGENT_REWARD_RATE,
  CONDITION_FACTOR,
  DELIVERY_RATE,
  EXTRA_RATES,
  PACKAGE_PRICES,
  PROPERTY_FACTOR,
  SMETA_RATES,
  VAT_RATE
} from './pricing.js';
import type { EstimateRequest } from './schema.js';

export interface EstimateLine {
  code: string;
  title: string;
  amount: number;
  group?: 'works' | 'materials' | 'delivery' | 'tax' | 'adjustment';
}

export interface EstimateResult {
  currency: 'RUB';
  areaM2: number;
  package: string;
  calculationMode: 'range' | 'smeta';
  basePricePerM2: number;
  lines: EstimateLine[];
  worksTotal: number;
  materialsTotal: number;
  deliveryTotal: number;
  subtotalBeforeVat: number;
  vatRate: number;
  vat: number;
  estimateBeforeReward: number;
  agentRewardRate: number;
  agentReward: number;
  clientTotal: number;
  pricePerM2Final: number;
  assumptions: {
    roughWallAreaM2?: number;
    cleanWallAreaM2?: number;
    wetTileAreaM2?: number;
    dryFloorAreaM2?: number;
    lights?: number;
    sockets?: number;
  };
  disclaimer: string;
}

const roundRub = (value: number) => Math.round(value);

function estimateGeometry(input: EstimateRequest) {
  const roomFactor = Math.min(Math.max(input.rooms, 1), 5);
  const roughWallAreaM2 = input.areaM2 * (2.25 + roomFactor * 0.15);
  const cleanWallAreaM2 = input.areaM2 * (1.95 + roomFactor * 0.13);
  const wetTileAreaM2 = input.bathrooms > 0 ? input.bathrooms * 28 : 0;
  const dryFloorAreaM2 = Math.max(input.areaM2 - input.bathrooms * 5.5, 0);
  const lights = input.needsFullElectrical ? Math.max(1, Math.round(input.areaM2 * 0.58)) : 0;
  const sockets = input.needsFullElectrical ? Math.max(1, Math.round(input.areaM2 * 0.82)) : 0;

  return {
    roughWallAreaM2,
    cleanWallAreaM2,
    wetTileAreaM2,
    dryFloorAreaM2,
    lights,
    sockets
  };
}

function calculateSmetaEstimate(input: EstimateRequest): EstimateResult {
  const rates = SMETA_RATES[input.package as 'standard' | 'comfort'];
  const pkg = PACKAGE_PRICES[input.package];
  const geometry = estimateGeometry(input);
  const lines: EstimateLine[] = [];

  const roughFloorArea =
    input.package === 'comfort'
      ? input.areaM2
      : Math.min(input.areaM2, Math.max(input.bathrooms, 1) * 5);

  const roughWalls = geometry.roughWallAreaM2 * rates.roughWallPerM2;
  const roughFloor = roughFloorArea * rates.roughFloorPerM2;
  const roughPlumbing = input.needsFullPlumbing
    ? rates.plumbingRough * (1 + Math.max(0, input.bathrooms - 1) * 0.8)
    : 0;

  const roughWorks = roughWalls + roughFloor + roughPlumbing;
  lines.push({
    code: 'rough_works',
    title: 'Черновые работы',
    amount: roundRub(roughWorks),
    group: 'works'
  });

  const cleanWalls = geometry.cleanWallAreaM2 * rates.cleanWallPerM2;
  const cleanFloor = geometry.dryFloorAreaM2 * rates.cleanFloorPerM2;
  const tileWorks = geometry.wetTileAreaM2 * rates.tilePerM2;
  const cleanPlumbing = input.needsFullPlumbing
    ? rates.plumbingClean * (1 + Math.max(0, input.bathrooms - 1) * 0.8)
    : 0;
  const balconyWorks = input.hasBalcony ? 4 * EXTRA_RATES.balconyTileWorkPerM2 : 0;

  const cleanWorks = cleanWalls + cleanFloor + tileWorks + cleanPlumbing + balconyWorks;
  lines.push({
    code: 'clean_works',
    title: 'Чистовые работы',
    amount: roundRub(cleanWorks),
    group: 'works'
  });

  const electricalWorks = input.needsFullElectrical
    ? input.areaM2 * EXTRA_RATES.electricalPerM2
    : 0;

  if (electricalWorks > 0) {
    lines.push({
      code: 'electrical_works',
      title: 'Электрика',
      amount: roundRub(electricalWorks),
      group: 'works'
    });
  }

  let additionalWorks = 0;
  let additionalMaterials = 0;

  if (input.needsFullElectrical) {
    additionalWorks +=
      geometry.lights * EXTRA_RATES.lightInstall +
      geometry.sockets * EXTRA_RATES.socketInstall;
    additionalMaterials +=
      geometry.lights * EXTRA_RATES.lightMaterial +
      geometry.sockets * EXTRA_RATES.socketMaterial;
  }

  if (input.doors > 0) {
    additionalWorks += input.doors * EXTRA_RATES.doorInstall + EXTRA_RATES.doorwayInstall;
    additionalMaterials += input.doors * EXTRA_RATES.doorMaterial + EXTRA_RATES.doorwayMaterial;
  }

  if (input.warmFloorM2 > 0) {
    additionalWorks += input.warmFloorM2 * EXTRA_RATES.warmFloorInstallPerM2;
    additionalMaterials +=
      Math.ceil(input.warmFloorM2 / 3) * EXTRA_RATES.warmFloorMaterialUpTo3M2;
  }

  if (input.needsCeiling) {
    additionalMaterials += input.areaM2 * EXTRA_RATES.ceilingMaterialPerM2;
  }

  if (input.needsDemolition) {
    // В сметах демонтаж указан за фактическую площадь перегородок.
    // Без чертежа считаем 20% площади объекта как предварительный объём.
    additionalWorks += input.areaM2 * 0.2 * EXTRA_RATES.demolitionPerM2;
  }

  if (additionalWorks > 0) {
    lines.push({
      code: 'additional_works',
      title: 'Дополнительные работы',
      amount: roundRub(additionalWorks),
      group: 'works'
    });
  }

  const roughMaterials = (roughWorks + electricalWorks) * rates.roughMaterialsFactor;
  const cleanMaterials = cleanWorks * rates.cleanMaterialsFactor;
  const packageMaterials = roughMaterials + cleanMaterials;

  lines.push({
    code: 'rough_materials',
    title: 'Черновые материалы',
    amount: roundRub(roughMaterials),
    group: 'materials'
  });
  lines.push({
    code: 'clean_materials',
    title: 'Чистовые материалы',
    amount: roundRub(cleanMaterials + additionalMaterials),
    group: 'materials'
  });

  const worksTotal = roughWorks + cleanWorks + electricalWorks + additionalWorks;
  const materialsTotal = packageMaterials + additionalMaterials;
  const deliveryTotal = materialsTotal * DELIVERY_RATE;

  lines.push({
    code: 'delivery',
    title: 'Доставка / разгрузка / вывоз мусора',
    amount: roundRub(deliveryTotal),
    group: 'delivery'
  });

  let subtotalBeforeVat = worksTotal + materialsTotal + deliveryTotal;

  const modelAdjustment =
    subtotalBeforeVat *
    (CONDITION_FACTOR[input.condition] * PROPERTY_FACTOR[input.propertyType] - 1);

  if (Math.abs(modelAdjustment) >= 1) {
    lines.push({
      code: 'object_adjustment',
      title: 'Поправка на тип и состояние объекта',
      amount: roundRub(modelAdjustment),
      group: 'adjustment'
    });
    subtotalBeforeVat += modelAdjustment;
  }

  const vat = subtotalBeforeVat * VAT_RATE;
  lines.push({
    code: 'vat',
    title: 'НДС 5%',
    amount: roundRub(vat),
    group: 'tax'
  });

  const clientTotal = roundRub(subtotalBeforeVat + vat);
  const agentReward = roundRub(clientTotal * AGENT_REWARD_RATE);

  return {
    currency: 'RUB',
    areaM2: input.areaM2,
    package: input.package,
    calculationMode: 'smeta',
    basePricePerM2: roundRub(clientTotal / input.areaM2),
    lines,
    worksTotal: roundRub(worksTotal),
    materialsTotal: roundRub(materialsTotal),
    deliveryTotal: roundRub(deliveryTotal),
    subtotalBeforeVat: roundRub(subtotalBeforeVat),
    vatRate: VAT_RATE,
    vat: roundRub(vat),
    estimateBeforeReward: clientTotal,
    agentRewardRate: AGENT_REWARD_RATE,
    agentReward,
    clientTotal,
    pricePerM2Final: roundRub(clientTotal / input.areaM2),
    assumptions: {
      roughWallAreaM2: Math.round(geometry.roughWallAreaM2 * 10) / 10,
      cleanWallAreaM2: Math.round(geometry.cleanWallAreaM2 * 10) / 10,
      wetTileAreaM2: Math.round(geometry.wetTileAreaM2 * 10) / 10,
      dryFloorAreaM2: Math.round(geometry.dryFloorAreaM2 * 10) / 10,
      lights: geometry.lights,
      sockets: geometry.sockets
    },
    disclaimer:
      'Расчёт построен по структуре загруженных смет: работы + материалы + доставка 10% от материалов + НДС 5%. Площади стен, плитки и количество электроточек оцениваются автоматически и уточняются после замера.'
  };
}

function calculateRangeEstimate(input: EstimateRequest): EstimateResult {
  const pkg = PACKAGE_PRICES[input.package];
  const basePricePerM2 =
    pkg.minPerM2 + (pkg.maxPerM2 - pkg.minPerM2) * input.finishLevel;

  let subtotal = input.areaM2 * basePricePerM2;
  subtotal *= CONDITION_FACTOR[input.condition] * PROPERTY_FACTOR[input.propertyType];

  if (input.warmFloorM2 > 0) {
    subtotal +=
      input.warmFloorM2 * EXTRA_RATES.warmFloorInstallPerM2 +
      Math.ceil(input.warmFloorM2 / 3) * EXTRA_RATES.warmFloorMaterialUpTo3M2;
  }

  const lines: EstimateLine[] = [
    {
      code: 'package_range',
      title: pkg.title + ': ориентировочная стоимость',
      amount: roundRub(subtotal),
      group: 'works'
    }
  ];

  const clientTotal = roundRub(subtotal);
  const agentReward = roundRub(clientTotal * AGENT_REWARD_RATE);

  return {
    currency: 'RUB',
    areaM2: input.areaM2,
    package: input.package,
    calculationMode: 'range',
    basePricePerM2: roundRub(basePricePerM2),
    lines,
    worksTotal: clientTotal,
    materialsTotal: 0,
    deliveryTotal: 0,
    subtotalBeforeVat: clientTotal,
    vatRate: 0,
    vat: 0,
    estimateBeforeReward: clientTotal,
    agentRewardRate: AGENT_REWARD_RATE,
    agentReward,
    clientTotal,
    pricePerM2Final: roundRub(clientTotal / input.areaM2),
    assumptions: {},
    disclaimer:
      'Для пакетов Минимальный и Премиум в загруженных материалах нет детальной постатейной сметы. Поэтому используется пакетный диапазон, а не сметная модель.'
  };
}

export function calculateEstimate(input: EstimateRequest): EstimateResult {
  if (input.package === 'standard' || input.package === 'comfort') {
    return calculateSmetaEstimate(input);
  }
  return calculateRangeEstimate(input);
}
