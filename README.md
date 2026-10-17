# Köprü

OKX TR'de TL ile BTC alan kullanıcı için, global BTC-USDT fiyatını USDT-TRY ile TL'ye çevirir; OKX TR BTC alış fiyatıyla kıyaslayıp kullanıcının limiti içinde **AL** veya **BEKLE** işlem planı üretir.

Bu MVP kâr garantisi veya otomatik arbitraj sunmaz. Emir göndermez.

## Başlatma

Node.js 20+ kurulu bir ortamda:

```bash
npm test
npm start
```

Sonra terminalin gösterdiği yerel adresi açın. Bağımlılık yoktur; `npx serve` yalnızca statik dosyaları sunar.

## Mevcut kapsam

- BTC-USDT, BTC-TRY, USDT-TRY ile deterministik fark hesabı
- Veri tazeliği kontrolü (90 saniye); sorun varsa **VERİ HATASI** ve işlem yok
- Bütçe ve kabul edilen fark ile AL / BEKLE işlem planı
- Örnek veri ve ayrı açık piyasa verisi denemesi
- Fuji için yalnızca karar özeti yayınlayan Solidity kontratı taslağı

## Entegrasyon sınırları

`src/market-data.js` içindeki `createAtkMarketProvider`, ATK istemcisinin ekleneceği adaptördür. ATK doğrulaması ve yetkilendirilmiş spot emir, sunucu tarafında uygulanmalıdır; API anahtarları asla tarayıcıda tutulmaz. Açık piyasa çağrısı yalnızca hackathon prototipindeki veri akışını göstermek içindir.

Fuji kontratı henüz dağıtılmadı. Dağıtımın ardından kontrat adresi, işlem kimliği ve explorer bağlantısı karar ekranına eklenecek.
