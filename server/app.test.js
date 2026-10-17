import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createHandler } from './app.js';

test('health ve piyasa API uçları yanıt verir', async (t) => {
  const handler = createHandler({
    marketService: { check: async (policy) => ({ status: 'OK', decision: 'AL', policy }) },
    orderService: { enableOrders: false },
    avalancheService: { health: async () => ({ chainId: 43113, configured: false }) },
    venueService: { scan: async (policy) => ({ status: 'OK', coverage: { live: 2, mock: 14 }, policy }) }
  });
  const server = http.createServer(handler).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const health = await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.ok, true);
  assert.equal(health.fuji.chainId, 43113);
  const market = await (await fetch(`${base}/api/market?budgetTry=1000&maxPremiumPct=0.8`)).json();
  assert.equal(market.decision, 'AL');
  assert.equal(market.policy.budgetTry, 1000);
  const opportunities = await (await fetch(`${base}/api/opportunities?budgetTry=2500&maxPremiumPct=0.8`)).json();
  assert.equal(opportunities.coverage.live, 2);
  assert.equal(opportunities.policy.budgetTry, 2500);
  const portal = await fetch(`${base}/portal`);
  assert.equal(portal.status, 200);
  assert.match(await portal.text(), /Planet Jumping/);
  assert.match(portal.headers.get('content-security-policy'), /d2ol7oe51mr4n9\.cloudfront\.net/);
});
