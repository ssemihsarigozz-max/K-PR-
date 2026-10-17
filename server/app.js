import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';

const PUBLIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/portal', ['planet-jumping.html', 'text/html; charset=utf-8']],
  ['/src/app.js', ['src/app.js', 'text/javascript; charset=utf-8']],
  ['/src/decision.js', ['src/decision.js', 'text/javascript; charset=utf-8']]
]);

export function createHandler({ marketService, orderService, avalancheService, venueService, agentService, rootDir = process.cwd() }) {
  return async function handler(request, response) {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (request.method === 'GET' && url.pathname === '/api/health') {
        let fuji = { reachable: false, configured: false };
        try { fuji = { reachable: true, ...(await avalancheService.health()) }; } catch (error) { fuji.error = error.message; }
        return json(response, 200, { ok: true, service: 'Köprü', tradingEnabled: orderService.enableOrders, agent: agentService?.getStatus?.(), fuji });
      }
      if (request.method === 'GET' && url.pathname === '/api/market') {
        const result = await marketService.check(readPolicy(url.searchParams));
        return json(response, 200, result);
      }
      if (request.method === 'GET' && url.pathname === '/api/opportunities') {
        const result = await venueService.scan(readPolicy(url.searchParams));
        return json(response, 200, result);
      }
      if (request.method === 'GET' && url.pathname === '/api/agent/status') return json(response, 200, agentService.getStatus());
      if (request.method === 'POST' && url.pathname === '/api/agent/start') return json(response, 200, agentService.start());
      if (request.method === 'POST' && url.pathname === '/api/agent/stop') return json(response, 200, agentService.stop());
      if (request.method === 'POST' && url.pathname === '/api/agent/run') return json(response, 200, await agentService.runOnce());
      if (request.method === 'POST' && url.pathname === '/api/orders/preview') {
        const body = await readBody(request);
        return json(response, 200, await orderService.preview(body.policy || {}));
      }
      if (request.method === 'POST' && url.pathname === '/api/orders/confirm') {
        const body = await readBody(request);
        return json(response, 200, await orderService.confirm(body));
      }
      if (request.method === 'POST' && url.pathname === '/api/ledger/record') {
        const body = await readBody(request);
        return json(response, 200, await avalancheService.record(body.decision));
      }
      if (request.method === 'GET' && PUBLIC_FILES.has(url.pathname)) {
        const [relative, contentType] = PUBLIC_FILES.get(url.pathname);
        response.writeHead(200, securityHeaders(contentType, url.pathname === '/portal'));
        return response.end(fs.readFileSync(path.join(rootDir, relative)));
      }
      return json(response, 404, { error: 'Bulunamadı.' });
    } catch (error) {
      const status = /kapalı|onay|süresi|güvenlik sınırı/i.test(error.message) ? 403 : 500;
      return json(response, status, { error: error.message });
    }
  };
}

function readPolicy(params) {
  return { budgetTry: Number(params.get('budgetTry')), maxPremiumPct: Number(params.get('maxPremiumPct')) };
}
async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 64 * 1024) throw new Error('İstek çok büyük.');
  }
  return body ? JSON.parse(body) : {};
}
function json(response, status, data) {
  response.writeHead(status, securityHeaders('application/json; charset=utf-8'));
  response.end(JSON.stringify(data, jsonReplacer));
}
function jsonReplacer(_key, value) { return typeof value === 'bigint' ? value.toString() : value; }
function securityHeaders(contentType, immersivePortal = false) {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': immersivePortal
      ? "default-src 'self'; media-src 'self' https://d2ol7oe51mr4n9.cloudfront.net; img-src 'self' data: https://d2ol7oe51mr4n9.cloudfront.net; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
      : "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'"
  };
}
