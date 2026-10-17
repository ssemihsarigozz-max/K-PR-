import { evaluateDecision } from './decision.js';

const currency = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
const elements = Object.fromEntries([...document.querySelectorAll('[id]')].map((element) => [element.id, element]));
let lastDecision = null;
let approvalId = null;

elements['check-live'].addEventListener('click', checkLive);
elements['scan-ecosystem'].addEventListener('click', scanEcosystem);
elements['check-demo'].addEventListener('click', checkDemo);
elements['preview-order'].addEventListener('click', previewOrder);
elements['confirm-order'].addEventListener('click', confirmOrder);
elements['record-fuji'].addEventListener('click', recordFuji);
document.querySelector('[data-scroll-to]')?.addEventListener('click', () => {
  document.getElementById('policy-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
checkHealth();

async function checkHealth() {
  try {
    const health = await api('/api/health');
    elements['api-dot'].classList.add('online');
    elements['api-status'].textContent = 'Köprü sunucusu hazır';
    const fuji = health.fuji.configured ? 'Fuji hazır' : 'Fuji yapılandırılmadı';
    const trading = health.tradingEnabled ? 'emir açık' : 'emir güvenlik kilidinde';
    const agent = health.agent?.running ? 'paper agent aktif' : health.agent?.phase === 'LOCAL_ONLY' ? 'paper agent yalnızca yerelde' : 'paper agent durdu';
    elements['system-detail'].textContent = `${agent} · ${fuji} · ${trading}`;
  } catch (error) {
    elements['api-status'].textContent = 'Sunucuya ulaşılamıyor';
    elements['system-detail'].textContent = error.message;
  }
}

async function checkLive() {
  await withLoading(async () => {
    clearMessage();
    const policy = readPolicy();
    lastDecision = await api(`/api/market?budgetTry=${encodeURIComponent(policy.budgetTry)}&maxPremiumPct=${encodeURIComponent(policy.maxPremiumPct)}`);
    renderDecision(lastDecision);
    elements['source-note'].textContent = 'Canlı OKX ATK verisi kullanıldı. Henüz emir gönderilmedi.';
  });
}

async function scanEcosystem() {
  await withLoading(async () => {
    clearMessage();
    const policy = readPolicy();
    const result = await api(`/api/opportunities?budgetTry=${encodeURIComponent(policy.budgetTry)}&maxPremiumPct=${encodeURIComponent(policy.maxPremiumPct)}`);
    renderEcosystem(result);
    elements['source-note'].textContent = `${result.coverage.live} canlı, ${result.coverage.mock} mock piyasa tarandı. MOCK rotalar hiçbir zaman emir üretmez.`;
  });
}

function checkDemo() {
  const now = Date.now();
  const timestamp = new Date(now).toISOString();
  lastDecision = evaluateDecision({
    prices: {
      globalBtcUsdt: { value: 100000, timestamp, source: 'Etiketli örnek' },
      usdtTry: { value: 40, timestamp, source: 'Etiketli örnek' },
      trBtcTryAsk: { value: 4080000, timestamp, source: 'Etiketli örnek' }
    },
    policy: readPolicy(), now
  });
  renderDecision(lastDecision);
  elements['source-note'].textContent = 'Açıkça etiketlenmiş örnek veri kullanıldı; bu karar emir veya Fuji kaydı için kullanılamaz.';
  elements['preview-order'].disabled = true;
  elements['record-fuji'].disabled = true;
}

async function previewOrder() {
  await withLoading(async () => {
    const preview = await api('/api/orders/preview', { method: 'POST', body: { policy: readPolicy() } });
    lastDecision = preview.decision;
    approvalId = preview.approvalId || null;
    renderDecision(lastDecision);
    elements.approval.classList.remove('hidden');
    elements['approval-controls'].classList.toggle('hidden', !preview.executable);
    elements['approval-copy'].textContent = lastDecision.decision !== 'AL'
      ? `Güncel karar ${lastDecision.decision}; emir oluşturulmadı.`
      : preview.executable
        ? `${currency.format(lastDecision.policy.budgetTry)} tutarında BTC-TRY piyasa emri hazır. Onay ${new Date(preview.expiresAt).toLocaleTimeString('tr-TR')} tarihinde sona erecek.`
        : 'Alım planı uygun; ancak gerçek emir güvenlik kilidi kapalı olduğu için borsaya gönderilmeyecek.';
  });
}

async function confirmOrder() {
  await withLoading(async () => {
    const result = await api('/api/orders/confirm', { method: 'POST', body: { approvalId, confirmation: elements.confirmation.value } });
    elements['approval-copy'].textContent = `Emir gönderildi ve OKX üzerinden doğrulandı. İstemci emir kodu: ${result.clientOrderId}`;
    elements['approval-controls'].classList.add('hidden');
    showMessage('OKX emri gönderildi ve durum bilgisi tekrar okundu.', 'success');
  });
}

async function recordFuji() {
  if (!lastDecision) return;
  await withLoading(async () => {
    const result = await api('/api/ledger/record', { method: 'POST', body: { decision: lastDecision } });
    const link = document.createElement('a');
    link.href = result.explorerUrl; link.target = '_blank'; link.rel = 'noreferrer'; link.textContent = 'Fuji işlem kaydını aç';
    showMessage('Karar Fuji C-Chain’e kaydedildi. ', 'success', link);
  });
}

function renderDecision(data) {
  elements.result.classList.remove('hidden', 'buy', 'wait', 'error');
  elements.result.classList.add(data.status !== 'OK' ? 'error' : data.decision === 'AL' ? 'buy' : 'wait');
  elements['decision-title'].textContent = data.decision;
  elements['decision-reason'].textContent = data.reason;
  elements['price-grid'].replaceChildren();
  if (data.status !== 'OK') return;
  const cards = [
    ['Global BTC-USDT', `${number.format(data.prices.globalBtcUsdt.value)} USDT`],
    ['OKX TR USDT-TRY alış', currency.format(data.prices.usdtTry.value)],
    ['Hesaplanan BTC değeri', currency.format(data.calculatedTry)],
    ['OKX TR BTC alış', currency.format(data.prices.trBtcTryAsk.value)],
    ['Fark', `%${number.format(data.premiumPct)}`],
    ['İşlem planı', data.decision === 'AL' ? `${currency.format(data.policy.budgetTry)} → ≈ ${data.btcAmount.toFixed(8)} BTC` : 'Alım bekletildi']
  ];
  for (const [label, value] of cards) {
    const article = document.createElement('article');
    const span = document.createElement('span'); span.textContent = label;
    const strong = document.createElement('strong'); strong.textContent = value;
    article.append(span, strong); elements['price-grid'].append(article);
  }
  elements['result-meta'].textContent = `Kontrol: ${new Date(data.checkedAt).toLocaleString('tr-TR')} · Kaynak: ${data.prices.trBtcTryAsk.source}`;
  elements['preview-order'].disabled = false;
  elements['record-fuji'].disabled = false;
  elements.approval.classList.add('hidden');
}

function renderEcosystem(data) {
  elements.ecosystem.classList.remove('hidden');
  elements['coverage-summary'].textContent = `${data.coverage.total} piyasa · ${data.coverage.live} canlı · ${data.coverage.mock} mock`;
  const route = data.opportunity;
  const routeTitle = document.createElement('strong');
  routeTitle.textContent = `${route.buyVenue.name} → ${route.sellVenue.name}`;
  const routeValue = document.createElement('span');
  routeValue.textContent = `${currency.format(route.netProfitTry)} · %${number.format(route.netProfitPct)}`;
  const routeReason = document.createElement('small');
  routeReason.textContent = route.reason;
  const simulationBadge = makeBadge(route.simulationOnly ? 'MOCK ROTA' : 'CANLI ROTA', route.simulationOnly ? 'mock' : 'live');
  elements.opportunity.replaceChildren(simulationBadge, routeTitle, routeValue, routeReason);

  const rows = data.venues.map((venue) => {
    const row = document.createElement('tr');
    const marketCell = document.createElement('td');
    const marketName = document.createElement('strong'); marketName.textContent = venue.name;
    const marketDetail = document.createElement('small'); marketDetail.textContent = venue.network || venue.pair;
    marketCell.append(marketName, marketDetail);
    const values = [
      marketCell,
      textCell(venue.type),
      badgeCell(venue.mode),
      textCell(currency.format(venue.rawPriceTry)),
      textCell(currency.format(venue.effectiveBuyTry)),
      textCell(currency.format(venue.effectiveSellTry)),
      textCell(`ücret %${number.format(venue.feePct)} · kayma %${number.format(venue.slippagePct)}${venue.gasTry ? ` · ağ ${currency.format(venue.gasTry)}` : ''}`)
    ];
    row.append(...values);
    return row;
  });
  elements['venue-rows'].replaceChildren(...rows);

  const providers = data.providers.map((provider) => {
    const item = document.createElement('div');
    const name = document.createElement('strong'); name.textContent = provider.name;
    const purpose = document.createElement('small'); purpose.textContent = provider.purpose;
    item.append(makeBadge(modeLabel(provider.mode), badgeClass(provider.mode)), name, purpose);
    return item;
  });
  elements['provider-list'].replaceChildren(...providers);
}

function textCell(value) { const cell = document.createElement('td'); cell.textContent = value; return cell; }
function badgeCell(mode) { const cell = document.createElement('td'); cell.append(makeBadge(modeLabel(mode), badgeClass(mode))); return cell; }
function makeBadge(label, className) { const badge = document.createElement('span'); badge.className = `badge ${className}`; badge.textContent = label; return badge; }
function modeLabel(mode) { return mode === 'LIVE' ? 'CANLI' : mode === 'MOCK' ? 'MOCK' : 'YAPILANDIRMA GEREKLİ'; }
function badgeClass(mode) { return mode === 'LIVE' ? 'live' : mode === 'MOCK' ? 'mock' : 'config'; }

function readPolicy() {
  const policy = { budgetTry: Number(elements.budget.value), maxPremiumPct: Number(elements.premium.value) };
  if (!Number.isFinite(policy.budgetTry) || policy.budgetTry <= 0 || policy.budgetTry > 1000) throw new Error('Bütçe 1–1.000 TL arasında olmalı.');
  if (!Number.isFinite(policy.maxPremiumPct) || policy.maxPremiumPct < 0 || policy.maxPremiumPct > 20) throw new Error('Fark limiti %0–20 arasında olmalı.');
  return policy;
}

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'İstek başarısız.');
  return data;
}
async function withLoading(action) {
  document.querySelectorAll('button').forEach((button) => { button.disabled = true; });
  try { await action(); } catch (error) { showMessage(error.message, 'error'); }
  finally { document.querySelectorAll('button').forEach((button) => { button.disabled = false; }); }
}
function showMessage(text, type, child) {
  elements.message.className = `message ${type}`; elements.message.textContent = text; if (child) elements.message.append(child);
}
function clearMessage() { elements.message.className = 'message hidden'; elements.message.textContent = ''; }
