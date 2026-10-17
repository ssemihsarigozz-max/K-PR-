import { evaluateDecision } from '../src/decision.js';

export class MarketService {
  constructor({ atkClient, now = Date.now }) { this.atkClient = atkClient; this.now = now; }

  async check(policy) {
    const [globalTicker, trTicker, usdtTicker] = await Promise.all([
      this.atkClient.getTicker('BTC-USDT', 'global'),
      this.atkClient.getTicker('BTC-TRY', 'tr'),
      this.atkClient.getTicker('USDT-TRY', 'tr')
    ]);
    const prices = {
      globalBtcUsdt: normalize(globalTicker, 'last', 'OKX ATK · Global'),
      usdtTry: normalize(usdtTicker, 'askPx', 'OKX ATK · TR'),
      trBtcTryAsk: normalize(trTicker, 'askPx', 'OKX ATK · TR')
    };
    return evaluateDecision({ prices, policy, now: this.now() });
  }
}

export function normalize(ticker, field, source) {
  const value = Number(ticker?.[field] || ticker?.last);
  const timestampMs = Number(ticker?.ts);
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(timestampMs) || timestampMs <= 0) throw new Error('ATK geçersiz piyasa verisi döndürdü.');
  const timestamp = new Date(timestampMs).toISOString();
  return { value, timestamp, source, instrument: ticker.instId };
}
