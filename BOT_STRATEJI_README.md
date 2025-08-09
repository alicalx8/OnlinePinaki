# 🤖 Pinaki Bot Strateji Geliştirmeleri

## Genel Bakış

Bot stratejisi önemli ölçüde geliştirildi ve artık daha akıllı ve taktiksel oyun oynayabiliyor. İşte eklenen yeni özellikler:

## 🆕 Yeni Özellikler

### 1. Partner Stratejisi
- Bot artık partner'inin (2 pozisyon sonraki oyuncu) kazandığı durumları takip ediyor
- Partner kazanıyorsa gereksiz yere yüksek kart atmıyor
- Partner kazanmıyorsa eli kazanmaya çalışıyor

### 2. Oyun Sonu Stratejisi
- Kalan kart sayısına göre agresif veya muhafazakar oyun
- 3 veya daha az kart kaldığında agresif oynama
- 8 veya daha fazla kart varken muhafazakar oynama
- Orta seviyede kart varken el değerine göre karar verme

### 3. Gelişmiş El Değerlendirmesi
- As ve 10'lar için %80 el kazanma ihtimali
- Koz kartları için %60 el kazanma ihtimali
- K ve Q için %40 el kazanma ihtimali
- Daha gerçekçi el tahminleri

### 4. Akıllı İlk Kart Seçimi
- El gücüne göre stratejik kart seçimi
- Güçlü ellerde en yüksek kart
- Zayıf ellerde en düşük kart
- Orta güçte koz renginde kart varsa onu oynama

### 5. Gelişmiş İhale Teklifi
- El değeri, koz sayısı ve yüksek kart sayısına göre teklif
- Tahmini el sayısına göre bonus puanlar
- 150-300 puan arası akıllı teklifler

### 6. Akıllı Koz Seçimi
- Kart sayısı + değer + yüksek kart bonusu
- En iyi rengi seçme algoritması
- Daha dengeli koz seçimi

## 🔧 Teknik Detaylar

### PinakiBot Sınıfı
```javascript
class PinakiBot {
    constructor(playerId) {
        this.playerId = playerId;
        this.name = `Bot ${playerId}`;
        this.gameHistory = []; // Oyun geçmişi
        this.partnerId = (playerId + 2) % 4; // Partner ID
    }
}
```

### Ana Strateji Fonksiyonları
- `playCard()` - Ana kart oynama stratejisi
- `selectLeadCard()` - İlk kart seçimi
- `playLeadSuit()` - Açılan rengi oynama
- `playNonLeadSuit()` - Açılan rengi olmayan durumda oynama
- `makeBid()` - İhale teklifi
- `selectTrump()` - Koz seçimi

### Yardımcı Fonksiyonlar
- `shouldPlayAggressively()` - Oyun sonu stratejisi
- `getCurrentWinner()` - Şu anki kazananı bulma
- `estimateTricksAdvanced()` - Gelişmiş el tahmini
- `calculateSuitScore()` - Renk skoru hesaplama

## 🧪 Test Etme

Bot stratejisini test etmek için `bot-test.html` dosyasını kullanabilirsiniz:

1. Dosyayı tarayıcıda açın
2. Her test senaryosunu ayrı ayrı test edin
3. Console'da bot davranışlarını izleyin

### Test Senaryoları
1. **Basit Kart Oynama** - Temel kart seçimi
2. **Koz Stratejisi** - Koz renginde oynama
3. **Partner Stratejisi** - Partner kazanıyorsa muhafazakar oynama
4. **İhale Teklifi** - Akıllı teklif hesaplama
5. **Koz Seçimi** - En iyi rengi seçme

## 📊 Strateji Mantığı

### Kart Oynama Öncelikleri
1. **Partner kazanıyorsa** → En düşük kart
2. **El kazanabilirse** → En yüksek kart
3. **Koz gerekirse** → En yüksek koz
4. **Hiçbir şey yapılamıyorsa** → En düşük kart

### İhale Teklifi Hesaplama
```
Baz teklif = 150
+ El değeri bonusu (30-50)
+ Koz sayısı bonusu (20-30)
+ Yüksek kart bonusu (20-30)
+ Tahmini el bonusu (el × 15)
```

### Koz Seçimi
```
Renk skoru = (kart sayısı × 15) + değer + (yüksek kart × 20)
```

## 🚀 Gelecek Geliştirmeler

### Planlanan Özellikler
- [ ] Kart sayma (hangi kartların oynandığını takip)
- [ ] Oyun geçmişi analizi
- [ ] Rakiplerin oyun tarzı öğrenme
- [ ] Adaptif strateji (oyun süresince öğrenme)
- [ ] Farklı zorluk seviyeleri

### Mevcut Sınırlamalar
- Basit partner takibi
- Temel kart sayma
- Sabit strateji parametreleri

## 💡 Kullanım Örnekleri

### Basit Kart Oynama
```javascript
const bot = new PinakiBot(1);
const hand = [
    { suit: '♥', rank: 'A' },
    { suit: '♥', rank: '10' },
    { suit: '♠', rank: 'K' }
];

const card = bot.playCard(hand, null, '♥', []);
console.log(`Seçilen kart: ${card.rank}${card.suit}`);
```

### İhale Teklifi
```javascript
const bid = bot.makeBid(150, hand, '♥');
if (bid) {
    console.log(`Teklif: ${bid} puan`);
} else {
    console.log('Pas geç');
}
```

## 🔍 Debug ve Logging

Bot davranışlarını izlemek için console logları eklenmiştir:
- Kart seçim kararları
- Strateji değişiklikleri
- Partner durumu
- Oyun sonu stratejisi

## 📝 Notlar

- Bot stratejisi offline ve online modda aynı şekilde çalışır
- Partner ID hesaplaması 4 oyunculu sistem için optimize edilmiştir
- Oyun geçmişi sadece tamamlanan elleri (4 kart) takip eder
- Strateji parametreleri deneyimle optimize edilebilir

---

**Son Güncelleme:** Bot stratejisi önemli ölçüde geliştirildi ve artık daha akıllı oyun oynayabiliyor. Test etmek için `bot-test.html` dosyasını kullanabilirsiniz.
