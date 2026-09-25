import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { ZodError } from 'zod';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateEstimate } from './calculator.js';
import {
  PACKAGE_PRICES,
  AGENT_REWARD_RATE,
  VAT_RATE,
  DELIVERY_RATE,
  SMETA_RATES,
  EXTRA_RATES_BY_PACKAGE,
  OFFICIAL_APARTMENT_PRICE_BANDS_2026,
  COMMERCIAL_TILE_RATES
} from './pricing.js';
import { estimateRequestSchema } from './schema.js';
import {
  appendFeedback,
  feedbackResolutionSchema,
  feedbackSchema,
  listFeedback,
  updateFeedbackResolution
} from './feedback.js';
import {
  analyticsEventSchema,
  getAnalyticsSummary,
  trackAnalyticsEvent
} from './analytics.js';
import {
  deleteSmetaDocument,
  getSmetaDocument,
  listSmetaDocuments,
  saveSmetaDocument,
  smetaUploadSchema
} from './smeta-store.js';

const app = Fastify({ logger: true, bodyLimit: 22 * 1024 * 1024 });

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? '*'
});

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(__dirname, '..', 'public');

await app.register(fastifyStatic, {
  root: publicDir,
  prefix: '/'
});


function requireFeedbackAdmin(request: { headers: Record<string, unknown> }) {
  const expected = process.env.FEEDBACK_ADMIN_TOKEN;
  if (!expected) {
    return { ok: false as const, code: 503, error: 'ADMIN_TOKEN_NOT_CONFIGURED' };
  }

  const auth = String(request.headers.authorization ?? '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (token !== expected) {
    return { ok: false as const, code: 401, error: 'UNAUTHORIZED' };
  }

  return { ok: true as const };
}

app.get('/health', async () => ({ ok: true }));

app.get('/api/v1/packages', async () => ({
  currency: 'RUB',
  agentRewardRate: AGENT_REWARD_RATE,
  packages: PACKAGE_PRICES
}));


app.get('/api/v1/admin/calculation-source', async (request, reply) => {
  const auth = requireFeedbackAdmin(request as any);
  if (!auth.ok) return reply.code(auth.code).send({ error: auth.error });

  return {
    updatedAt: '2026-09-25',
    packagePrices: PACKAGE_PRICES,
    officialApartmentPriceBands2026: OFFICIAL_APARTMENT_PRICE_BANDS_2026,
    smetaRates: SMETA_RATES,
    extraRatesByPackage: EXTRA_RATES_BY_PACKAGE,
    commercialTileRates: COMMERCIAL_TILE_RATES,
    constants: {
      agentRewardRate: AGENT_REWARD_RATE,
      vatRate: VAT_RATE,
      deliveryRate: DELIVERY_RATE
    },
    calculationNotes: [
      'Быстрый режим оценивает геометрию автоматически по площади, числу жилых комнат и санузлов.',
      'Количество жилых комнат в интерфейсе указывается без кухни; кухня уже входит в общую площадь объекта.',
      'Точный режим использует фактически введённые площади и количества.',
      'Для квартир действует минимальная стоимость выбранного пакета за м².',
      'Вознаграждение риелтора считается как 5% только от стоимости работ.'
    ]
  };
});

app.get('/api/v1/admin/smetas', async (request, reply) => {
  const auth = requireFeedbackAdmin(request as any);
  if (!auth.ok) return reply.code(auth.code).send({ error: auth.error });

  try {
    return { rows: await listSmetaDocuments() };
  } catch (error) {
    request.log.error(error);
    return reply.code(503).send({
      error: 'SMETA_STORE_NOT_AVAILABLE',
      message: error instanceof Error ? error.message : 'Хранилище смет недоступно'
    });
  }
});

app.post('/api/v1/admin/smetas', async (request, reply) => {
  const auth = requireFeedbackAdmin(request as any);
  if (!auth.ok) return reply.code(auth.code).send({ error: auth.error });

  try {
    const input = smetaUploadSchema.parse(request.body);
    const row = await saveSmetaDocument(input);
    return reply.code(201).send({ row });
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        details: error.flatten()
      });
    }

    request.log.error(error);
    return reply.code(503).send({
      error: 'SMETA_UPLOAD_FAILED',
      message: error instanceof Error ? error.message : 'Не удалось сохранить смету'
    });
  }
});

app.get('/api/v1/admin/smetas/:id/download', async (request, reply) => {
  const auth = requireFeedbackAdmin(request as any);
  if (!auth.ok) return reply.code(auth.code).send({ error: auth.error });

  try {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) return reply.code(400).send({ error: 'INVALID_ID' });

    const row = await getSmetaDocument(id);
    if (!row) return reply.code(404).send({ error: 'NOT_FOUND' });

    const encodedName = encodeURIComponent(String(row.original_name));
    reply.header('Content-Type', String(row.mime_type || 'application/octet-stream'));
    reply.header('Content-Length', String(row.file_size));
    reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
    return reply.send(row.content);
  } catch (error) {
    request.log.error(error);
    return reply.code(503).send({ error: 'SMETA_DOWNLOAD_FAILED' });
  }
});

app.delete('/api/v1/admin/smetas/:id', async (request, reply) => {
  const auth = requireFeedbackAdmin(request as any);
  if (!auth.ok) return reply.code(auth.code).send({ error: auth.error });

  try {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) return reply.code(400).send({ error: 'INVALID_ID' });
    const deleted = await deleteSmetaDocument(id);
    if (!deleted) return reply.code(404).send({ error: 'NOT_FOUND' });
    return { ok: true };
  } catch (error) {
    request.log.error(error);
    return reply.code(503).send({ error: 'SMETA_DELETE_FAILED' });
  }
});

app.post('/api/v1/estimate', async (request, reply) => {
  try {
    const input = estimateRequestSchema.parse(request.body);
    return calculateEstimate(input);
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        details: error.flatten()
      });
    }

    request.log.error(error);
    return reply.code(500).send({ error: 'INTERNAL_ERROR' });
  }
});


app.post('/api/v1/feedback', async (request, reply) => {
  try {
    const feedback = feedbackSchema.parse(request.body);
    await appendFeedback(feedback);
    return { ok: true };
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        details: error.flatten()
      });
    }

    request.log.error(error);
    return reply.code(503).send({
      error: 'FEEDBACK_NOT_AVAILABLE',
      message: error instanceof Error ? error.message : 'Не удалось сохранить обратную связь'
    });
  }
});



app.post('/api/v1/analytics', async (request, reply) => {
  try {
    const event = analyticsEventSchema.parse(request.body);
    await trackAnalyticsEvent(event);
    return reply.code(204).send();
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        details: error.flatten()
      });
    }

    request.log.error(error);
    return reply.code(503).send({ error: 'ANALYTICS_NOT_AVAILABLE' });
  }
});

app.get('/api/v1/analytics/summary', async (request, reply) => {
  const auth = requireFeedbackAdmin(request as any);
  if (!auth.ok) return reply.code(auth.code).send({ error: auth.error });

  try {
    const query = request.query as { days?: string };
    const summary = await getAnalyticsSummary(Number(query.days ?? 30));
    return summary;
  } catch (error) {
    request.log.error(error);
    return reply.code(503).send({
      error: 'ANALYTICS_NOT_AVAILABLE',
      message: error instanceof Error ? error.message : 'Аналитика недоступна'
    });
  }
});

app.get('/api/v1/feedback', async (request, reply) => {
  const auth = requireFeedbackAdmin(request as any);
  if (!auth.ok) return reply.code(auth.code).send({ error: auth.error });

  try {
    const query = request.query as { status?: string; limit?: string; offset?: string };
    const status =
      query.status === 'new' || query.status === 'in_progress' || query.status === 'fixed'
        ? query.status
        : undefined;

    const rows = await listFeedback({
      resolutionStatus: status,
      limit: Number(query.limit ?? 100),
      offset: Number(query.offset ?? 0)
    });

    return { rows };
  } catch (error) {
    request.log.error(error);
    return reply.code(503).send({
      error: 'FEEDBACK_STORE_NOT_AVAILABLE',
      message: error instanceof Error ? error.message : 'Журнал обратной связи недоступен'
    });
  }
});

app.patch('/api/v1/feedback/:id', async (request, reply) => {
  const auth = requireFeedbackAdmin(request as any);
  if (!auth.ok) return reply.code(auth.code).send({ error: auth.error });

  try {
    const params = request.params as { id: string };
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ error: 'INVALID_ID' });
    }

    const body = feedbackResolutionSchema.parse(request.body);
    const row = await updateFeedbackResolution(id, body.resolutionStatus, body.note);

    if (!row) return reply.code(404).send({ error: 'NOT_FOUND' });
    return { row };
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        details: error.flatten()
      });
    }

    request.log.error(error);
    return reply.code(503).send({
      error: 'FEEDBACK_STORE_NOT_AVAILABLE',
      message: error instanceof Error ? error.message : 'Журнал обратной связи недоступен'
    });
  }
});

app.get('/feedback', async (_request, reply) => {
  return reply.sendFile('feedback.html');
});

app.get('/', async (_request, reply) => {
  return reply.sendFile('index.html');
});

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? '0.0.0.0';

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
