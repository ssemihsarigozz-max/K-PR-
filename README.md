# Köprü

Köprü, BTC fiyatını CEX ve DEX kaynaklarında ortak bir TL tabanına getirip ücret, kayma ve ağ maliyeti sonrasında karşılaştıran agentic arbitraj gözlemcisidir.

> Güvenlik sınırı: Bu sürüm gerçek arbitraj emri göndermez. OKX spot emir modülü iki aşamalı onayla hazırlanmıştır fakat varsayılan olarak kapalıdır. MOCK etiketli hiçbir sonuç çalıştırılabilir değildir.

## Bugün gerçekten çalışanlar

- OKX Agent Trade Kit üzerinden **OKX Global BTC-USDT**, **OKX TR BTC-TRY** ve **OKX TR USDT-TRY** canlı fiyatları.
- Fiyat tazeliği, bütçe ve kullanıcı fark limiti kontrolleri.
- OKX TR için AL / BEKLE kararı ve iki aşamalı emir önizlemesi.
- Temsilî 16 piyasalık CEX/DEX taraması: 2 canlı, 14 deterministik MOCK.
- Ücret, kayma ve DEX ağ maliyetini içeren efektif alış/satış hesabı.
- Mock ayak içeren rotalarda zorunlu `executable: false` güvenlik kuralı.
- Avalanche Fuji karar kaydı kontratı, derleme ve dağıtım betikleri.
- 16 otomatik test ve Solidity derleme kontrolü.

## Veri durumu

| Kaynak | Durum | Açıklama |
|---|---|---|
| OKX TR | CANLI | Agent Trade Kit ticker verisi |
| OKX Global | CANLI | Agent Trade Kit ticker verisi |
| Binance, Coinbase, Kraken, Bybit, KuCoin, Gate.io, MEXC | MOCK | Canlı OKX referansına sabit sapmayla üretilir |
| Uniswap, PancakeSwap, Curve, Trader Joe, Pangolin, SushiSwap, Balancer | MOCK | Ücret, kayma ve örnek ağ maliyeti içeren simülasyon |
| CoinGecko | YAPILANDIRMA GEREKLİ | Geniş piyasa / on-chain doğrulama için planlandı |
| CoinMarketCap | YAPILANDIRMA GEREKLİ | Piyasa çifti ve hacim doğrulama için planlandı |
| Alchemy Prices | YAPILANDIRMA GEREKLİ | Token adresi ve DEX fiyat doğrulama için planlandı |

“Tüm borsalar” ifadesi bu sürümde, mimariyi göstermek için seçilmiş geniş ve temsilî katalog anlamındadır; internetteki her borsa için canlı entegrasyon anlamına gelmez.

## Başlatma

Node.js 20 veya üzeri gerekir.

```bash
npm install
cp .env.example .env.local
npm run check
npm start
```

Ardından `http://127.0.0.1:4173` adresini açın.

## Görsel portal prototipi

Tek dosyalık, canvas tabanlı **Liquidity Jumping** deneyimi `/portal` adresinde açılır. Sinematik video ve portal animasyonları; OKX TR → Binance → Avalanche DEX anlatısına bağlanır. Ekrandaki canlı/mock kapsamı mevcut fırsat API’sinden okunur; mock rotalar yalnızca simülasyondur ve emir üretmez.

## Önemli API uçları

- `GET /api/health`: servis, emir kilidi ve Fuji durumu
- `GET /api/market?budgetTry=1000&maxPremiumPct=0.8`: canlı OKX kararı
- `GET /api/opportunities?budgetTry=1000&maxPremiumPct=0.8`: canlı + mock ekosistem taraması
- `POST /api/orders/preview`: güncel kararla güvenli emir önizlemesi
- `POST /api/orders/confirm`: yalnızca kilit açık ve açık kullanıcı onayı varsa emir
- `POST /api/ledger/record`: karar özetini yapılandırılmış Fuji kontratına yazma

## Proje yapısı

- `server/okx-atk.js`: OKX Agent Trade Kit adaptörü
- `server/market-service.js`: canlı OKX fiyatlarının normalize edilmesi
- `server/venue-service.js`: çoklu CEX/DEX maliyet modeli ve fırsat taraması
- `server/order-service.js`: iki aşamalı güvenli emir akışı
- `server/avalanche-service.js`: Fuji karar kaydı
- `src/decision.js`: deterministik AL / BEKLE karar motoru
- `contracts/DecisionLedger.sol`: zincir üstü karar özeti
- `KOPRU_PROJE_PLANI.md`: kapsam, mimari ve yol haritası
- `DEVIR_NOTU.md`: projeyi devralan geliştirici için ilk okuma belgesi

## Güvenlik

- API anahtarları tarayıcıya verilmez ve repoya yazılmaz.
- `.env.local` Git tarafından yok sayılır.
- `ENABLE_OKX_ORDERS=false` varsayılandır.
- Gerçek emir için hem sunucu kilidi hem kısa ömürlü önizleme hem de `ONAYLIYORUM` ifadesi gerekir.
- Çoklu piyasa tarayıcısı şu aşamada gözlem/simülasyon içindir.
