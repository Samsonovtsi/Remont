import { Pool } from 'pg';
import { z } from 'zod';

export const feedbackSchema = z.object({
  status: z.enum(['ok', 'error']),
  issueType: z.string().max(120).optional().default(''),
  expectedTotal: z.number().nonnegative().optional(),
  comment: z.string().max(2000).optional().default(''),
  input: z.record(z.any()),
  estimate: z.record(z.any())
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;

export const feedbackResolutionSchema = z.object({
  resolutionStatus: z.enum(['new', 'in_progress', 'fixed']),
  note: z.string().max(2000).optional().default('')
});

let pool: Pool | null = null;
let initialized = false;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  const hasPgParts = process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER;

  if (!connectionString && !hasPgParts) {
    throw new Error('Не настроена база данных. Добавьте DATABASE_URL или PGHOST/PGDATABASE/PGUSER/PGPASSWORD.');
  }

  const sslEnabled = process.env.DATABASE_SSL === 'true';

  pool = new Pool({
    connectionString,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.PGPOOL_MAX ?? 5),
    idleTimeoutMillis: 30_000
  });

  return pool;
}

export async function initFeedbackStore() {
  if (initialized) return;
  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS estimate_feedback (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status VARCHAR(16) NOT NULL CHECK (status IN ('ok', 'error')),
      resolution_status VARCHAR(16) NOT NULL DEFAULT 'new' CHECK (resolution_status IN ('new','in_progress','fixed')),
      resolution_note TEXT NOT NULL DEFAULT '',
      issue_type VARCHAR(120) NOT NULL DEFAULT '',
      package_code VARCHAR(32) NOT NULL DEFAULT '',
      area_m2 NUMERIC(10,2) NOT NULL DEFAULT 0,
      estimate_total NUMERIC(14,2) NOT NULL DEFAULT 0,
      price_per_m2 NUMERIC(14,2) NOT NULL DEFAULT 0,
      expected_total NUMERIC(14,2),
      deviation_percent NUMERIC(10,4),
      works_total NUMERIC(14,2) NOT NULL DEFAULT 0,
      materials_total NUMERIC(14,2) NOT NULL DEFAULT 0,
      delivery_total NUMERIC(14,2) NOT NULL DEFAULT 0,
      vat_total NUMERIC(14,2) NOT NULL DEFAULT 0,
      agent_reward NUMERIC(14,2) NOT NULL DEFAULT 0,
      calculation_mode VARCHAR(32) NOT NULL DEFAULT '',
      property_type VARCHAR(32) NOT NULL DEFAULT '',
      object_condition VARCHAR(32) NOT NULL DEFAULT '',
      rooms INTEGER NOT NULL DEFAULT 0,
      bathrooms INTEGER NOT NULL DEFAULT 0,
      doors INTEGER NOT NULL DEFAULT 0,
      doorways INTEGER NOT NULL DEFAULT 0,
      needs_full_electrical BOOLEAN NOT NULL DEFAULT FALSE,
      needs_full_plumbing BOOLEAN NOT NULL DEFAULT FALSE,
      needs_demolition BOOLEAN NOT NULL DEFAULT FALSE,
      needs_ceiling BOOLEAN NOT NULL DEFAULT FALSE,
      has_balcony BOOLEAN NOT NULL DEFAULT FALSE,
      warm_floor_m2 NUMERIC(10,2) NOT NULL DEFAULT 0,
      comment TEXT NOT NULL DEFAULT '',
      input_json JSONB NOT NULL,
      estimate_json JSONB NOT NULL
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS estimate_feedback_created_at_idx
    ON estimate_feedback (created_at DESC)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS estimate_feedback_resolution_idx
    ON estimate_feedback (resolution_status, created_at DESC)
  `);

  initialized = true;
}

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function appendFeedback(feedback: FeedbackInput) {
  await initFeedbackStore();
  const db = getPool();
  const input = feedback.input;
  const estimate = feedback.estimate;
  const expected = feedback.expectedTotal ?? null;
  const estimateTotal = num(estimate.clientTotal);
  const deviationPercent =
    expected && expected > 0 ? ((estimateTotal - expected) / expected) * 100 : null;

  const result = await db.query(
    `
      INSERT INTO estimate_feedback (
        status, issue_type, package_code, area_m2, estimate_total, price_per_m2,
        expected_total, deviation_percent, works_total, materials_total,
        delivery_total, vat_total, agent_reward, calculation_mode, property_type,
        object_condition, rooms, bathrooms, doors, doorways,
        needs_full_electrical, needs_full_plumbing, needs_demolition,
        needs_ceiling, has_balcony, warm_floor_m2, comment, input_json, estimate_json
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28::jsonb,$29::jsonb
      )
      RETURNING id, created_at
    `,
    [
      feedback.status,
      feedback.issueType,
      String(input.package ?? ''),
      num(input.areaM2),
      estimateTotal,
      num(estimate.pricePerM2Final),
      expected,
      deviationPercent,
      num(estimate.worksTotal),
      num(estimate.materialsTotal),
      num(estimate.deliveryTotal),
      num(estimate.vat),
      num(estimate.agentReward),
      String(input.calculationMode ?? ''),
      String(input.propertyType ?? ''),
      String(input.condition ?? ''),
      Math.round(num(input.rooms)),
      Math.round(num(input.bathrooms)),
      Math.round(num(input.doors)),
      Math.round(num(input.doorways)),
      Boolean(input.needsFullElectrical),
      Boolean(input.needsFullPlumbing),
      Boolean(input.needsDemolition),
      Boolean(input.needsCeiling),
      Boolean(input.hasBalcony),
      num(input.warmFloorM2),
      feedback.comment,
      JSON.stringify(input),
      JSON.stringify(estimate)
    ]
  );

  return result.rows[0];
}

export async function listFeedback(options: {
  resolutionStatus?: 'new' | 'in_progress' | 'fixed';
  limit?: number;
  offset?: number;
}) {
  await initFeedbackStore();
  const db = getPool();
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const offset = Math.max(options.offset ?? 0, 0);

  const params: unknown[] = [];
  let where = '';

  if (options.resolutionStatus) {
    params.push(options.resolutionStatus);
    where = `WHERE resolution_status = $${params.length}`;
  }

  params.push(limit);
  const limitIndex = params.length;
  params.push(offset);
  const offsetIndex = params.length;

  const result = await db.query(
    `
      SELECT
        id, created_at, updated_at, status, resolution_status, resolution_note,
        issue_type, package_code, area_m2, estimate_total, price_per_m2,
        expected_total, deviation_percent, works_total, materials_total,
        delivery_total, vat_total, agent_reward, calculation_mode,
        property_type, object_condition, rooms, bathrooms, doors, doorways,
        needs_full_electrical, needs_full_plumbing, needs_demolition,
        needs_ceiling, has_balcony, warm_floor_m2, comment
      FROM estimate_feedback
      ${where}
      ORDER BY created_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `,
    params
  );

  return result.rows;
}

export async function updateFeedbackResolution(
  id: number,
  resolutionStatus: 'new' | 'in_progress' | 'fixed',
  note: string
) {
  await initFeedbackStore();
  const db = getPool();

  const result = await db.query(
    `
      UPDATE estimate_feedback
      SET resolution_status = $2,
          resolution_note = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, resolution_status, resolution_note, updated_at
    `,
    [id, resolutionStatus, note]
  );

  return result.rows[0] ?? null;
}
