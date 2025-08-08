const fs = require('fs');
const path = require('path');

// Build klasörünü temizle ve oluştur
const buildDir = path.join(__dirname, '..', 'build');

// Build klasörü yoksa oluştur
if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
}

// Public klasöründeki dosyaları kopyala
const publicDir = path.join(__dirname, '..', 'public');

function copyDirectory(source, destination) {
    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
    }

    const files = fs.readdirSync(source);
    
    files.forEach(file => {
        const sourcePath = path.join(source, file);
        const destPath = path.join(destination, file);
        
        const stat = fs.statSync(sourcePath);
        
        if (stat.isDirectory()) {
            copyDirectory(sourcePath, destPath);
        } else {
            fs.copyFileSync(sourcePath, destPath);
            console.log(`Kopyalandı: ${file}`);
        }
    });
}

try {
    copyDirectory(publicDir, buildDir);
    console.log('✅ Build tamamlandı! Dosyalar build/ klasörüne kopyalandı.');
} catch (error) {
    console.error('❌ Build hatası:', error);
    process.exit(1);
}
