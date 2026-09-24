import {
  AGENT_REWARD_RATE,
  DELIVERY_RATE,
  EXTRA_RATES_BY_PACKAGE,
  PACKAGE_PRICES,
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
    ceilingWorkAreaM2?: number;
    electricalAreaM2?: number;
    demolitionAreaM2?: number;
    lights?: number;
    sockets?: number;
    doorways?: number;
  };
  disclaimer: string;
}

const roundRub = (value: number) => Math.round(value);
const round1 = (value: number) => Math.round(value * 10) / 10;

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
      ceilingWorkAreaM2: input.ceilingWorkAreaM2 ?? input.ceilingAreaM2 ?? 0,
      electricalAreaM2: input.electricalAreaM2 ?? input.areaM2,
      demolitionAreaM2: input.demolitionAreaM2 ?? 0,
      lights: input.lights ?? 0,
      sockets: input.sockets ?? 0
    };
  }

  const balconyArea = input.hasBalcony ? Math.min(4, input.areaM2 * 0.15) : 0;
  const interiorArea = Math.max(input.areaM2 - balconyArea, 0);
  const bathroomFloorArea = Math.min(interiorArea, Math.max(input.bathrooms, 0) * 4.2);

  return {
    roughWallAreaM2: input.areaM2 * (2.35 + roomFactor * 0.10),
    cleanWallAreaM2: input.areaM2 * (2.05 + roomFactor * 0.10),
    roughFloorAreaM2:
      input.package === 'comfort'
        ? interiorArea
        : bathroomFloorArea,
    wetTileAreaM2: input.bathrooms > 0 ? input.bathrooms * 28.5 : 0,
    dryFloorAreaM2: Math.max(interiorArea - bathroomFloorArea, 0),
    balconyTileAreaM2: balconyArea,
    ceilingAreaM2: input.needsCeiling ? interiorArea : 0,
    ceilingWorkAreaM2: input.needsCeiling && input.package === 'minimal' ? interiorArea : 0,
    electricalAreaM2: interiorArea,
    demolitionAreaM2: input.needsDemolition ? input.areaM2 * 0.2 : 0,
    lights: input.needsFullElectrical ? Math.max(1, Math.round(interiorArea * 0.65)) : 0,
    sockets: input.needsFullElectrical ? Math.max(1, Math.round(interiorArea * 0.88)) : 0
  };
}

function calculateSmetaEstimate(input: EstimateRequest): EstimateResult {
  const code = input.package as 'minimal' | 'standard' | 'comfort';
  const rates = SMETA_RATES[code];
  const extras = EXTRA_RATES_BY_PACKAGE[code];
  const geometry = estimateGeometry(input);
  const lines: EstimateLine[] = [];

  const roughWalls = geometry.roughWallAreaM2 * rates.roughWallPerM2;
  const roughFloor = geometry.roughFloorAreaM2 * rates.roughFloorPerM2;
  const roughPlumbing = input.needsFullPlumbing ? rates.plumbingRough : 0;
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
  const cleanPlumbing = input.needsFullPlumbing ? rates.plumbingClean : 0;
  const balconyWorks = geometry.balconyTileAreaM2 * extras.balconyTileWorkPerM2;
  const cleanWorks = cleanWalls + cleanFloor + tileWorks + cleanPlumbing + balconyWorks;

  lines.push({
    code: 'clean_works',
    title: 'Чистовые работы',
    amount: roundRub(cleanWorks),
    group: 'works'
  });

  const electricalWorks = input.needsFullElectrical
    ? geometry.electricalAreaM2 * extras.electricalPerM2
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
      geometry.lights * extras.lightInstall +
      geometry.sockets * extras.socketInstall;
    additionalMaterials +=
      geometry.lights * extras.lightMaterial +
      geometry.sockets * extras.socketMaterial;
  }

  if (input.doors > 0) {
    additionalWorks += input.doors * extras.doorInstall;
    additionalMaterials += input.doors * extras.doorMaterial;
  }

  if (input.doorways > 0) {
    additionalWorks += input.doorways * extras.doorwayInstall;
    additionalMaterials += input.doorways * extras.doorwayMaterial;
  }

  if (input.warmFloorM2 > 0) {
    additionalWorks += input.warmFloorM2 * extras.warmFloorInstallPerM2;
    additionalMaterials +=
      Math.ceil(input.warmFloorM2 / 3) * extras.warmFloorMaterialUpTo3M2;
  }

  if (input.needsCeiling && geometry.ceilingAreaM2 > 0) {
    additionalMaterials += geometry.ceilingAreaM2 * extras.ceilingMaterialPerM2;
    additionalWorks += geometry.ceilingWorkAreaM2 * extras.ceilingInstallPerM2;
  }

  if (input.needsDemolition && geometry.demolitionAreaM2 > 0) {
    additionalWorks += geometry.demolitionAreaM2 * extras.demolitionPerM2;
  }

  if (additionalWorks > 0) {
    lines.push({
      code: 'additional_works',
      title: 'Дополнительные работы',
      amount: roundRub(additionalWorks),
      group: 'works'
    });
  }

  // В сметах коэффициент черновых материалов применяется к черновым работам + электрике.
  const roughMaterials = (roughWorks + electricalWorks) * rates.roughMaterialsFactor;
  // Коэффициент чистовых материалов применяется к блоку чистовых работ.
  const cleanMaterialsBase = cleanWorks * rates.cleanMaterialsFactor;
  const materialsTotal = roughMaterials + cleanMaterialsBase + additionalMaterials;

  lines.push({
    code: 'rough_materials',
    title: 'Черновые материалы',
    amount: roundRub(roughMaterials),
    group: 'materials'
  });

  lines.push({
    code: 'clean_materials',
    title: 'Чистовые материалы и комплектующие',
    amount: roundRub(cleanMaterialsBase + additionalMaterials),
    group: 'materials'
  });

  const worksTotal = roughWorks + cleanWorks + electricalWorks + additionalWorks;
  const deliveryTotal = materialsTotal * DELIVERY_RATE;

  lines.push({
    code: 'delivery',
    title: 'Доставка / разгрузка / вывоз мусора',
    amount: roundRub(deliveryTotal),
    group: 'delivery'
  });

  const subtotalBeforeVat = worksTotal + materialsTotal + deliveryTotal;
  const vat = subtotalBeforeVat * VAT_RATE;

  lines.push({
    code: 'vat',
    title: 'НДС 5%',
    amount: roundRub(vat),
    group: 'tax'
  });

  const clientTotal = roundRub(subtotalBeforeVat + vat);
  const agentRewardBase = roundRub(worksTotal);
  const agentReward = roundRub(agentRewardBase * AGENT_REWARD_RATE);

  const objectNote =
    input.condition === 'new_build' && input.propertyType === 'apartment'
      ? ''
      : ' Тип и состояние объекта сохранены как параметры, но автоматическая процентная надбавка не применяется: в исходных сметах такой коэффициент не подтверждён.';

  return {
    currency: 'RUB',
    areaM2: input.areaM2,
    package: input.package,
    calculationMode: 'smeta',
    measurementMode: input.calculationMode,
    basePricePerM2: PACKAGE_PRICES[input.package].minPerM2,
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
      roughWallAreaM2: round1(geometry.roughWallAreaM2),
      cleanWallAreaM2: round1(geometry.cleanWallAreaM2),
      roughFloorAreaM2: round1(geometry.roughFloorAreaM2),
      wetTileAreaM2: round1(geometry.wetTileAreaM2),
      dryFloorAreaM2: round1(geometry.dryFloorAreaM2),
      balconyTileAreaM2: round1(geometry.balconyTileAreaM2),
      ceilingAreaM2: round1(geometry.ceilingAreaM2),
      ceilingWorkAreaM2: round1(geometry.ceilingWorkAreaM2),
      electricalAreaM2: round1(geometry.electricalAreaM2),
      demolitionAreaM2: round1(geometry.demolitionAreaM2),
      lights: geometry.lights,
      sockets: geometry.sockets,
      doorways: input.doorways
    },
    disclaimer:
      input.calculationMode === 'exact'
        ? 'Смета рассчитана по введённым замерам и тарифам из предоставленных смет сентября 2026. Доставка = 10% от материалов, НДС = 5%, вознаграждение риелтора = 5% только от стоимости работ.' + objectNote
        : 'Быстрый расчёт использует геометрию, откалиброванную по предоставленным сметам. Для договорной стоимости используйте режим «Точная по замерам» и фактические объёмы. Вознаграждение риелтора = 5% только от стоимости работ.' + objectNote
  };
}

function calculateFixedPackageEstimate(input: EstimateRequest): EstimateResult {
  const pkg = PACKAGE_PRICES[input.package];
  const basePricePerM2 = pkg.minPerM2;
  const packageTotal = input.areaM2 * basePricePerM2;
  const lines: EstimateLine[] = [{
    code: 'package_fixed',
    title: pkg.title + ': базовая стоимость по пакету',
    amount: roundRub(packageTotal),
    group: 'materials'
  }];

  const extras = EXTRA_RATES_BY_PACKAGE.comfort;
  const geometry = estimateGeometry({ ...input, package: 'comfort' });
  let knownExtraWorks = 0;
  let knownExtraMaterials = 0;

  if (input.needsFullElectrical) {
    knownExtraWorks =
      geometry.electricalAreaM2 * extras.electricalPerM2 +
      geometry.lights * extras.lightInstall +
      geometry.sockets * extras.socketInstall;

    knownExtraMaterials =
      geometry.lights * extras.lightMaterial +
      geometry.sockets * extras.socketMaterial;

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
  const agentRewardBase = roundRub(knownExtraWorks);
  const agentReward = roundRub(agentRewardBase * AGENT_REWARD_RATE);

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
    agentReward,
    agentRewardBase,
    clientTotal,
    pricePerM2Final: roundRub(clientTotal / input.areaM2),
    assumptions: {
      electricalAreaM2: round1(geometry.electricalAreaM2),
      lights: geometry.lights,
      sockets: geometry.sockets
    },
    disclaimer:
      'Для Премиум используется пакетная цена «от ' +
      basePricePerM2.toLocaleString('ru-RU') +
      ' ₽/м²». В предоставленных сметах нет постатейной разбивки Премиум на работы и материалы, поэтому 5% риелтора рассчитываются только от отдельно посчитанных дополнительных работ (если они выбраны), а не от базовой пакетной суммы.'
  };
}

export function calculateEstimate(input: EstimateRequest): EstimateResult {
  if (input.package === 'minimal' || input.package === 'standard' || input.package === 'comfort') {
    return calculateSmetaEstimate(input);
  }
  return calculateFixedPackageEstimate(input);
}
