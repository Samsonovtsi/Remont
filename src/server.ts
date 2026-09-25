import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { ZodError } from 'zod';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateEstimate } from './calculator.js';
import { PACKAGE_PRICES, AGENT_REWARD_RATE } from './pricing.js';
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

const app = Fastify({ logger: true });

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
