# Pinaki Online - Kart Oyunu

Online Pinaki kart oyunu uygulaması. Frontend ve backend tek uygulama halinde birleştirilmiştir.

## Özellikler

- 🎮 4 oyunculu online kart oyunu
- 🔄 Gerçek zamanlı oyun senkronizasyonu
- 👥 Oyuncu ve seyirci modu
- 🎯 İhale sistemi
- 🃏 Otomatik kart dağıtımı
- 📱 Responsive tasarım

## Kurulum

### Gereksinimler

- Node.js 14.0.0 veya üzeri
- npm veya yarn

### Kurulum Adımları

1. Projeyi klonlayın:
```bash
git clone <repository-url>
cd OnlinePinaki
```

2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. Uygulamayı başlatın:
```bash
# Development modu
npm run dev

# Production modu
npm start
```

4. Tarayıcıda açın:
```
http://localhost:3000
```

## Kullanım

1. **Odaya Katılma**: Oda ID ve oyuncu adı girerek oyuna katılın
2. **Misafir Modu**: Seyirci olarak oyunu izleyebilirsiniz
3. **Oyun Başlatma**: 4 oyuncu toplandığında oyunu başlatabilirsiniz
4. **Kart Dağıtma**: Oyun başladıktan sonra kartları dağıtın
5. **İhale**: Kart dağıtıldıktan sonra ihale süreci başlar

## API Endpoints

- `GET /api/health` - Sunucu durumu
- `GET /api/rooms` - Aktif odalar listesi

## Deployment

### Render.com

1. Render.com'da yeni Web Service oluşturun
2. GitHub repository'nizi bağlayın
3. Build Command: `npm run build`
4. Start Command: `npm start`
5. Environment Variables:
   - `PORT`: 3000 (otomatik)

### Heroku

1. Heroku CLI ile deploy edin:
```bash
heroku create your-app-name
git push heroku main
```

## Teknik Detaylar

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express.js
- **Real-time**: Socket.io
- **Build**: Custom build script
- **Port**: 3000 (configurable via PORT env var)

## Geliştirme

### Scripts

- `npm run dev` - Development modu (nodemon ile)
- `npm run build` - Production build
- `npm start` - Production modu

### Dosya Yapısı

```
OnlinePinaki/
├── public/          # Frontend dosyaları
│   ├── online.html  # Ana sayfa
│   ├── online.js    # Ana JavaScript
│   ├── script.js    # Oyun mantığı
│   └── style.css    # Stiller
├── build/           # Build edilmiş dosyalar
├── scripts/         # Build scriptleri
├── server.js        # Backend server
└── package.json     # Proje konfigürasyonu
```

## Lisans

MIT License
