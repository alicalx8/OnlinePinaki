const fs = require('fs');
const path = require('path');

// Build klasöründeki dosyaları minify et
const buildDir = path.join(__dirname, '..', 'build');

function minifyFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Sadece gereksiz boşlukları kaldır, syntax'i bozma
        let minified = content
            // Çoklu boşlukları tek boşluk yap (satır sonlarını koru)
            .replace(/[ \t]+/g, ' ')
            // Satır sonlarındaki boşlukları kaldır
            .replace(/[ \t]+$/gm, '')
            // Boş satırları tek satır yap
            .replace(/\n\s*\n/g, '\n')
            .trim();
        
        fs.writeFileSync(filePath, minified);
        console.log(`Minify edildi: ${path.basename(filePath)}`);
    } catch (error) {
        console.log(`Minify atlandı: ${path.basename(filePath)} - ${error.message}`);
    }
}

function processDirectory(directory) {
    const files = fs.readdirSync(directory);
    
    files.forEach(file => {
        const filePath = path.join(directory, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            processDirectory(filePath);
        } else if (file.endsWith('.js') || file.endsWith('.css')) {
            minifyFile(filePath);
        }
    });
}

try {
    if (fs.existsSync(buildDir)) {
        processDirectory(buildDir);
        console.log('✅ Minification tamamlandı!');
    } else {
        console.log('⚠️ Build klasörü bulunamadı, minification atlandı.');
    }
} catch (error) {
    console.error('❌ Minification hatası:', error);
}
