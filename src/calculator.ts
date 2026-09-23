import {
  AGENT_REWARD_RATE,
  CONDITION_FACTOR,
  PACKAGE_PRICES,
  PROPERTY_FACTOR
} from './pricing.js';
import type { EstimateRequest } from './schema.js';

export interface EstimateLine {
  code: string;
  title: string;
  amount: number;
}

export interface EstimateResult {
  currency: 'RUB';
  areaM2: number;
  package: string;
  basePricePerM2: number;
  lines: EstimateLine[];
  estimateBeforeReward: number;
  agentRewardRate: number;
  agentReward: number;
  clientTotal: number;
  pricePerM2Final: number;
  disclaimer: string;
}

const roundRub = (value: number) => Math.round(value);

export function calculateEstimate(input: EstimateRequest): EstimateResult {
  const pkg = PACKAGE_PRICES[input.package];
  const basePricePerM2 =
    pkg.minPerM2 + (pkg.maxPerM2 - pkg.minPerM2) * input.finishLevel;

  const base = input.areaM2 * basePricePerM2;
  const lines: EstimateLine[] = [
    { code: 'base', title: `${pkg.title}: базовая стоимость`, amount: roundRub(base) }
  ];

  const conditionDelta = base * (CONDITION_FACTOR[input.condition] - 1);
  if (Math.abs(conditionDelta) >= 1) {
    lines.push({
      code: 'condition',
      title: 'Поправка на состояние объекта',
      amount: roundRub(conditionDelta)
    });
  }

  const propertyDelta = base * (PROPERTY_FACTOR[input.propertyType] - 1);
  if (Math.abs(propertyDelta) >= 1) {
    lines.push({
      code: 'property_type',
      title: 'Поправка на тип объекта',
      amount: roundRub(propertyDelta)
    });
  }

  // Упрощённые коэффициенты/допы для предварительного расчёта.
  // Их удобно заменить на тарифы из вашей CRM/прайс-листа.
  if (input.needsFullElectrical) {
    lines.push({
      code: 'electrical',
      title: 'Полная электрика',
      amount: roundRub(input.areaM2 * 1_961)
    });
  }

  if (input.needsFullPlumbing) {
    lines.push({
      code: 'plumbing',
      title: 'Полная сантехника',
      amount: roundRub(40_700 + Math.max(0, input.bathrooms - 1) * 20_000)
    });
  }

  if (input.needsDemolition) {
    lines.push({
      code: 'demolition',
      title: 'Демонтаж и подготовка',
      amount: roundRub(input.areaM2 * 1_200)
    });
  }

  if (input.needsCeiling) {
    lines.push({
      code: 'ceiling',
      title: 'Натяжной потолок',
      amount: roundRub(input.areaM2 * 2_560)
    });
  }

  if (input.hasBalcony) {
    lines.push({
      code: 'balcony',
      title: 'Дополнительные работы по балкону/лоджии',
      amount: 25_000
    });
  }

  if (input.warmFloorM2 > 0) {
    lines.push({
      code: 'warm_floor',
      title: 'Тёплый пол',
      amount: roundRub(input.warmFloorM2 * 4_255)
    });
  }

  if (input.doors > 0) {
    lines.push({
      code: 'doors',
      title: 'Монтаж межкомнатных дверей',
      amount: roundRub(input.doors * 10_000)
    });
  }

  const estimateBeforeReward = roundRub(
    lines.reduce((sum, line) => sum + line.amount, 0)
  );
  const agentReward = roundRub(estimateBeforeReward * AGENT_REWARD_RATE);
  const clientTotal = estimateBeforeReward;

  return {
    currency: 'RUB',
    areaM2: input.areaM2,
    package: input.package,
    basePricePerM2: roundRub(basePricePerM2),
    lines,
    estimateBeforeReward,
    agentRewardRate: AGENT_REWARD_RATE,
    agentReward,
    clientTotal,
    pricePerM2Final: roundRub(clientTotal / input.areaM2),
    disclaimer:
      'Предварительный расчёт. Финальная стоимость определяется после осмотра/дефектовки и детальной сметы.'
  };
}
