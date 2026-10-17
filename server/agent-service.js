import fs from 'node:fs';
import path from 'node:path';

const PHASES = Object.freeze({
  IDLE: 'IDLE', OBSERVING: 'OBSERVING', VALIDATING: 'VALIDATING',
  RISK_CHECK: 'RISK_CHECK', PAPER_EXECUTION: 'PAPER_EXECUTION', RECORDING: 'RECORDING', ERROR: 'ERROR'
});

export class LocalAgentService {
  constructor({
    marketService, storagePath = '', now = Date.now,
    intervalMs = 60_000, policy = {}, initialTry = 10_000,
    paperFeePct = 0.1, maxTradesPerDay = 3, cooldownMs = 30 * 60_000,
    maxExposureTry = 5_000, setTimer = setInterval, clearTimer = clearInterval
  }) {
    this.marketService = marketService;
    this.storagePath = storagePath;
    this.now = now;
    this.intervalMs = Math.max(10_000, intervalMs);
    this.policy = { budgetTry: 1_000, maxPremiumPct: 0.8, ...policy };
    this.paperFeePct = paperFeePct;
    this.maxTradesPerDay = maxTradesPerDay;
    this.cooldownMs = cooldownMs;
    this.maxExposureTry = maxExposureTry;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.timer = null;
    this.inCycle = false;
    this.state = this.loadState(initialTry);
  }

  start() {
    if (this.timer) return this.getStatus();
    this.state.running = true;
    this.state.phase = PHASES.IDLE;
    this.addEvent('AGENT_STARTED', `Agent ${this.intervalMs / 1000} saniyelik döngüyle başladı.`);
    this.timer = this.setTimer(() => void this.runOnce(), this.intervalMs);
    void this.runOnce();
    this.persist();
    return this.getStatus();
  }

  stop() {
    if (this.timer) this.clearTimer(this.timer);
    this.timer = null;
    this.state.running = false;
    this.state.phase = PHASES.IDLE;
    this.addEvent('AGENT_STOPPED', 'Agent döngüsü durduruldu.');
    this.persist();
    return this.getStatus();
  }

  async runOnce() {
    if (this.inCycle) return { skipped: true, reason: 'Önceki agent döngüsü hâlâ çalışıyor.', status: this.getStatus() };
    this.inCycle = true;
    const cycleStartedAt = this.now();
    try {
      this.setPhase(PHASES.OBSERVING);
      const decision = await this.marketService.check(this.policy);
      this.setPhase(PHASES.VALIDATING);
      if (decision.status !== 'OK') throw new Error(decision.reason || 'Piyasa verisi doğrulanamadı.');

      const markPriceTry = decision.prices.trBtcTryAsk.value;
      this.markPortfolio(markPriceTry);
      this.state.lastDecision = compactDecision(decision);
      this.setPhase(PHASES.RISK_CHECK);
      const risk = this.evaluateRisk(decision);
      let action = { type: 'NO_TRADE', reason: risk.reason };

      if (decision.decision === 'AL' && risk.allowed) {
        this.setPhase(PHASES.PAPER_EXECUTION);
        action = this.paperBuy(decision);
      }

      this.setPhase(PHASES.RECORDING);
      this.state.cycleCount += 1;
      this.state.lastCycleAt = new Date(cycleStartedAt).toISOString();
      this.state.lastError = null;
      this.addEvent(action.type, action.reason, action.tradeId);
      this.persist();
      return { decision: this.state.lastDecision, risk, action, status: this.getStatus() };
    } catch (error) {
      this.state.phase = PHASES.ERROR;
      this.state.lastError = error.message;
      this.addEvent('CYCLE_ERROR', error.message);
      this.persist();
      return { error: error.message, status: this.getStatus() };
    } finally {
      this.inCycle = false;
      if (this.state.running) this.state.phase = PHASES.IDLE;
    }
  }

  getStatus() {
    return structuredClone({
      ...this.state,
      phase: this.inCycle ? this.state.phase : this.state.running ? PHASES.IDLE : this.state.phase,
      config: {
        intervalMs: this.intervalMs, policy: this.policy, paperFeePct: this.paperFeePct,
        maxTradesPerDay: this.maxTradesPerDay, cooldownMs: this.cooldownMs,
        maxExposureTry: this.maxExposureTry, realOrdersEnabled: false
      }
    });
  }

  evaluateRisk(decision) {
    if (decision.decision !== 'AL') return { allowed: false, reason: `Karar ${decision.decision}; paper işlem açılmadı.` };
    const today = new Date(this.now()).toISOString().slice(0, 10);
    const dailyTrades = this.state.trades.filter((trade) => trade.timestamp.startsWith(today)).length;
    if (dailyTrades >= this.maxTradesPerDay) return { allowed: false, reason: 'Günlük paper işlem limiti doldu.' };
    const lastTrade = this.state.trades.at(-1);
    if (lastTrade && this.now() - new Date(lastTrade.timestamp).getTime() < this.cooldownMs) return { allowed: false, reason: 'İşlemler arası güvenlik bekleme süresi devam ediyor.' };
    if (this.state.portfolio.cashTry < decision.policy.budgetTry) return { allowed: false, reason: 'Sanal TL bakiyesi yetersiz.' };
    const exposureTry = this.state.portfolio.btc * decision.prices.trBtcTryAsk.value;
    if (exposureTry + decision.policy.budgetTry > this.maxExposureTry) return { allowed: false, reason: 'Maksimum sanal BTC pozisyon limiti aşılırdı.' };
    return { allowed: true, reason: 'Tüm paper-trading risk kontrolleri geçti.' };
  }

  paperBuy(decision) {
    const grossTry = decision.policy.budgetTry;
    const feeTry = grossTry * (this.paperFeePct / 100);
    const netTry = grossTry - feeTry;
    const priceTry = decision.prices.trBtcTryAsk.value;
    const quantityBtc = netTry / priceTry;
    const portfolio = this.state.portfolio;
    const previousCost = portfolio.btc * portfolio.avgCostTry;
    portfolio.cashTry -= grossTry;
    portfolio.btc += quantityBtc;
    portfolio.avgCostTry = (previousCost + grossTry) / portfolio.btc;
    this.markPortfolio(priceTry);
    const trade = {
      id: `paper-${this.now()}-${this.state.trades.length + 1}`,
      timestamp: new Date(this.now()).toISOString(), side: 'BUY', venue: 'OKX TR', mode: 'PAPER',
      priceTry, grossTry, feeTry, quantityBtc, decision: decision.decision
    };
    this.state.trades.push(trade);
    this.state.trades = this.state.trades.slice(-100);
    return { type: 'PAPER_BUY', reason: `${grossTry} TL sanal bütçeyle OKX TR paper alımı kaydedildi.`, tradeId: trade.id };
  }

  markPortfolio(priceTry) {
    const portfolio = this.state.portfolio;
    portfolio.markPriceTry = priceTry;
    portfolio.marketValueTry = portfolio.btc * priceTry;
    portfolio.equityTry = portfolio.cashTry + portfolio.marketValueTry;
    portfolio.unrealizedPnlTry = portfolio.btc * (priceTry - portfolio.avgCostTry);
  }

  setPhase(phase) { this.state.phase = phase; }
  addEvent(type, message, tradeId = null) {
    this.state.events.push({ timestamp: new Date(this.now()).toISOString(), type, message, tradeId });
    this.state.events = this.state.events.slice(-200);
  }

  loadState(initialTry) {
    const fallback = {
      version: 1, running: false, phase: PHASES.IDLE, cycleCount: 0,
      lastCycleAt: null, lastError: null, lastDecision: null,
      portfolio: { initialTry, cashTry: initialTry, btc: 0, avgCostTry: 0, markPriceTry: 0, marketValueTry: 0, equityTry: initialTry, unrealizedPnlTry: 0, realizedPnlTry: 0 },
      trades: [], events: []
    };
    if (!this.storagePath || !fs.existsSync(this.storagePath)) return fallback;
    try {
      const saved = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
      return saved?.version === 1 ? { ...fallback, ...saved, running: false, phase: PHASES.IDLE } : fallback;
    } catch { return fallback; }
  }

  persist() {
    if (!this.storagePath) return;
    fs.mkdirSync(path.dirname(this.storagePath), { recursive: true });
    const tempPath = `${this.storagePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    fs.renameSync(tempPath, this.storagePath);
  }
}

function compactDecision(decision) {
  return {
    status: decision.status, decision: decision.decision, reason: decision.reason,
    checkedAt: decision.checkedAt, premiumPct: decision.premiumPct,
    budgetTry: decision.policy.budgetTry, calculatedTry: decision.calculatedTry,
    trBtcTryAsk: decision.prices.trBtcTryAsk.value
  };
}

export { PHASES };
