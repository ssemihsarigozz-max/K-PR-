import { MarketService } from '../server/market-service.js';
import { VenueService } from '../server/venue-service.js';
import { OrderService } from '../server/order-service.js';

class PublicOkxClient {
  async getTicker(instrument, site) {
    const origin = site === 'tr' ? 'https://tr.okx.com' : 'https://www.okx.com';
    const response = await fetch(`${origin}/api/v5/market/ticker?instId=${encodeURIComponent(instrument)}`, {
      headers: { 'User-Agent': 'Kopru-Vercel/1.0' }, signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) throw new Error(`OKX ${site} verisi alınamadı (${response.status}).`);
    const payload = await response.json();
    const ticker = payload?.data?.[0];
    if (payload?.code !== '0' || !ticker) throw new Error(`OKX ${site} geçerli ticker döndürmedi.`);
    return ticker;
  }
}

const atkClient = new PublicOkxClient();
const marketService = new MarketService({ atkClient });
const venueService = new VenueService({ marketService });
const orderService = new OrderService({ marketService, atkClient, enableOrders: false, maxOrderTry: 1_000 });

export default async function handler(request, response) {
  try {
    const url = new URL(request.url, 'https://kopru.vercel.app');
    const route = String(url.searchParams.get('route') || '').replace(/^\/+/, '');
    if (request.method === 'GET' && route === 'health') return json(response, 200, {
      ok: true, service: 'Köprü', deployment: 'vercel', tradingEnabled: false,
      agent: { running: false, phase: 'LOCAL_ONLY', message: 'Kalıcı paper agent yalnızca yerel sunucuda çalışır.' },
      fuji: { reachable: false, configured: false, message: 'Fuji yazımı deploy sürümünde kapalıdır.' }
    });
    if (request.method === 'GET' && route === 'market') return json(response, 200, await marketService.check(readPolicy(url.searchParams)));
    if (request.method === 'GET' && route === 'opportunities') return json(response, 200, await venueService.scan(readPolicy(url.searchParams)));
    if (request.method === 'GET' && route === 'agent/status') return json(response, 200, {
      running: false, phase: 'LOCAL_ONLY', deployment: 'vercel',
      message: '60 saniyelik kalıcı agent, yerel Köprü sunucusunda çalışır.'
    });
    if (request.method === 'POST' && ['agent/start', 'agent/stop', 'agent/run'].includes(route)) {
      return json(response, 409, { error: 'Kalıcı paper agent Vercel üzerinde çalıştırılamaz; yerel sunucuyu kullanın.' });
    }
    if (request.method === 'POST' && route === 'orders/preview') {
      return json(response, 200, await orderService.preview((await readBody(request)).policy || {}));
    }
    if (request.method === 'POST' && route === 'orders/confirm') {
      return json(response, 403, { error: 'Vercel deploy sürümünde gerçek emir gönderimi kapalıdır.' });
    }
    if (request.method === 'POST' && route === 'ledger/record') {
      return json(response, 503, { error: 'Fuji kontratı yapılandırılmadığı için zincir kaydı kapalıdır.' });
    }
    return json(response, 404, { error: 'Bulunamadı.' });
  } catch (error) {
    return json(response, 500, { error: error.message });
  }
}

function readPolicy(params) {
  const budgetTry = Number(params.get('budgetTry'));
  const maxPremiumPct = Number(params.get('maxPremiumPct'));
  return {
    budgetTry: Number.isFinite(budgetTry) && budgetTry > 0 ? budgetTry : 1_000,
    maxPremiumPct: Number.isFinite(maxPremiumPct) && maxPremiumPct >= 0 ? maxPremiumPct : 0.8
  };
}

async function readBody(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  let body = '';
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : {};
}

function json(response, status, value) {
  response.status(status).setHeader('Cache-Control', 'no-store').json(value);
}
