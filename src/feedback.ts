import { createSign } from 'node:crypto';
import { z } from 'zod';

const DEFAULT_SPREADSHEET_ID = '1yGPFUaXF5QPHifD4kBHfk-ratS88SQkiS0DzDH-tFEY';
const DEFAULT_SHEET_NAME = 'Лист1';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

export const feedbackSchema = z.object({
  status: z.enum(['ok', 'error']),
  issueType: z.string().max(120).optional().default(''),
  expectedTotal: z.number().nonnegative().optional(),
  comment: z.string().max(2000).optional().default(''),
  input: z.record(z.any()),
  estimate: z.record(z.any())
});

type FeedbackInput = z.infer<typeof feedbackSchema>;

interface GoogleCredentials {
  client_email: string;
  private_key: string;
}

let tokenCache: { accessToken: string; expiresAt: number } | null = null;

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function readCredentials(): GoogleCredentials {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (json) {
    const parsed = JSON.parse(json);
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON должен содержать client_email и private_key');
    }
    return {
      client_email: String(parsed.client_email),
      private_key: String(parsed.private_key).replaceAll('\\n', '\n')
    };
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Не настроена авторизация Google Sheets. Добавьте GOOGLE_SERVICE_ACCOUNT_JSON или GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY.'
    );
  }

  return {
    client_email: clientEmail,
    private_key: privateKey.replaceAll('\\n', '\n')
  };
}

async function getAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const credentials = readCredentials();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: credentials.client_email,
    scope: SHEETS_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${payload}`;

  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = base64Url(signer.sign(credentials.private_key));
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Не удалось получить Google access token: ${response.status} ${text}`);
  }

  const data = await response.json() as { access_token: string; expires_in?: number };
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000
  };
  return tokenCache.accessToken;
}

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function boolLabel(value: unknown) {
  return value ? 'Да' : 'Нет';
}

function packageLabel(code: unknown) {
  return ({
    minimal: 'Минимальный',
    standard: 'Стандарт',
    comfort: 'Комфорт',
    premium: 'Премиум'
  } as Record<string, string>)[String(code)] ?? String(code ?? '');
}

function propertyLabel(code: unknown) {
  return ({
    apartment: 'Квартира',
    house: 'Дом',
    commercial: 'Коммерция'
  } as Record<string, string>)[String(code)] ?? String(code ?? '');
}

function conditionLabel(code: unknown) {
  return ({
    new_build: 'Новостройка',
    secondary_good: 'Вторичка, хорошее состояние',
    secondary_worn: 'Вторичка, нужен ремонт',
    shell: 'Черновая отделка'
  } as Record<string, string>)[String(code)] ?? String(code ?? '');
}

function modeLabel(code: unknown) {
  return code === 'exact' ? 'Точная по замерам' : 'Быстрый';
}

function buildRow(feedback: FeedbackInput) {
  const input = feedback.input;
  const estimate = feedback.estimate;
  const expectedTotal = feedback.expectedTotal ?? 0;
  const estimateTotal = num(estimate.clientTotal);
  const deviation = expectedTotal > 0 ? (estimateTotal - expectedTotal) / expectedTotal : '';

  return [
    new Date().toISOString(),
    feedback.status === 'ok' ? 'Верно' : 'Ошибка',
    feedback.issueType,
    packageLabel(input.package),
    num(input.areaM2),
    estimateTotal,
    num(estimate.pricePerM2Final),
    expectedTotal || '',
    deviation,
    num(estimate.worksTotal),
    num(estimate.materialsTotal),
    num(estimate.deliveryTotal),
    num(estimate.vat),
    num(estimate.agentReward),
    modeLabel(input.calculationMode),
    propertyLabel(input.propertyType),
    conditionLabel(input.condition),
    num(input.rooms),
    num(input.bathrooms),
    num(input.doors),
    num(input.doorways),
    boolLabel(input.needsFullElectrical),
    boolLabel(input.needsFullPlumbing),
    boolLabel(input.needsDemolition),
    boolLabel(input.needsCeiling),
    boolLabel(input.hasBalcony),
    num(input.warmFloorM2),
    feedback.comment,
    JSON.stringify(input),
    JSON.stringify(estimate)
  ];
}

export async function appendFeedback(feedback: FeedbackInput) {
  const spreadsheetId = process.env.FEEDBACK_SPREADSHEET_ID ?? DEFAULT_SPREADSHEET_ID;
  const sheetName = process.env.FEEDBACK_SHEET_NAME ?? DEFAULT_SHEET_NAME;
  const accessToken = await getAccessToken();
  const row = buildRow(feedback);
  const range = encodeURIComponent(`'${sheetName.replaceAll("'", "''")}'!A:AD`);
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}:append` +
    '?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: [row] })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Sheets append failed: ${response.status} ${text}`);
  }

  return response.json();
}
