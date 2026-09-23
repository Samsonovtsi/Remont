import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { ZodError } from 'zod';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateEstimate } from './calculator.js';
import { PACKAGE_PRICES, AGENT_REWARD_RATE } from './pricing.js';
import { estimateRequestSchema } from './schema.js';

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

app.get('/', async (_request, reply) => {
  return reply.sendFile('index.html');
});

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? '0.0.0.0';

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
