import crypto from 'node:crypto';

export class OrderService {
  constructor({ marketService, atkClient, enableOrders = false, maxOrderTry = 1000, approvalTtlMs = 120_000, now = Date.now }) {
    this.marketService = marketService;
    this.atkClient = atkClient;
    this.enableOrders = enableOrders;
    this.maxOrderTry = maxOrderTry;
    this.approvalTtlMs = approvalTtlMs;
    this.now = now;
    this.approvals = new Map();
  }

  async preview(policy) {
    const decision = await this.marketService.check(policy);
    if (decision.decision !== 'AL') return { executable: false, decision };
    if (decision.policy.budgetTry > this.maxOrderTry) throw new Error(`Bütçe güvenlik sınırı olan ${this.maxOrderTry} TL'yi aşıyor.`);
    const approvalId = crypto.randomUUID();
    const expiresAt = this.now() + this.approvalTtlMs;
    this.approvals.set(approvalId, { decision, expiresAt, used: false });
    return { executable: this.enableOrders, approvalId, expiresAt: new Date(expiresAt).toISOString(), decision };
  }

  async confirm({ approvalId, confirmation }) {
    if (!this.enableOrders) throw new Error('Gerçek emir gönderimi kapalı. ENABLE_OKX_ORDERS=true olmadan emir gönderilemez.');
    if (confirmation !== 'ONAYLIYORUM') throw new Error('Açık kullanıcı onayı gerekli.');
    const approval = this.approvals.get(approvalId);
    if (!approval || approval.used || approval.expiresAt < this.now()) throw new Error('Onay bulunamadı, kullanıldı veya süresi doldu.');
    approval.used = true;
    const clientOrderId = `KOPRU${String(this.now())}`.slice(0, 32);
    const placed = await this.atkClient.placeMarketBuyTry({ budgetTry: approval.decision.policy.budgetTry, clientOrderId });
    const item = Array.isArray(placed) ? placed[0] : placed?.data?.[0] || placed;
    const orderId = item?.ordId;
    const verified = await this.atkClient.getOrder({ orderId, clientOrderId });
    return { placed, verified, clientOrderId, decision: approval.decision };
  }
}
