const OKX_TICKER_URL = 'https://www.okx.com/api/v5/market/ticker?instId=';

/** Demo için sabit veri; arayüzde açıkça "örnek" olarak işaretlenir. */
export function getDemoPrices(now = Date.now()) {
  const timestamp = new Date(now).toISOString();
  return {
    globalBtcUsdt: { value: 100000, timestamp, source: 'Örnek veri' },
    usdtTry: { value: 40, timestamp, source: 'Örnek veri' },
    trBtcTryAsk: { value: 4080000, timestamp, source: 'Örnek veri' }
  };
}

/**
 * Açık piyasa uç noktası prototip içindir. Üretimde bu fonksiyon yerine
 * createAtkMarketProvider(atkClient) kullanılmalı; anahtarlar tarayıcıya konmaz.
 */
export async function fetchPublicOkxPrices(fetcher = fetch) {
  const [global, trBtc, usdtTry] = await Promise.all([
    fetchTicker('BTC-USDT', fetcher), fetchTicker('BTC-TRY', fetcher), fetchTicker('USDT-TRY', fetcher)
  ]);
  return {
    globalBtcUsdt: normalizeTicker(global, 'OKX açık piyasa verisi'),
    trBtcTryAsk: normalizeTicker(trBtc, 'OKX TR / OKX piyasa verisi'),
    usdtTry: normalizeTicker(usdtTry, 'OKX TR / OKX piyasa verisi')
  };
}

export function createAtkMarketProvider(atkClient) {
  if (!atkClient?.getTicker) throw new Error('ATK istemcisi getTicker sağlamalıdır.');
  return async () => {
    const [global, trBtc, usdtTry] = await Promise.all([
      atkClient.getTicker('BTC-USDT'), atkClient.getTicker('BTC-TRY'), atkClient.getTicker('USDT-TRY')
    ]);
    return {
      globalBtcUsdt: normalizeTicker(global, 'OKX ATK'),
      trBtcTryAsk: normalizeTicker(trBtc, 'OKX ATK'),
      usdtTry: normalizeTicker(usdtTry, 'OKX ATK')
    };
  };
}

async function fetchTicker(instId, fetcher) {
  const response = await fetcher(`${OKX_TICKER_URL}${encodeURIComponent(instId)}`);
  if (!response.ok) throw new Error(`${instId} fiyatı alınamadı (${response.status}).`);
  const body = await response.json();
  if (body.code !== '0' || !body.data?.[0]) throw new Error(`${instId} için geçerli fiyat bulunamadı.`);
  return body.data[0];
}

function normalizeTicker(ticker, source) {
  const value = Number(ticker.askPx || ticker.last);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Geçersiz ticker fiyatı.');
  return { value, timestamp: new Date(Number(ticker.ts)).toISOString(), source };
}
