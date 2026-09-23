# Renovation Calculator Backend

Backend API для предварительного расчёта стоимости ремонта и вознаграждения риелтора 5%.

## Стек
- Node.js 20+
- TypeScript
- Fastify
- Zod
- Vitest

## Запуск
```bash
npm install
npm run dev
```

Сервер: `http://localhost:8080`

## API

### GET /health

### GET /api/v1/packages
Возвращает тарифы пакетов и ставку вознаграждения.

### POST /api/v1/estimate
Пример запроса:

```json
{
  "areaM2": 45.4,
  "package": "comfort",
  "propertyType": "apartment",
  "condition": "new_build",
  "bathrooms": 1,
  "rooms": 2,
  "doors": 4,
  "needsFullElectrical": true,
  "needsFullPlumbing": true,
  "needsDemolition": false,
  "needsCeiling": true,
  "hasBalcony": false,
  "warmFloorM2": 3,
  "finishLevel": 0.5
}
```

Пример ответа:

```json
{
  "currency": "RUB",
  "areaM2": 45.4,
  "package": "comfort",
  "basePricePerM2": 39750,
  "lines": [],
  "estimateBeforeReward": 0,
  "agentRewardRate": 0.05,
  "agentReward": 0,
  "clientTotal": 0,
  "pricePerM2Final": 0,
  "disclaimer": "Предварительный расчёт..."
}
```

## Важная бизнес-логика
- Вознаграждение риелтора = `estimateBeforeReward * 5%`.
- В текущей версии комиссия показывается отдельно и **не увеличивает сумму для клиента**.
- Если комиссия должна начисляться сверху к смете, поменяйте `clientTotal` в `src/calculator.ts` на `estimateBeforeReward + agentReward`.
- Все коэффициенты вынесены в `src/pricing.ts` и `src/calculator.ts`, чтобы их можно было заменить на реальные тарифы CRM.
