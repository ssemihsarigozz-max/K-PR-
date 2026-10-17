import test from 'node:test';
import assert from 'node:assert/strict';
import { toLedgerSummary } from './avalanche-service.js';

const decision = {
  status: 'OK', decision: 'BEKLE', checkedAt: '2026-10-17T12:00:00.000Z', premiumPct: 2,
  prices: { globalBtcUsdt: { value: 100000 }, usdtTry: { value: 40 }, trBtcTryAsk: { value: 4080000 } }
};

test('Fuji özeti deterministik ölçek ve hash üretir', () => {
  const first = toLedgerSummary(decision);
  const second = toLedgerSummary(decision);
  assert.equal(first.hash, second.hash);
  assert.equal(first.premiumBps, 200n);
  assert.equal(first.globalBtcUsdtE8, 10000000000000n);
});

test('veri hatası zincire yazılamaz', () => {
  assert.throws(() => toLedgerSummary({ status: 'DATA_ERROR' }), /geçerli kararlar/);
});
