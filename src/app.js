import { evaluateDecision } from './decision.js';
import { fetchPublicOkxPrices, getDemoPrices } from './market-data.js';

const currency = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
const resultElement = document.querySelector('#result');
const note = document.querySelector('#source-note');

document.querySelector('#check-demo').addEventListener('click', () => run(() => getDemoPrices(), 'Örnek veri kullanıldı.'));
document.querySelector('#check-live').addEventListener('click', () => run(fetchPublicOkxPrices, 'Canlı açık piyasa verisi kullanıldı; emir gönderilmedi.'));

async function run(provider, sourceNote) {
  setLoading(true);
  try {
    const prices = await provider();
    const decision = evaluateDecision({ prices, policy: readPolicy() });
    render(decision);
    note.textContent = sourceNote;
  } catch (error) {
    render({ status: 'DATA_ERROR', decision: 'VERİ HATASI', reason: error.message });
    note.textContent = 'Veri alınamadı; işlem planı oluşturulmadı.';
  } finally { setLoading(false); }
}
function readPolicy() { return { budgetTry: Number(document.querySelector('#budget').value), maxPremiumPct: Number(document.querySelector('#premium').value) }; }
function render(data) {
  resultElement.classList.remove('hidden');
  if (data.status !== 'OK') { resultElement.className = 'result error'; resultElement.innerHTML = `<h2>${data.decision}</h2><p>${data.reason}</p>`; return; }
  const buy = data.decision === 'AL';
  resultElement.className = `result ${buy ? 'buy' : 'wait'}`;
  resultElement.innerHTML = `<div class="decision"><div><p class="eyebrow">KARAR</p><h2>${data.decision}</h2></div><p>${data.reason}</p></div><div class="grid"><article><span>Global BTC-USDT</span><strong>${number.format(data.prices.globalBtcUsdt.value)} USDT</strong></article><article><span>OKX TR USDT-TRY</span><strong>${currency.format(data.prices.usdtTry.value)}</strong></article><article><span>Hesaplanan BTC değeri</span><strong>${currency.format(data.calculatedTry)}</strong></article><article><span>OKX TR BTC alış fiyatı</span><strong>${currency.format(data.prices.trBtcTryAsk.value)}</strong></article><article><span>Fark</span><strong>%${number.format(data.premiumPct)}</strong></article><article><span>İşlem planı</span><strong>${buy ? `${currency.format(data.policy.budgetTry)} ile ≈ ${data.btcAmount.toFixed(8)} BTC` : 'Alım bekletildi'}</strong></article></div><p class="timestamp">Kontrol: ${new Date(data.checkedAt).toLocaleString('tr-TR')} · Fuji kaydı: sonraki adımda eklenecek</p>`;
}
function setLoading(active) { document.querySelectorAll('button').forEach((button) => button.disabled = active); }
