/** Köprü'nün deterministik karar motoru: LLM veya ağ çağrısı içermez. */
export const DEFAULT_POLICY = Object.freeze({
  budgetTry: 1000,
  maxPremiumPct: 0.8,
  maxDataAgeMs: 90_000,
  estimatedFeePct: 0
});

export function evaluateDecision({ prices, policy = {}, now = Date.now() }) {
  const rule = { ...DEFAULT_POLICY, ...policy };
  const required = ['globalBtcUsdt', 'usdtTry', 'trBtcTryAsk'];
  const missing = required.filter((key) => !isPositiveFinite(prices?.[key]?.value));
  if (missing.length) return dataError(`Eksik veya geçersiz fiyat: ${missing.join(', ')}.`);

  const stale = required.filter((key) => !isFresh(prices[key].timestamp, now, rule.maxDataAgeMs));
  if (stale.length) return dataError(`Güncel olmayan veri: ${stale.join(', ')}. İşlem planı oluşturulmadı.`);

  if (!isPositiveFinite(rule.budgetTry) || !isFiniteNumber(rule.maxPremiumPct) || rule.maxPremiumPct < 0) {
    return dataError('Bütçe veya kabul edilen fark geçersiz.');
  }

  const calculatedTry = prices.globalBtcUsdt.value * prices.usdtTry.value;
  const premiumPct = ((prices.trBtcTryAsk.value - calculatedTry) / calculatedTry) * 100;
  const estimatedFeeTry = rule.budgetTry * (Number(rule.estimatedFeePct) / 100);
  const totalEstimatedCostTry = rule.budgetTry + estimatedFeeTry;
  const decision = premiumPct <= rule.maxPremiumPct ? 'AL' : 'BEKLE';
  const btcAmount = decision === 'AL' ? rule.budgetTry / prices.trBtcTryAsk.value : 0;

  const reason = decision === 'AL'
    ? `OKX TR BTC alış fiyatı hesaplanan TL karşılığının %${format(premiumPct)} üzerinde; bu, %${format(rule.maxPremiumPct)} limitinin içinde.`
    : `OKX TR BTC alış fiyatı hesaplanan TL karşılığının %${format(premiumPct)} üzerinde; bu, %${format(rule.maxPremiumPct)} limitini aşıyor.`;

  return {
    status: 'OK', decision, reason, policy: rule,
    calculatedTry, premiumPct, estimatedFeeTry, totalEstimatedCostTry, btcAmount,
    checkedAt: new Date(now).toISOString(), prices
  };
}

function dataError(reason) { return { status: 'DATA_ERROR', decision: 'VERİ HATASI', reason }; }
function isPositiveFinite(value) { return isFiniteNumber(value) && value > 0; }
function isFiniteNumber(value) { return Number.isFinite(Number(value)); }
function isFresh(timestamp, now, maxAgeMs) {
  const time = new Date(timestamp).getTime();
  return Number.isFinite(time) && time <= now && now - time <= maxAgeMs;
}
function format(value) { return Number(value).toFixed(2).replace('.', ','); }
