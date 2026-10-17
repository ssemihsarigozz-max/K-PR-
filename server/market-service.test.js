import test from 'node:test';
import assert from 'node:assert/strict';
import { MarketService, normalize } from './market-service.js';

const now = Date.UTC(2026, 9, 17, 12, 0, 0);
const ticker = (instId, last, askPx = last) => ({ instId, last: String(last), askPx: String(askPx), ts: String(now) });

test('ATK tickerlarını doğru alanlarla karara dönüştürür', async () => {
  const data = {
    'BTC-USDT': ticker('BTC-USDT', 100000, 100001),
    'BTC-TRY': ticker('BTC-TRY', 4000000, 4020000),
    'USDT-TRY': ticker('USDT-TRY', 39.9, 40)
  };
  const service = new MarketService({ atkClient: { getTicker: async (id) => data[id] }, now: () => now });
  const result = await service.check({ budgetTry: 1000, maxPremiumPct: 0.8 });
  assert.equal(result.decision, 'AL');
  assert.equal(result.premiumPct, 0.5);
  assert.equal(result.prices.globalBtcUsdt.value, 100000);
  assert.equal(result.prices.trBtcTryAsk.value, 4020000);
});

test('geçersiz ticker reddedilir', () => {
  assert.throws(() => normalize({ last: 'x', ts: 'x' }, 'last', 'test'), /geçersiz/i);
});
