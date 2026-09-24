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
  measurementMode: 'quick' | 'exact';
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
  agentRewardBase: number;
  clientTotal: number;
  pricePerM2Final: number;
  assumptions: {
    roughWallAreaM2?: number;
    cleanWallAreaM2?: number;
    roughFloorAreaM2?: number;
    wetTileAreaM2?: number;
    dryFloorAreaM2?: number;
    balconyTileAreaM2?: number;
    ceilingAreaM2?: number;
    demolitionAreaM2?: number;
    lights?: number;
    sockets?: number;
  };
  disclaimer: string;
}

const roundRub = (value: number) => Math.round(value);

function estimateGeometry(input: EstimateRequest) {
  const roomFactor = Math.min(Math.max(input.rooms, 1), 5);

  if (input.calculationMode === 'exact') {
    return {
      roughWallAreaM2: input.roughWallAreaM2 ?? 0,
      cleanWallAreaM2: input.cleanWallAreaM2 ?? 0,
      roughFloorAreaM2: input.roughFloorAreaM2 ?? 0,
      wetTileAreaM2: input.wetTileAreaM2 ?? 0,
      dryFloorAreaM2: input.dryFloorAreaM2 ?? 0,
      balconyTileAreaM2: input.balconyTileAreaM2 ?? 0,
      ceilingAreaM2: input.ceilingAreaM2 ?? 0,
      demolitionAreaM2: input.demolitionAreaM2 ?? 0,
      lights: input.lights ?? 0,
      sockets: input.sockets ?? 0
    };
  }

  return {
    roughWallAreaM2: input.areaM2 * (2.25 + roomFactor * 0.15),
    cleanWallAreaM2: input.areaM2 * (1.95 + roomFactor * 0.13),
    roughFloorAreaM2:
      input.package === 'comfort'
        ? input.areaM2
        : Math.min(input.areaM2, Math.max(input.bathrooms, 1) * 5),
    wetTileAreaM2: input.bathrooms > 0 ? input.bathrooms * 28 : 0,
    dryFloorAreaM2: Math.max(input.areaM2 - input.bathrooms * 5.5, 0),
    balconyTileAreaM2: input.hasBalcony ? 4 : 0,
    ceilingAreaM2: input.needsCeiling ? input.areaM2 : 0,
    demolitionAreaM2: input.needsDemolition ? input.areaM2 * 0.2 : 0,
    lights: input.needsFullElectrical ? Math.max(1, Math.round(input.areaM2 * 0.58)) : 0,
    sockets: input.needsFullElectrical ? Math.max(1, Math.round(input.areaM2 * 0.82)) : 0
  };
}

function calculateSmetaEstimate(input: EstimateRequest): EstimateResult {
  const rates = SMETA_RATES[input.package as 'standard' | 'comfort'];
  const geometry = estimateGeometry(input);
  const lines: EstimateLine[] = [];

  const roughWalls = geometry.roughWallAreaM2 * rates.roughWallPerM2;
  const roughFloor = geometry.roughFloorAreaM2 * rates.roughFloorPerM2;
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
  const balconyWorks = geometry.balconyTileAreaM2 * EXTRA_RATES.balconyTileWorkPerM2;

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

  if (input.needsCeiling && geometry.ceilingAreaM2 > 0) {
    additionalMaterials += geometry.ceilingAreaM2 * EXTRA_RATES.ceilingMaterialPerM2;
  }

  if (input.needsDemolition && geometry.demolitionAreaM2 > 0) {
    additionalWorks += geometry.demolitionAreaM2 * EXTRA_RATES.demolitionPerM2;
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

  // Бизнес-правило: риелтор получает 5% только от стоимости работ.
  // Материалы, доставка и НДС в базу вознаграждения не входят.
  const agentRewardBase = roundRub(worksTotal);
  const agentReward = roundRub(agentRewardBase * AGENT_REWARD_RATE);

  return {
    currency: 'RUB',
    areaM2: input.areaM2,
    package: input.package,
    calculationMode: 'smeta',
    measurementMode: input.calculationMode,
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
    agentRewardBase,
    clientTotal,
    pricePerM2Final: roundRub(clientTotal / input.areaM2),
    assumptions: {
      roughWallAreaM2: Math.round(geometry.roughWallAreaM2 * 10) / 10,
      cleanWallAreaM2: Math.round(geometry.cleanWallAreaM2 * 10) / 10,
      roughFloorAreaM2: Math.round(geometry.roughFloorAreaM2 * 10) / 10,
      wetTileAreaM2: Math.round(geometry.wetTileAreaM2 * 10) / 10,
      dryFloorAreaM2: Math.round(geometry.dryFloorAreaM2 * 10) / 10,
      balconyTileAreaM2: Math.round(geometry.balconyTileAreaM2 * 10) / 10,
      ceilingAreaM2: Math.round(geometry.ceilingAreaM2 * 10) / 10,
      demolitionAreaM2: Math.round(geometry.demolitionAreaM2 * 10) / 10,
      lights: geometry.lights,
      sockets: geometry.sockets
    },
    disclaimer:
      input.calculationMode === 'exact'
        ? 'Точная смета рассчитана по введённым замерам. Вознаграждение риелтора = 5% только от стоимости работ; материалы, доставка и НДС не входят в базу вознаграждения.'
        : 'Быстрый расчёт использует автоматическую оценку площадей и электроточек. Для точной сметы переключитесь в режим «Точная по замерам». Вознаграждение риелтора = 5% только от стоимости работ.'
  };
}

function calculateFixedPackageEstimate(input: EstimateRequest): EstimateResult {
  const pkg = PACKAGE_PRICES[input.package];
  const basePricePerM2 = pkg.minPerM2;

  // В буклете Минимальный и Премиум заданы как фиксированная стартовая
  // стоимость "от ... ₽/м²" без уровней комплектации.
  let packageTotal = input.areaM2 * basePricePerM2;
  packageTotal *= CONDITION_FACTOR[input.condition] * PROPERTY_FACTOR[input.propertyType];

  const lines: EstimateLine[] = [{
    code: 'package_fixed',
    title: pkg.title + ': базовая стоимость по пакету',
    amount: roundRub(packageTotal),
    group: 'materials'
  }];

  // В буклете прямо указано, что электрика и освещение считаются дополнительно.
  let knownExtraWorks = 0;
  let knownExtraMaterials = 0;

  if (input.needsFullElectrical) {
    const lights = input.calculationMode === 'exact'
      ? (input.lights ?? 0)
      : Math.max(1, Math.round(input.areaM2 * 0.58));
    const sockets = input.calculationMode === 'exact'
      ? (input.sockets ?? 0)
      : Math.max(1, Math.round(input.areaM2 * 0.82));

    knownExtraWorks =
      input.areaM2 * EXTRA_RATES.electricalPerM2 +
      lights * EXTRA_RATES.lightInstall +
      sockets * EXTRA_RATES.socketInstall;

    knownExtraMaterials =
      lights * EXTRA_RATES.lightMaterial +
      sockets * EXTRA_RATES.socketMaterial;

    lines.push({
      code: 'electrical_extra_works',
      title: 'Электрика и освещение — дополнительные работы',
      amount: roundRub(knownExtraWorks),
      group: 'works'
    });

    if (knownExtraMaterials > 0) {
      lines.push({
        code: 'electrical_extra_materials',
        title: 'Электрика и освещение — дополнительные материалы',
        amount: roundRub(knownExtraMaterials),
        group: 'materials'
      });
    }
  }

  const clientTotal = roundRub(packageTotal + knownExtraWorks + knownExtraMaterials);

  return {
    currency: 'RUB',
    areaM2: input.areaM2,
    package: input.package,
    calculationMode: 'range',
    measurementMode: input.calculationMode,
    basePricePerM2: roundRub(basePricePerM2),
    lines,
    worksTotal: roundRub(knownExtraWorks),
    materialsTotal: roundRub(knownExtraMaterials),
    deliveryTotal: 0,
    subtotalBeforeVat: clientTotal,
    vatRate: 0,
    vat: 0,
    estimateBeforeReward: clientTotal,
    agentRewardRate: AGENT_REWARD_RATE,
    // Буклет не разделяет базовую цену пакета на работы и материалы.
    // Поэтому нельзя корректно посчитать 5% риелтора от всех работ пакета.
    agentReward: 0,
    agentRewardBase: 0,
    clientTotal,
    pricePerM2Final: roundRub(clientTotal / input.areaM2),
    assumptions: {},
    disclaimer:
      'Для этого пакета используется цена из буклета «от ' +
      basePricePerM2.toLocaleString('ru-RU') +
      ' ₽/м²». Уровень комплектации не применяется. Электрика и освещение считаются отдельно. Буклет не содержит разбивки базовой цены на работы и материалы, поэтому точное вознаграждение риелтора 5% от работ для базового пакета пока не рассчитывается.'
  };
}

export function calculateEstimate(input: EstimateRequest): EstimateResult {
  if (input.package === 'standard' || input.package === 'comfort') {
    return calculateSmetaEstimate(input);
  }
  return calculateFixedPackageEstimate(input);
}
