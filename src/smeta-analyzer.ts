import pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';

export type PackageCode = 'minimal' | 'standard' | 'comfort' | 'premium';
export type RateGroup = 'smeta' | 'extra';

export interface ExtractedRateCandidate {
  sourceRef: string;
  description: string;
  unit: string;
  quantity: number | null;
  unitPrice: number;
  total: number | null;
  packageCode: PackageCode | null;
  suggestedGroup: RateGroup | null;
  suggestedKey: string | null;
  confidence: number;
}

const PACKAGE_PATTERNS: Array<[PackageCode, RegExp]> = [
  ['minimal', /минимал/i],
  ['standard', /стандарт/i],
  ['comfort', /комфорт/i],
  ['premium', /премиум|premium/i]
];

function detectPackage(text: string): PackageCode | null {
  for (const [code, pattern] of PACKAGE_PATTERNS) {
    if (pattern.test(text)) return code;
  }
  return null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, '')
    .replace(/₽|руб\.?/gi, '')
    .replace(',', '.')
    .replace(/[^0-9.\-]/g, '');
  if (!raw || raw === '-' || raw === '.') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function inferUnit(text: string): string {
  if (/м[²2]|м2/i.test(text)) return 'м²';
  if (/шт\.?/i.test(text)) return 'шт.';
  if (/компл|комплект/i.test(text)) return 'компл.';
  if (/%/.test(text)) return '%';
  return '';
}

function suggestTarget(description: string, unit: string): {
  group: RateGroup | null;
  key: string | null;
  confidence: number;
} {
  const d = description.toLowerCase();

  const exact = (group: RateGroup, key: string, confidence = 0.93) => ({ group, key, confidence });

  if (/чернов/.test(d) && /материал/.test(d)) return exact('smeta', 'roughMaterialsFactor', 0.78);
  if (/(чистов|отделоч)/.test(d) && /материал/.test(d)) return exact('smeta', 'cleanMaterialsFactor', 0.78);
  if (/чернов/.test(d) && /стен/.test(d)) return exact('smeta', 'roughWallPerM2');
  if (/(чистов|финиш)/.test(d) && /стен/.test(d)) return exact('smeta', 'cleanWallPerM2');
  if (/чернов/.test(d) && /пол/.test(d)) return exact('smeta', 'roughFloorPerM2');
  if (/(чистов|финиш)/.test(d) && /пол/.test(d)) return exact('smeta', 'cleanFloorPerM2');
  if (/плит|керамогранит/.test(d) && unit === 'м²' && !/материал|закуп|стоим.*плит/.test(d)) {
    return exact('smeta', 'tilePerM2', 0.82);
  }
  if (/сантех/.test(d) && /чернов/.test(d)) return exact('smeta', 'plumbingRough', 0.9);
  if (/сантех/.test(d) && /(чистов|финиш)/.test(d)) return exact('smeta', 'plumbingClean', 0.9);

  if (/электр/.test(d) && unit === 'м²') return exact('extra', 'electricalPerM2', 0.9);
  if (/демонтаж/.test(d) && unit === 'м²') return exact('extra', 'demolitionPerM2', 0.9);
  if (/балкон|лоджи/.test(d) && /плит/.test(d) && unit === 'м²') return exact('extra', 'balconyTileWorkPerM2', 0.84);

  if (/потол/.test(d)) {
    if (/монтаж|установ|работ/.test(d)) return exact('extra', 'ceilingInstallPerM2', 0.84);
    if (/материал|полотно|комплект/.test(d)) return exact('extra', 'ceilingMaterialPerM2', 0.84);
  }
  if (/двер/.test(d) && !/про[её]м/.test(d)) {
    if (/монтаж|установ|работ/.test(d)) return exact('extra', 'doorInstall', 0.84);
    if (/материал|полотно|комплект|дверь/.test(d)) return exact('extra', 'doorMaterial', 0.7);
  }
  if (/про[её]м/.test(d)) {
    if (/монтаж|работ|облагор/.test(d)) return exact('extra', 'doorwayInstall', 0.76);
    if (/материал|комплект|добор|наличник/.test(d)) return exact('extra', 'doorwayMaterial', 0.72);
  }
  if (/светиль|люстр/.test(d)) {
    if (/монтаж|установ|работ/.test(d)) return exact('extra', 'lightInstall', 0.82);
    if (/материал|светиль|люстр/.test(d)) return exact('extra', 'lightMaterial', 0.68);
  }
  if (/розет|выключ/.test(d)) {
    if (/монтаж|установ|работ/.test(d)) return exact('extra', 'socketInstall', 0.82);
    if (/материал|механизм|розет|выключ/.test(d)) return exact('extra', 'socketMaterial', 0.68);
  }
  if (/т[её]пл.*пол/.test(d)) {
    if (/монтаж|установ|работ/.test(d)) return exact('extra', 'warmFloorInstallPerM2', 0.82);
    if (/материал|комплект|мат/.test(d)) return exact('extra', 'warmFloorMaterialUpTo3M2', 0.7);
  }

  return { group: null, key: null, confidence: 0 };
}

function chooseUnitPrice(numbers: number[]): { quantity: number | null; unitPrice: number; total: number | null } | null {
  if (!numbers.length) return null;

  const positive = numbers.filter(n => Number.isFinite(n) && n >= 0);
  if (!positive.length) return null;

  if (positive.length >= 3) {
    for (let i = 0; i < positive.length - 2; i++) {
      const q = positive[i];
      const price = positive[i + 1];
      const total = positive[i + 2];
      if (q > 0 && price > 0 && total > 0) {
        const expected = q * price;
        const diff = Math.abs(expected - total) / Math.max(total, 1);
        if (diff < 0.04) return { quantity: q, unitPrice: price, total };
      }
    }
  }

  if (positive.length >= 2) {
    const q = positive[0];
    const price = positive[1];
    return { quantity: q > 0 && q < 10000 ? q : null, unitPrice: price, total: positive[2] ?? null };
  }

  return { quantity: null, unitPrice: positive[0], total: null };
}

function rowToCandidate(
  rawValues: unknown[],
  sourceRef: string,
  inheritedPackage: PackageCode | null
): ExtractedRateCandidate | null {
  const strings = rawValues.map(v => String(v ?? '').trim()).filter(Boolean);
  if (!strings.length) return null;

  const description = strings.find(v => /[а-яa-z]/i.test(v) && parseNumber(v) === null) || strings[0];
  if (!description || description.length < 3) return null;

  const unit = inferUnit(strings.join(' '));
  const numbers = rawValues
    .map(parseNumber)
    .filter((n): n is number => n !== null);

  const pricing = chooseUnitPrice(numbers);
  if (!pricing || pricing.unitPrice <= 0 || pricing.unitPrice > 5_000_000) return null;

  const packageCode = detectPackage(strings.join(' ')) || inheritedPackage;
  const suggestion = suggestTarget(description, unit);

  return {
    sourceRef,
    description: description.slice(0, 500),
    unit,
    quantity: pricing.quantity,
    unitPrice: pricing.unitPrice,
    total: pricing.total,
    packageCode,
    suggestedGroup: suggestion.group,
    suggestedKey: suggestion.key,
    confidence: suggestion.confidence
  };
}

async function analyzePdf(buffer: Buffer, fileName: string, note: string) {
  const parsed = await pdfParse(buffer);
  const text = parsed.text || '';
  const inheritedPackage = detectPackage(fileName + ' ' + note + ' ' + text.slice(0, 2000));
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length >= 4);

  const candidates: ExtractedRateCandidate[] = [];
  lines.forEach((line, index) => {
    const chunks = line.split(/\s{2,}|\t/).filter(Boolean);
    const candidate = rowToCandidate(chunks.length > 1 ? chunks : [line], `PDF строка ${index + 1}`, inheritedPackage);
    if (candidate && candidate.suggestedKey) candidates.push(candidate);
  });

  return dedupeCandidates(candidates);
}

function analyzeWorkbook(buffer: Buffer, fileName: string, note: string) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const inheritedPackage = detectPackage(fileName + ' ' + note);
  const candidates: ExtractedRateCandidate[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });

    rows.forEach((row, index) => {
      const packageFromRow = detectPackage(String(row.join(' '))) || inheritedPackage;
      const candidate = rowToCandidate(row, `${sheetName}, строка ${index + 1}`, packageFromRow);
      if (candidate && candidate.suggestedKey) candidates.push(candidate);
    });
  }

  return dedupeCandidates(candidates);
}

function dedupeCandidates(candidates: ExtractedRateCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter(candidate => {
    const key = [
      candidate.sourceRef,
      candidate.packageCode || '',
      candidate.suggestedGroup || '',
      candidate.suggestedKey || '',
      candidate.unitPrice
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 500);
}

export async function analyzeSmetaDocument(input: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  note: string;
}) {
  const lower = input.fileName.toLowerCase();

  if (lower.endsWith('.pdf') || input.mimeType === 'application/pdf') {
    return analyzePdf(input.buffer, input.fileName, input.note);
  }

  if (
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    lower.endsWith('.xlsm') ||
    input.mimeType.includes('spreadsheet') ||
    input.mimeType.includes('excel')
  ) {
    return analyzeWorkbook(input.buffer, input.fileName, input.note);
  }

  throw new Error('Автоматический разбор поддерживает PDF, XLS, XLSX и XLSM.');
}
