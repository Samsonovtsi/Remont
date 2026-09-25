import { Pool } from 'pg';
import { z } from 'zod';

export const analyticsEventSchema = z.object({
  eventType: z.enum([
    'page_view',
    'package_click',
    'option_change',
    'calculate',
    'offer_generate',
    'feedback_open',
    'feedback_submit',
    'contact_click'
  ]),
  eventName: z.string().max(120).optional().default(''),
  sessionId: z.string().max(120).optional().default(''),
  path: z.string().max(300).optional().default('/'),
  referrer: z.string().max(500).optional().default(''),
  meta: z.record(z.any()).optional().default({})
});

type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;

let pool: Pool | null = null;
let initialized = false;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  const hasPgParts = process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER;

  if (!connectionString && !hasPgParts) {
    throw new Error('Не настроена база данных. Добавьте DATABASE_URL или PGHOST/PGDATABASE/PGUSER/PGPASSWORD.');
  }

  pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.PGPOOL_MAX ?? 5),
    idleTimeoutMillis: 30_000
  });

  return pool;
}

export async function initAnalyticsStore() {
  if (initialized) return;
  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      event_type VARCHAR(40) NOT NULL,
      event_name VARCHAR(120) NOT NULL DEFAULT '',
      session_id VARCHAR(120) NOT NULL DEFAULT '',
      path VARCHAR(300) NOT NULL DEFAULT '/',
      referrer VARCHAR(500) NOT NULL DEFAULT '',
      meta JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx
    ON analytics_events (created_at DESC)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS analytics_events_type_idx
    ON analytics_events (event_type, created_at DESC)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS analytics_events_session_idx
    ON analytics_events (session_id, created_at DESC)
  `);

  initialized = true;
}

export async function trackAnalyticsEvent(event: AnalyticsEvent) {
  await initAnalyticsStore();
  const db = getPool();

  await db.query(
    `
      INSERT INTO analytics_events (
        event_type, event_name, session_id, path, referrer, meta
      )
      VALUES ($1,$2,$3,$4,$5,$6::jsonb)
    `,
    [
      event.eventType,
      event.eventName,
      event.sessionId,
      event.path,
      event.referrer,
      JSON.stringify(event.meta ?? {})
    ]
  );
}

export async function getAnalyticsSummary(days = 30) {
  await initAnalyticsStore();
  const db = getPool();
  const safeDays = Math.min(Math.max(Number(days) || 30, 1), 365);

  const [
    totals,
    eventBreakdown,
    packageClicks,
    daily,
    contacts,
    optionChanges
  ] = await Promise.all([
    db.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'page_view')::int AS page_views,
          COUNT(DISTINCT NULLIF(session_id, ''))::int AS unique_sessions,
          COUNT(*) FILTER (WHERE event_type = 'calculate')::int AS calculations,
          COUNT(*) FILTER (WHERE event_type = 'offer_generate')::int AS offers,
          COUNT(*) FILTER (WHERE event_type = 'feedback_submit')::int AS feedback_submits,
          COUNT(*) FILTER (WHERE event_type = 'contact_click')::int AS contact_clicks
        FROM analytics_events
        WHERE created_at >= NOW() - ($1::text || ' days')::interval
      `,
      [safeDays]
    ),
    db.query(
      `
        SELECT event_type, COUNT(*)::int AS count
        FROM analytics_events
        WHERE created_at >= NOW() - ($1::text || ' days')::interval
        GROUP BY event_type
        ORDER BY count DESC
      `,
      [safeDays]
    ),
    db.query(
      `
        SELECT event_name AS package, COUNT(*)::int AS count
        FROM analytics_events
        WHERE event_type = 'package_click'
          AND created_at >= NOW() - ($1::text || ' days')::interval
        GROUP BY event_name
        ORDER BY count DESC
      `,
      [safeDays]
    ),
    db.query(
      `
        SELECT
          TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS day,
          COUNT(*) FILTER (WHERE event_type = 'page_view')::int AS page_views,
          COUNT(*) FILTER (WHERE event_type = 'calculate')::int AS calculations,
          COUNT(DISTINCT NULLIF(session_id, ''))::int AS sessions
        FROM analytics_events
        WHERE created_at >= NOW() - ($1::text || ' days')::interval
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `,
      [safeDays]
    ),
    db.query(
      `
        SELECT event_name AS channel, COUNT(*)::int AS count
        FROM analytics_events
        WHERE event_type = 'contact_click'
          AND created_at >= NOW() - ($1::text || ' days')::interval
        GROUP BY event_name
        ORDER BY count DESC
      `,
      [safeDays]
    ),
    db.query(
      `
        SELECT event_name AS option, COUNT(*)::int AS count
        FROM analytics_events
        WHERE event_type = 'option_change'
          AND created_at >= NOW() - ($1::text || ' days')::interval
        GROUP BY event_name
        ORDER BY count DESC
        LIMIT 10
      `,
      [safeDays]
    )
  ]);

  return {
    days: safeDays,
    totals: totals.rows[0] ?? {},
    eventBreakdown: eventBreakdown.rows,
    packageClicks: packageClicks.rows,
    daily: daily.rows,
    contacts: contacts.rows,
    optionChanges: optionChanges.rows
  };
}
