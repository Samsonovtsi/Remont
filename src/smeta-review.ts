import { Pool } from 'pg';
import { z } from 'zod';
import { EXTRA_RATES_BY_PACKAGE, SMETA_RATES } from './pricing.js';
import type { ExtractedRateCandidate, PackageCode, RateGroup } from './smeta-analyzer.js';
import { initSmetaStore } from './smeta-store.js';

export const rateApprovalSchema = z.object({
  group: z.enum(['smeta', 'extra']),
  key: z.string().min(1).max(120),
  packageCode: z.enum(['minimal', 'standard', 'comfort', 'premium']),
  value: z.number().positive().max(5_000_000)
});

let pool: Pool | null = null;
let initialized = false;
let lastOverridesLoad = 0;

const SMETA_KEYS = new Set(Object.keys(SMETA_RATES.minimal));
const EXTRA_KEYS = new Set(Object.keys(EXTRA_RATES_BY_PACKAGE.minimal));

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  const hasPgParts = process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER;

  if (!connectionString && !hasPgParts) {
    throw new Error('Не настроена база данных для проверки ставок.');
  }

  pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.PGPOOL_MAX ?? 5),
    idleTimeoutMillis: 30_000
  });

  return pool;
}

async function initReviewStore() {
  if (initialized) return;
  await initSmetaStore();
  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS smeta_rate_candidates (
      id BIGSERIAL PRIMARY KEY,
      document_id BIGINT NOT NULL REFERENCES smeta_documents(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source_ref VARCHAR(240) NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      unit VARCHAR(40) NOT NULL DEFAULT '',
      quantity NUMERIC(14,4),
      unit_price NUMERIC(14,4) NOT NULL,
      total NUMERIC(14,4),
      package_code VARCHAR(32),
      suggested_group VARCHAR(32),
      suggested_key VARCHAR(120),
      confidence NUMERIC(8,4) NOT NULL DEFAULT 0,
      review_status VARCHAR(24) NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected')),
      approved_group VARCHAR(32),
      approved_key VARCHAR(120),
      approved_package_code VARCHAR(32),
      approved_value NUMERIC(14,4),
      reviewed_at TIMESTAMPTZ
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS smeta_rate_candidates_document_idx
    ON smeta_rate_candidates (document_id, review_status, id)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS pricing_rate_overrides (
      id BIGSERIAL PRIMARY KEY,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      target_group VARCHAR(32) NOT NULL CHECK (target_group IN ('smeta','extra')),
      target_key VARCHAR(120) NOT NULL,
      package_code VARCHAR(32) NOT NULL CHECK (package_code IN ('minimal','standard','comfort','premium')),
      value NUMERIC(14,4) NOT NULL,
      source_candidate_id BIGINT REFERENCES smeta_rate_candidates(id) ON DELETE SET NULL,
      source_document_id BIGINT REFERENCES smeta_documents(id) ON DELETE SET NULL,
      UNIQUE(target_group, target_key, package_code)
    )
  `);

  initialized = true;
}

function validateTarget(group: RateGroup, key: string) {
  if (group === 'smeta' && !SMETA_KEYS.has(key)) {
    throw new Error('Неизвестный параметр основной сметы.');
  }
  if (group === 'extra' && !EXTRA_KEYS.has(key)) {
    throw new Error('Неизвестный параметр дополнительных работ.');
  }
}

export async function replaceRateCandidates(documentId: number, candidates: ExtractedRateCandidate[]) {
  await initReviewStore();
  const db = getPool();
  const client = await db.connect();

  await client.query('BEGIN');
  try {
    await client.query('DELETE FROM smeta_rate_candidates WHERE document_id = $1 AND review_status = $2', [documentId, 'pending']);

    for (const candidate of candidates) {
      await client.query(
        `
          INSERT INTO smeta_rate_candidates (
            document_id, source_ref, description, unit, quantity, unit_price, total,
            package_code, suggested_group, suggested_key, confidence
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        `,
        [
          documentId,
          candidate.sourceRef,
          candidate.description,
          candidate.unit,
          candidate.quantity,
          candidate.unitPrice,
          candidate.total,
          candidate.packageCode,
          candidate.suggestedGroup,
          candidate.suggestedKey,
          candidate.confidence
        ]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listRateCandidates(documentId?: number) {
  await initReviewStore();
  const db = getPool();

  const params: unknown[] = [];
  let where = '';
  if (documentId) {
    params.push(documentId);
    where = 'WHERE c.document_id = $1';
  }

  const result = await db.query(
    `
      SELECT
        c.id, c.document_id, c.created_at, c.source_ref, c.description, c.unit,
        c.quantity, c.unit_price, c.total, c.package_code, c.suggested_group,
        c.suggested_key, c.confidence, c.review_status, c.approved_group,
        c.approved_key, c.approved_package_code, c.approved_value, c.reviewed_at,
        d.original_name
      FROM smeta_rate_candidates c
      JOIN smeta_documents d ON d.id = c.document_id
      ${where}
      ORDER BY
        CASE c.review_status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
        c.confidence DESC,
        c.id DESC
      LIMIT 1000
    `,
    params
  );

  return result.rows;
}

export async function approveRateCandidate(
  id: number,
  input: z.infer<typeof rateApprovalSchema>
) {
  await initReviewStore();
  validateTarget(input.group, input.key);
  const db = getPool();
  const client = await db.connect();
  let documentId: number | null = null;

  try {
    await client.query('BEGIN');

    const source = await client.query(
      'SELECT id, document_id FROM smeta_rate_candidates WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (!source.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    documentId = Number(source.rows[0].document_id);

    await client.query(
      `
        UPDATE smeta_rate_candidates
        SET review_status = 'approved',
            approved_group = $2,
            approved_key = $3,
            approved_package_code = $4,
            approved_value = $5,
            reviewed_at = NOW()
        WHERE id = $1
      `,
      [id, input.group, input.key, input.packageCode, input.value]
    );

    await client.query(
      `
        INSERT INTO pricing_rate_overrides (
          target_group, target_key, package_code, value, source_candidate_id, source_document_id
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (target_group, target_key, package_code)
        DO UPDATE SET
          value = EXCLUDED.value,
          source_candidate_id = EXCLUDED.source_candidate_id,
          source_document_id = EXCLUDED.source_document_id,
          updated_at = NOW()
      `,
      [input.group, input.key, input.packageCode, input.value, id, documentId]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  await refreshPricingOverrides(true);
  return { id, ...input };
}

export async function rejectRateCandidate(id: number) {
  await initReviewStore();
  const db = getPool();
  const result = await db.query(
    `
      UPDATE smeta_rate_candidates
      SET review_status = 'rejected', reviewed_at = NOW()
      WHERE id = $1
      RETURNING id
    `,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function listPricingOverrides() {
  await initReviewStore();
  const db = getPool();
  const result = await db.query(`
    SELECT
      o.id, o.updated_at, o.target_group, o.target_key, o.package_code, o.value,
      o.source_candidate_id, o.source_document_id, d.original_name
    FROM pricing_rate_overrides o
    LEFT JOIN smeta_documents d ON d.id = o.source_document_id
    ORDER BY o.target_group, o.package_code, o.target_key
  `);
  return result.rows;
}

export async function refreshPricingOverrides(force = false) {
  const now = Date.now();
  if (!force && now - lastOverridesLoad < 30_000) return;

  await initReviewStore();
  const rows = await listPricingOverrides();

  for (const row of rows) {
    const group = String(row.target_group) as RateGroup;
    const packageCode = String(row.package_code) as PackageCode;
    const key = String(row.target_key);
    const value = Number(row.value);

    if (!Number.isFinite(value)) continue;

    if (group === 'smeta' && SMETA_KEYS.has(key)) {
      (SMETA_RATES[packageCode] as unknown as Record<string, number>)[key] = value;
    } else if (group === 'extra' && EXTRA_KEYS.has(key)) {
      (EXTRA_RATES_BY_PACKAGE[packageCode] as unknown as Record<string, number>)[key] = value;
    }
  }

  lastOverridesLoad = now;
}
