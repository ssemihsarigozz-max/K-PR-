import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderService } from './order-service.js';

const decision = {
  status: 'OK', decision: 'AL', policy: { budgetTry: 1000 }, premiumPct: 0.5,
  prices: {}, checkedAt: '2026-10-17T12:00:00.000Z'
};

test('gerçek emir kapalıyken önizleme üretir ama confirm reddeder', async () => {
  const service = new OrderService({ marketService: { check: async () => decision }, atkClient: {}, enableOrders: false, now: () => 10 });
  const preview = await service.preview({ budgetTry: 1000 });
  assert.equal(preview.executable, false);
  await assert.rejects(() => service.confirm({ approvalId: preview.approvalId, confirmation: 'ONAYLIYORUM' }), /kapalı/);
});

test('onaylı emri yalnızca bir kez gönderir ve doğrular', async () => {
  let placed = 0;
  const atkClient = {
    placeMarketBuyTry: async () => { placed += 1; return [{ ordId: '42' }]; },
    getOrder: async ({ orderId }) => ({ ordId: orderId, state: 'filled' })
  };
  const service = new OrderService({ marketService: { check: async () => decision }, atkClient, enableOrders: true, now: () => 10 });
  const preview = await service.preview({ budgetTry: 1000 });
  const result = await service.confirm({ approvalId: preview.approvalId, confirmation: 'ONAYLIYORUM' });
  assert.equal(result.verified.state, 'filled');
  assert.equal(placed, 1);
  await assert.rejects(() => service.confirm({ approvalId: preview.approvalId, confirmation: 'ONAYLIYORUM' }), /kullanıldı/);
});

test('bütçe güvenlik sınırını aşamaz', async () => {
  const tooLarge = { ...decision, policy: { budgetTry: 1001 } };
  const service = new OrderService({ marketService: { check: async () => tooLarge }, atkClient: {}, maxOrderTry: 1000 });
  await assert.rejects(() => service.preview({}), /güvenlik sınırı/);
});
