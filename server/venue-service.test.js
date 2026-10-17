import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, VenueService } from './venue-service.js';

const now = Date.UTC(2026, 9, 17, 12, 0, 0);
const market = {
  status: 'OK', calculatedTry: 4_000_000,
  prices: { trBtcTryAsk: { value: 4_020_000 } }
};

test('geniş katalogdaki çalışan ve mock kaynaklar açıkça etiketlidir', async () => {
  const service = new VenueService({ marketService: { check: async () => market }, now: () => now });
  const result = await service.scan({ budgetTry: 1000 });
  assert.equal(result.coverage.live, 2);
  assert.equal(result.coverage.mock, CATALOG.length - 2);
  assert.deepEqual(result.venues.filter((item) => item.mode === 'LIVE').map((item) => item.name), ['OKX TR', 'OKX Global']);
  assert.ok(result.venues.filter((item) => item.mode === 'MOCK').every((item) => /mock/i.test(item.source)));
});

test('mock ayak içeren en iyi fırsat hiçbir zaman çalıştırılabilir değildir', async () => {
  const service = new VenueService({ marketService: { check: async () => market }, now: () => now });
  const result = await service.scan({ budgetTry: 10_000 });
  assert.equal(result.opportunity.simulationOnly, true);
  assert.equal(result.opportunity.executable, false);
  assert.match(result.opportunity.reason, /MOCK/);
});

test('mock tarama aynı girdide deterministik sonuç üretir', async () => {
  const service = new VenueService({ marketService: { check: async () => market }, now: () => now });
  const first = await service.scan({ budgetTry: 5000 });
  const second = await service.scan({ budgetTry: 5000 });
  assert.deepEqual(first.venues, second.venues);
  assert.equal(first.opportunity.netProfitTry, second.opportunity.netProfitTry);
});
