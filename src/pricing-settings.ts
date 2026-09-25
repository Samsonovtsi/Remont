import { Pool } from 'pg';
import { z } from 'zod';
import {
  EXTRA_RATES_BY_PACKAGE,
  PACKAGE_PRICES,
  SMETA_RATES,
  setPricingConstant
} from './pricing.js';

export const manualPricingValueSchema = z.object({
  group: z.enum(['package', 'constant', 'smeta', 'extra']),
  packageCode: z.enum(['minimal', 'standard', 'comfort', 'premium']).optional(),
  key: z.string().min(1).max(120),
  value: z.number().nonnegative().max(5_000_000)
});

let pool: Pool | null = null;
let initialized = false;
let lastLoad = 0;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  const hasPgParts = process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER;
  if (!connectionString && !hasPgParts) {
    throw new Error('Не настроена база данных для параметров расчёта.');
  }

  pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.PGPOOL_MAX ?? 5),
    idleTimeoutMillis: 30_000
  });

  return pool;
}

async function initStore() {
  if (initialized) return;
  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS manual_pricing_values (
      id BIGSERIAL PRIMARY KEY,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      target_group VARCHAR(32) NOT NULL CHECK (target_group IN ('package','constant','smeta','extra')),
      package_code VARCHAR(32),
      target_key VARCHAR(120) NOT NULL,
      value NUMERIC(14,4) NOT NULL,
      UNIQUE(target_group, package_code, target_key)
    )
  `);

  initialized = true;
}

function validateTarget(group: string, key: string, packageCode?: string) {
  if (group === 'package') {
    if (!packageCode || key !== 'minPerM2') throw new Error('Некорректный параметр пакета.');
    return;
  }

  if (group === 'constant') {
    if (!['agentRewardRate', 'vatRate', 'deliveryRate'].includes(key)) {
      throw new Error('Некорректный системный коэффициент.');
    }
    return;
  }

  if (!packageCode) throw new Error('Для ставки нужно указать пакет.');

  if (group === 'smeta' && !(key in SMETA_RATES.minimal)) {
    throw new Error('Неизвестный параметр основной сметы.');
  }

  if (group === 'extra' && !(key in EXTRA_RATES_BY_PACKAGE.minimal)) {
    throw new Error('Неизвестный параметр дополнительных работ.');
  }
}

export async function setManualPricingValue(input: z.infer<typeof manualPricingValueSchema>) {
  await initStore();
  validateTarget(input.group, input.key, input.packageCode);
  const db = getPool();

  const packageCode = input.group === 'constant' ? '' : input.packageCode ?? '';

  const result = await db.query(
    `
      INSERT INTO manual_pricing_values (target_group, package_code, target_key, value)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (target_group, package_code, target_key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      RETURNING id, updated_at, target_group, package_code, target_key, value
    `,
    [input.group, packageCode, input.key, input.value]
  );

  await applyManualPricingValues(true);
  return result.rows[0];
}

export async function listManualPricingValues() {
  await initStore();
  const db = getPool();
  const result = await db.query(`
    SELECT id, updated_at, target_group, package_code, target_key, value
    FROM manual_pricing_values
    ORDER BY target_group, package_code NULLS FIRST, target_key
  `);
  return result.rows;
}

export async function applyManualPricingValues(force = false) {
  const now = Date.now();
  if (!force && now - lastLoad < 30_000) return;

  const rows = await listManualPricingValues();

  for (const row of rows) {
    const group = String(row.target_group);
    const packageCode = row.package_code ? String(row.package_code) as keyof typeof PACKAGE_PRICES : undefined;
    const key = String(row.target_key);
    const value = Number(row.value);
    if (!Number.isFinite(value)) continue;

    if (group === 'package' && packageCode && key === 'minPerM2') {
      PACKAGE_PRICES[packageCode].minPerM2 = value;
    } else if (group === 'constant') {
      setPricingConstant(key as 'agentRewardRate' | 'vatRate' | 'deliveryRate', value);
    } else if (group === 'smeta' && packageCode && key in SMETA_RATES[packageCode]) {
      (SMETA_RATES[packageCode] as unknown as Record<string, number>)[key] = value;
    } else if (group === 'extra' && packageCode && key in EXTRA_RATES_BY_PACKAGE[packageCode]) {
      (EXTRA_RATES_BY_PACKAGE[packageCode] as unknown as Record<string, number>)[key] = value;
    }
  }

  lastLoad = now;
}
