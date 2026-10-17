import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDecision } from './decision.js';

const now = Date.UTC(2026, 9, 17, 10, 0, 0);
const prices = (trBtcTryAsk = 4_020_000, timestamp = new Date(now).toISOString()) => ({
  globalBtcUsdt: { value: 100_000, timestamp }, usdtTry: { value: 40, timestamp }, trBtcTryAsk: { value: trBtcTryAsk, timestamp }
});

test('fark limitteyse AL planı üretir', () => {
  const result = evaluateDecision({ prices: prices(), now });
  assert.equal(result.decision, 'AL');
  assert.equal(result.premiumPct, 0.5);
  assert.ok(result.btcAmount > 0);
});
test('fark limiti aşarsa BEKLE üretir', () => {
  const result = evaluateDecision({ prices: prices(4_080_000), now });
  assert.equal(result.decision, 'BEKLE');
  assert.equal(result.premiumPct, 2);
});
test('eski fiyat için işlem yapmaz', () => {
  const old = new Date(now - 91_000).toISOString();
  const result = evaluateDecision({ prices: prices(4_000_000, old), now });
  assert.equal(result.decision, 'VERİ HATASI');
  assert.match(result.reason, /Güncel olmayan/);
});
