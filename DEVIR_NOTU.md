# Köprü — Geliştirici Devir Notu

## İlk 10 dakikada yapılacaklar

1. `README.md` ile `KOPRU_PROJE_PLANI.md` dosyalarını okuyun.
2. Node.js 20+ ortamında `npm install` çalıştırın.
3. `.env.example` dosyasını `.env.local` olarak kopyalayın; gizli değerleri repoya eklemeyin.
4. `npm run check` çalıştırın. Beklenen sonuç: 16 test geçer ve kontrat derlenir.
5. `npm start` çalıştırıp `http://127.0.0.1:4173` adresini açın.
6. Önce “CEX/DEX ekosistemini tara” düğmesini deneyin. Yalnız OKX satırlarının CANLI, diğerlerinin MOCK olduğuna dikkat edin.

## Projenin net durumu

**Çalışıyor:** Canlı OKX fiyatları, OKX TR karar motoru, mock çoklu-piyasa taraması, ücret/kayma/gaz hesabı, güvenli emir önizlemesi, kontrat derleme.

**Hazır ama kapalı:** Gerçek OKX TR spot emir. `ENABLE_OKX_ORDERS=false` bırakılmalıdır; gerçek para ile test yapmadan önce ayrı güvenlik incelemesi gerekir.

**Hazır ama dağıtılmadı:** Avalanche Fuji `DecisionLedger`. Cüzdan oluşturuldu ancak test AVAX ve başarılı Fuji RPC erişimi olmadan kontrat adresi yoktur.

**Henüz canlı değil:** Binance, Coinbase, Kraken, Bybit, KuCoin, Gate.io, MEXC ve tüm DEX satırları. CoinGecko, CoinMarketCap ve Alchemy de henüz bağlanmadı.

## Mimari kararlar

- Finansal matematik ve limitler deterministik koddadır; LLM’e bırakılmaz.
- `VenueService`, tüm piyasaları aynı sözleşmeye normalize eder.
- Mock üretimi sabittir; yeniden yüklemede rastgele “fırsat” oluşturmaz.
- Mock içeren fırsat API seviyesinde bile çalıştırılamaz.
- Bir kaynak hata verdiğinde sessizce mock’a dönüşmemelidir.
- CEX/DEX canlı adaptörleri önce yalnız-okunur geliştirilmelidir.

## İlk önerilen görev

CoinGecko’yu önce referans/doğrulama kaynağı olarak ekleyin; doğrudan emir kaynağı saymayın. Yeni `coingecko-provider.js` adaptörü ortak quote sözleşmesine veri vermeli, anahtar yoksa `CONFIG_REQUIRED`, hata varsa `ERROR`, başarı varsa `LIVE` göstermelidir. Sonra aynı test kalıbını CoinMarketCap ve Alchemy için uygulayın.

## Güvenlik uyarıları

- `.env.local` ve özel anahtarları asla commit etmeyin.
- Gerçek emir kilidini yalnızca kullanıcının eylem anındaki açık onayıyla açın.
- API anahtarlarını tarayıcı koduna koymayın.
- Mock veriyi canlı etiketlemeyin.
- Bir “fiyat farkını” kâr garantisi olarak sunmayın.
- Canlı yürütmeden önce order-book derinliği, bakiye, envanter, çekim/yatırma durumu ve ağ kesinliğini kontrol edin.

## Teslim kontrol listesi

- [ ] `npm run check` yeşil
- [ ] `/api/health` yanıt veriyor
- [ ] `/api/market` gerçek OKX verisi döndürüyor
- [ ] `/api/opportunities` 2 CANLI + 14 MOCK gösteriyor
- [ ] Arayüzde etiketler mobil ve masaüstünde okunuyor
- [ ] `.env.local` Git durumunda görünmüyor
- [ ] Gerçek emir varsayılan kapalı
- [ ] Değişiklikler anlamlı commit mesajıyla GitHub’a gönderildi
