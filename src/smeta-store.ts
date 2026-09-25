import { Pool } from 'pg';
import { z } from 'zod';

export const smetaUploadSchema = z.object({
  fileName: z.string().min(1).max(240),
  mimeType: z.string().min(1).max(120).default('application/pdf'),
  size: z.number().int().positive().max(15 * 1024 * 1024),
  base64: z.string().min(1),
  note: z.string().max(1000).optional().default('')
});

let pool: Pool | null = null;
let initialized = false;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  const hasPgParts = process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER;

  if (!connectionString && !hasPgParts) {
    throw new Error('Не настроена база данных для хранения смет.');
  }

  pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.PGPOOL_MAX ?? 5),
    idleTimeoutMillis: 30_000
  });

  return pool;
}

async function initSmetaStore() {
  if (initialized) return;
  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS smeta_documents (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      original_name VARCHAR(240) NOT NULL,
      mime_type VARCHAR(120) NOT NULL,
      file_size INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      status VARCHAR(32) NOT NULL DEFAULT 'uploaded',
      content BYTEA NOT NULL
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS smeta_documents_created_at_idx
    ON smeta_documents (created_at DESC)
  `);

  initialized = true;
}

export async function saveSmetaDocument(input: z.infer<typeof smetaUploadSchema>) {
  await initSmetaStore();
  const db = getPool();
  const content = Buffer.from(input.base64, 'base64');

  if (content.length !== input.size) {
    throw new Error('Размер загруженного файла не совпадает с переданным размером.');
  }

  const result = await db.query(
    `
      INSERT INTO smeta_documents (original_name, mime_type, file_size, note, content)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at, original_name, mime_type, file_size, note, status
    `,
    [input.fileName, input.mimeType, input.size, input.note, content]
  );

  return result.rows[0];
}

export async function listSmetaDocuments() {
  await initSmetaStore();
  const db = getPool();

  const result = await db.query(`
    SELECT id, created_at, original_name, mime_type, file_size, note, status
    FROM smeta_documents
    ORDER BY created_at DESC
    LIMIT 500
  `);

  return result.rows;
}

export async function getSmetaDocument(id: number) {
  await initSmetaStore();
  const db = getPool();

  const result = await db.query(
    `
      SELECT id, original_name, mime_type, file_size, note, status, content
      FROM smeta_documents
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function deleteSmetaDocument(id: number) {
  await initSmetaStore();
  const db = getPool();
  const result = await db.query(
    'DELETE FROM smeta_documents WHERE id = $1 RETURNING id',
    [id]
  );
  return result.rows[0] ?? null;
}


export async function updateSmetaDocumentStatus(id: number, status: string) {
  await initSmetaStore();
  const db = getPool();
  const result = await db.query(
    'UPDATE smeta_documents SET status = $2 WHERE id = $1 RETURNING id, status',
    [id, status]
  );
  return result.rows[0] ?? null;
}
