const CATALOG = Object.freeze([
  { id: 'okx-tr', name: 'OKX TR', type: 'CEX', mode: 'LIVE', offsetBps: 0, feeBps: 10, slippageBps: 4, gasTry: 0 },
  { id: 'okx-global', name: 'OKX Global', type: 'CEX', mode: 'LIVE', offsetBps: 0, feeBps: 10, slippageBps: 4, gasTry: 0 },
  { id: 'binance', name: 'Binance', type: 'CEX', mode: 'MOCK', offsetBps: -24, feeBps: 10, slippageBps: 5, gasTry: 0 },
  { id: 'coinbase', name: 'Coinbase', type: 'CEX', mode: 'MOCK', offsetBps: 18, feeBps: 40, slippageBps: 7, gasTry: 0 },
  { id: 'kraken', name: 'Kraken', type: 'CEX', mode: 'MOCK', offsetBps: -11, feeBps: 26, slippageBps: 6, gasTry: 0 },
  { id: 'bybit', name: 'Bybit', type: 'CEX', mode: 'MOCK', offsetBps: 9, feeBps: 10, slippageBps: 5, gasTry: 0 },
  { id: 'kucoin', name: 'KuCoin', type: 'CEX', mode: 'MOCK', offsetBps: -7, feeBps: 10, slippageBps: 7, gasTry: 0 },
  { id: 'gate', name: 'Gate.io', type: 'CEX', mode: 'MOCK', offsetBps: 13, feeBps: 10, slippageBps: 8, gasTry: 0 },
  { id: 'mexc', name: 'MEXC', type: 'CEX', mode: 'MOCK', offsetBps: -16, feeBps: 10, slippageBps: 9, gasTry: 0 },
  { id: 'uniswap', name: 'Uniswap', type: 'DEX', mode: 'MOCK', network: 'Ethereum', offsetBps: 31, feeBps: 30, slippageBps: 15, gasTry: 155 },
  { id: 'pancakeswap', name: 'PancakeSwap', type: 'DEX', mode: 'MOCK', network: 'BNB Chain', offsetBps: -28, feeBps: 25, slippageBps: 16, gasTry: 8 },
  { id: 'curve', name: 'Curve', type: 'DEX', mode: 'MOCK', network: 'Ethereum', offsetBps: 6, feeBps: 4, slippageBps: 8, gasTry: 125 },
  { id: 'trader-joe', name: 'Trader Joe', type: 'DEX', mode: 'MOCK', network: 'Avalanche', offsetBps: -37, feeBps: 30, slippageBps: 14, gasTry: 3 },
  { id: 'pangolin', name: 'Pangolin', type: 'DEX', mode: 'MOCK', network: 'Avalanche', offsetBps: 22, feeBps: 30, slippageBps: 17, gasTry: 3 },
  { id: 'sushiswap', name: 'SushiSwap', type: 'DEX', mode: 'MOCK', network: 'Arbitrum', offsetBps: -4, feeBps: 30, slippageBps: 18, gasTry: 7 },
  { id: 'balancer', name: 'Balancer', type: 'DEX', mode: 'MOCK', network: 'Ethereum', offsetBps: 27, feeBps: 30, slippageBps: 13, gasTry: 140 }
]);

const PROVIDERS = Object.freeze([
  { name: 'OKX Agent Trade Kit', mode: 'LIVE', purpose: 'OKX TR ve Global fiyatları' },
  { name: 'CoinGecko', mode: 'CONFIG_REQUIRED', purpose: 'Geniş piyasa ve on-chain referansı' },
  { name: 'CoinMarketCap', mode: 'CONFIG_REQUIRED', purpose: 'Piyasa çiftleri ve hacim doğrulaması' },
  { name: 'Alchemy Prices', mode: 'CONFIG_REQUIRED', purpose: 'Token adresi ve DEX fiyat doğrulaması' }
]);

export class VenueService {
  constructor({ marketService, now = Date.now }) {
    this.marketService = marketService;
    this.now = now;
  }

  async scan({ budgetTry = 1000, maxPremiumPct = 0.8 } = {}) {
    const safeBudget = validateBudget(budgetTry);
    const market = await this.marketService.check({ budgetTry: safeBudget, maxPremiumPct });
    if (market.status !== 'OK') throw new Error(market.reason);

    const referenceTry = market.calculatedTry;
    const quantityBtc = safeBudget / referenceTry;
    const timestamp = new Date(this.now()).toISOString();
    const venues = CATALOG.map((venue) => buildQuote({ venue, market, referenceTry, quantityBtc, timestamp }));
    const bestBuy = [...venues].sort((a, b) => a.effectiveBuyTry - b.effectiveBuyTry)[0];
    const bestSell = [...venues].sort((a, b) => b.effectiveSellTry - a.effectiveSellTry)[0];
    const buyTotalTry = bestBuy.effectiveBuyTry * quantityBtc;
    const sellTotalTry = bestSell.effectiveSellTry * quantityBtc;
    const netProfitTry = sellTotalTry - buyTotalTry;
    const includesMock = bestBuy.mode === 'MOCK' || bestSell.mode === 'MOCK';

    return {
      status: 'OK',
      checkedAt: timestamp,
      budgetTry: safeBudget,
      referenceTry,
      quantityBtc,
      coverage: {
        total: venues.length,
        live: venues.filter((item) => item.mode === 'LIVE').length,
        mock: venues.filter((item) => item.mode === 'MOCK').length,
        note: 'Temsilî geniş CEX/DEX kataloğu; yalnızca LIVE etiketli kaynaklar gerçek zamanlıdır.'
      },
      providers: PROVIDERS,
      venues,
      opportunity: {
        buyVenue: pickSummary(bestBuy),
        sellVenue: pickSummary(bestSell),
        netProfitTry,
        netProfitPct: (netProfitTry / buyTotalTry) * 100,
        profitable: netProfitTry > 0,
        simulationOnly: includesMock,
        executable: false,
        reason: includesMock
          ? 'En iyi rotanın en az bir ayağı MOCK; bu yalnızca simülasyondur ve emir üretmez.'
          : 'Canlı rota bulundu ancak bakiye, envanter ve transfer kontrolleri yapılandırılmadığı için emir kapalıdır.'
      }
    };
  }
}

export function buildQuote({ venue, market, referenceTry, quantityBtc, timestamp }) {
  const rawPriceTry = venue.id === 'okx-tr'
    ? market.prices.trBtcTryAsk.value
    : venue.id === 'okx-global'
      ? referenceTry
      : referenceTry * (1 + venue.offsetBps / 10_000);
  const tradingCostRate = (venue.feeBps + venue.slippageBps) / 10_000;
  const gasPerBtc = venue.gasTry / quantityBtc;
  return {
    id: venue.id,
    name: venue.name,
    type: venue.type,
    mode: venue.mode,
    network: venue.network || null,
    pair: venue.id === 'okx-tr' ? 'BTC/TRY' : 'BTC/USDT → TRY',
    rawPriceTry,
    effectiveBuyTry: rawPriceTry * (1 + tradingCostRate) + gasPerBtc,
    effectiveSellTry: rawPriceTry * (1 - tradingCostRate) - gasPerBtc,
    feePct: venue.feeBps / 100,
    slippagePct: venue.slippageBps / 100,
    gasTry: venue.gasTry,
    timestamp,
    source: venue.mode === 'LIVE' ? 'OKX Agent Trade Kit' : 'Canlı OKX referansından deterministik mock'
  };
}

function validateBudget(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100_000) throw new Error('Tarama bütçesi 1–100.000 TL arasında olmalı.');
  return parsed;
}

function pickSummary(venue) {
  return { id: venue.id, name: venue.name, type: venue.type, mode: venue.mode, network: venue.network };
}

export { CATALOG, PROVIDERS };
