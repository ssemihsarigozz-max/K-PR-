import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalAgentService } from './agent-service.js';

const start = Date.UTC(2026, 9, 17, 12, 0, 0);
function decision(kind = 'AL') {
  return {
    status: 'OK', decision: kind, reason: kind === 'AL' ? 'Limit içinde.' : 'Limit dışında.',
    checkedAt: new Date(start).toISOString(), premiumPct: 0.2,
    policy: { budgetTry: 1000, maxPremiumPct: 0.8 }, calculatedTry: 4_000_000,
    prices: { trBtcTryAsk: { value: 4_010_000 } }
  };
}

test('agent risk kontrolünden sonra yalnızca sanal OKX alımı yapar', async () => {
  let now = start;
  const agent = new LocalAgentService({ marketService: { check: async () => decision('AL') }, now: () => now, storagePath: '' });
  const result = await agent.runOnce();
  assert.equal(result.action.type, 'PAPER_BUY');
  assert.equal(result.status.trades.length, 1);
  assert.equal(result.status.trades[0].venue, 'OKX TR');
  assert.equal(result.status.trades[0].mode, 'PAPER');
  assert.equal(result.status.config.realOrdersEnabled, false);
  assert.equal(result.status.portfolio.cashTry, 9000);
});

test('BEKLE kararında paper işlem açılmaz', async () => {
  const agent = new LocalAgentService({ marketService: { check: async () => decision('BEKLE') }, now: () => start, storagePath: '' });
  const result = await agent.runOnce();
  assert.equal(result.action.type, 'NO_TRADE');
  assert.equal(result.status.trades.length, 0);
});

test('cooldown art arda paper işlem açılmasını engeller', async () => {
  let now = start;
  const agent = new LocalAgentService({ marketService: { check: async () => decision('AL') }, now: () => now, storagePath: '', cooldownMs: 60_000 });
  await agent.runOnce();
  now += 10_000;
  const second = await agent.runOnce();
  assert.equal(second.action.type, 'NO_TRADE');
  assert.match(second.risk.reason, /bekleme süresi/i);
  assert.equal(second.status.trades.length, 1);
});

test('paper portföy ve geçmiş yeniden başlatmada yerel diskten yüklenir', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kopru-agent-'));
  const storagePath = path.join(directory, 'state.json');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const first = new LocalAgentService({ marketService: { check: async () => decision('AL') }, now: () => start, storagePath });
  await first.runOnce();
  const restored = new LocalAgentService({ marketService: { check: async () => decision('BEKLE') }, now: () => start, storagePath });
  const status = restored.getStatus();
  assert.equal(status.trades.length, 1);
  assert.equal(status.portfolio.cashTry, 9000);
  assert.equal(status.running, false);
});
