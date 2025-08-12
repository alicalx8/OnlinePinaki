// Online oyun yönetimi
let socket = null;
let currentRoom = null;
let onlineCurrentPlayer = null;
let players = [];
let isOnlineMode = false;
let isSpectator = false;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectInterval = null;

// WebSocket bağlantısı
function connectToServer() {
    console.log('WebSocket bağlantısı kuruluyor...');
    
    // Önceki bağlantıyı temizle
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    
    try {
        // Production ortamında relative URL kullan, development'ta localhost
        const socketUrl = window.location.hostname === 'localhost' ? `http://localhost:${window.location.port || 3000}` : window.location.origin;
        socket = io(socketUrl, {
            reconnection: true,
            reconnectionAttempts: maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000
        });
        console.log('Socket.io bağlantısı başlatıldı:', socketUrl);
    } catch (error) {
        console.error('Socket.io bağlantı hatası:', error);
        handleConnectionError(error);
        return;
    }
    
    socket.on('connect', () => {
        console.log('✅ Sunucuya bağlandı');
        reconnectAttempts = 0;
        
        // Butonları etkinleştir
        const joinBtn = document.getElementById('join-btn');
        const spectatorBtn = document.getElementById('spectator-btn');
        
        if (joinBtn) {
            joinBtn.disabled = false;
            console.log('Join butonu etkinleştirildi');
        } else {
            console.error('Join butonu bulunamadı!');
        }
        
        if (spectatorBtn) {
            spectatorBtn.disabled = false;
            console.log('Spectator butonu etkinleştirildi');
        } else {
            console.error('Spectator butonu bulunamadı!');
        }
        
        // Global değişkenleri ayarla
        window.socket = socket;
        window.isOnlineMode = true;
        
        // Bağlantı başarılı olduğunda hata mesajlarını temizle
        clearConnectionErrors();
        
        // Bağlantı monitoring ve ping/pong mekanizmalarını başlat
        startConnectionMonitoring();
        startPingPong();
        
        // Debug bilgisi
        console.log('Socket bağlantısı başarılı - Socket ID:', socket.id);
        console.log('Socket connected:', socket.connected);
    });
    
    socket.on('disconnect', (reason) => {
        console.log('❌ Sunucu bağlantısı kesildi:', reason);
        const joinBtn = document.getElementById('join-btn');
        const spectatorBtn = document.getElementById('spectator-btn');
        if (joinBtn) joinBtn.disabled = true;
        if (spectatorBtn) spectatorBtn.disabled = true;
        
        if (reason === 'io server disconnect') {
            // Sunucu tarafından bağlantı kesildi
            console.log('Sunucu tarafından bağlantı kesildi');
        } else if (reason === 'io client disconnect') {
            // İstemci tarafından bağlantı kesildi
            console.log('İstemci tarafından bağlantı kesildi');
        } else {
            // Bağlantı hatası
            console.log('Bağlantı hatası nedeniyle kesildi');
            handleConnectionError(new Error('Bağlantı kesildi: ' + reason));
        }
    });
    
    socket.on('connect_error', (error) => {
        console.error('❌ Bağlantı hatası:', error);
        handleConnectionError(error);
    });
    
    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`Yeniden bağlanma denemesi ${attemptNumber}/${maxReconnectAttempts}`);
        reconnectAttempts = attemptNumber;
    });
    
    socket.on('reconnect_failed', () => {
        console.error('Yeniden bağlanma başarısız oldu');
        alert('Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin ve sayfayı yenileyin.');
    });
    
    socket.on('roomFull', (data) => {
        alert('Oda dolu! Başka bir oda deneyin.');
    });
    
    socket.on('error', (data) => {
        console.error('Sunucu hatası:', data);
        const errorMessage = data && data.message ? data.message : 'Bilinmeyen hata';
        alert('Hata: ' + errorMessage);
        // Hata durumunda join section'ı tekrar göster
        const lobbySection = document.getElementById('lobby-section');
        const gameSection = document.getElementById('game-section');
        const joinSection = document.getElementById('join-section');
        
        if (lobbySection) lobbySection.style.display = 'none';
        if (gameSection) gameSection.style.display = 'none';
        if (joinSection) joinSection.style.display = 'block';
    });
    
    socket.on('spectatorInfo', (data) => {
        console.log('Seyirci bilgisi alındı:', data);
        // Bu event diğer oyuncular tarafından alınır, sadece log yaz
        if (data && data.spectatorName) {
            console.log(`${data.spectatorName} seyirci olarak katıldı`);
        }
    });
    
    // Hata yönetimi fonksiyonları
    function handleConnectionError(error) {
        console.error('Bağlantı hatası işleniyor:', error);
        
        // Hata mesajını göster
        const errorMessage = error && error.message ? error.message : 'Bilinmeyen hata';
        showConnectionError(`Bağlantı hatası: ${errorMessage}`);
        
        // Yeniden bağlanma denemesi
        if (reconnectAttempts < maxReconnectAttempts) {
            console.log(`${maxReconnectAttempts - reconnectAttempts} yeniden bağlanma denemesi kaldı`);
        } else {
            console.error('Maksimum yeniden bağlanma denemesi aşıldı');
            showConnectionError('Sunucuya bağlanılamadı. Lütfen sayfayı yenileyin.');
        }
    }
    
    function showConnectionError(message) {
        // Hata mesajını göstermek için bir div oluştur veya mevcut olanı güncelle
        let errorDiv = document.getElementById('connection-error');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'connection-error';
            errorDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #ff4444;
                color: white;
                padding: 15px;
                border-radius: 5px;
                z-index: 1000;
                max-width: 300px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            `;
            document.body.appendChild(errorDiv);
        }
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        // 5 saniye sonra hata mesajını gizle
        setTimeout(() => {
            if (errorDiv) {
                errorDiv.style.display = 'none';
            }
        }, 5000);
    }
    
    function clearConnectionErrors() {
        const errorDiv = document.getElementById('connection-error');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }
    
    // Bağlantı durumu kontrolü
    function startConnectionMonitoring() {
        if (socket) {
            // Her 30 saniyede bir bağlantı durumunu kontrol et
            setInterval(() => {
                if (socket && !socket.connected) {
                    console.log('Bağlantı kesildi, yeniden bağlanmaya çalışılıyor...');
                    handleConnectionError(new Error('Bağlantı kesildi'));
                }
            }, 30000);
        }
    }
    
    // Ping/Pong mekanizması
    function startPingPong() {
        if (socket) {
            setInterval(() => {
                if (socket && socket.connected) {
                    socket.emit('ping');
                }
            }, 25000);
        }
    }
    
    socket.on('spectatorJoined', (data) => {
        console.log('Seyirci katıldı:', data);
        
        // Bu event sadece misafir oyuncu tarafından alınır
        if (data && data.message) {
            alert(data.message);
        }
        
        // Global değişkenleri ayarla
        window.isSpectator = true;
        window.isOnlineMode = true;
        window.players = data.players || players;
        
        // Seyirci için özel arayüz göster
        const joinSection = document.getElementById('join-section');
        const lobbySection = document.getElementById('lobby-section');
        const gameSection = document.getElementById('game-section');
        
        if (joinSection) joinSection.style.display = 'none';
        if (lobbySection) lobbySection.style.display = 'none';
        if (gameSection) gameSection.style.display = 'block';
        
        // Dağıt butonunu zorla görünür hale getir
        const dealBtn = document.getElementById('dealBtn');
        if (dealBtn) {
            dealBtn.style.display = 'block';
            dealBtn.style.visibility = 'visible';
        }
        
        // Seyirci modunda sadece oyun kontrollerini gizle, izleme elementlerini göster
        const leftPanel = document.getElementById('left-panel');
        const rightPanel = document.getElementById('right-panel');
        const potaChat = document.getElementById('pota-chat');
        const botControls = document.getElementById('bot-controls');
        
        // Sadece oyun kontrollerini gizle
        if (botControls) botControls.style.display = 'none';
        if (dealBtn) dealBtn.style.display = 'none';
        
        // İhale kontrollerini seyirci için sadece görüntüleme modunda göster
        const auctionControls = document.getElementById('auction-controls');
        if (auctionControls) {
            auctionControls.style.display = 'none'; // Teklif verme kontrollerini gizle
        }
        
        // Puanlar tablosunu göster
        const scoreTable = document.getElementById('score-table');
        if (scoreTable) {
            scoreTable.style.display = 'block';
        }
        
        // Sohbet kutusunu seyirci için sadece okuma modunda göster
        if (potaChat) {
            const chatInput = document.getElementById('pota-chat-input');
            const chatSend = document.getElementById('pota-chat-send');
            
            if (chatInput) {
                chatInput.disabled = true;
                chatInput.placeholder = 'Misafir modu - sadece izleme';
            }
            
            if (chatSend) {
                chatSend.disabled = true;
                chatSend.textContent = 'Misafir';
            }
        }
        
        // Oyuncu isimlerini güncelle
        updatePlayerNames();
        
        // Seyirci modunda puanları hesapla ve göster
        if (window.calculateAndShowScores) {
            window.calculateAndShowScores();
        }
        
        // Eğer oyun zaten başlamışsa, oyun durumunu senkronize et
        if (data.hasGameStarted && data.gameState) {
            console.log('Oyun zaten başlamış, durum senkronize ediliyor:', data.gameState);
            
            // Global değişkenleri ayarla
            if (data.gameState.players) {
                window.playersGlobal = data.gameState.players.map(p => p.cards || []);
            }
            if (data.currentPlayer !== undefined) {
                window.currentPlayer = data.currentPlayer;
            }
            if (data.trumpSuit) {
                window.trumpSuit = data.trumpSuit;
            }
            if (data.playedCards) {
                window.playedCards = data.playedCards;
            }
            
            // Oyuncu kartlarını render et
            if (window.renderPlayers && window.playersGlobal) {
                console.log('Seyirci için oyuncu kartları render ediliyor:', window.playersGlobal);
                window.renderPlayers(window.playersGlobal);
            }
            
            // Arayüzü güncelle - global değişkenleri set et, renderPlayersWithClick otomatik olarak çağrılacak
            if (data.auctionActive !== undefined) {
                window.auctionActive = data.auctionActive;
            }
            if (data.auctionCurrent !== undefined) {
                window.auctionCurrent = data.auctionCurrent;
            }
            if (data.currentPlayer !== undefined) {
                window.currentPlayer = data.currentPlayer;
            }
            
            console.log('Seyirci modu: Global değişkenler set edildi, renderPlayersWithClick otomatik olarak çağrılacak');
            
            // Oynanan kartları göster
            if (data.playedCards && data.playedCards.length > 0) {
                console.log('Oynanan kartlar gösteriliyor:', data.playedCards);
                window.playedCards = data.playedCards;
                if (window.renderCenterCards) {
                    window.renderCenterCards();
                }
            }
            
            // İhale durumunu güncelle
            if (data.auctionActive !== undefined) {
                if (data.auctionActive) {
                    console.log('İhale aktif, durum güncelleniyor');
                    
                    // Seyirci modunda ihale durumunu göster
                    const auctionStatus = document.getElementById('auction-status');
                    const auctionHighestBidDiv = document.getElementById('auction-highest-bid');
                    
                    if (auctionStatus && data.auctionCurrent !== undefined) {
                        const playerName = window.getPlayerName ? window.getPlayerName(data.auctionCurrent) : `Oyuncu ${data.auctionCurrent + 1}`;
                        auctionStatus.innerHTML = `İhale aktif - Sıra: ${playerName}`;
                    }
                    
                    if (auctionHighestBidDiv && data.auctionHighestBid) {
                        auctionHighestBidDiv.textContent = `En Yüksek Teklif: ${data.auctionHighestBid}`;
                    }
                    
                    // Aktif oyuncuyu vurgula - renderPlayersWithClick zaten bu işi yapıyor
                    // Burada sadece ek bilgileri güncelle, ışık yönetimini renderPlayersWithClick'e bırak
                    if (data.auctionCurrent !== undefined) {
                        // Global değişkeni güncelle
                        window.auctionCurrent = data.auctionCurrent;
                        
                        // İhale durumu bilgisini güncelle
                        const auctionStatus = document.getElementById('auction-status');
                        if (auctionStatus) {
                            const playerName = window.getPlayerName ? window.getPlayerName(data.auctionCurrent) : `Oyuncu ${data.auctionCurrent + 1}`;
                            auctionStatus.innerHTML = `İhale aktif - Sıra: ${playerName}`;
                        }
                    }
                }
            }
            
            // Puanları hesapla ve göster
            if (window.calculateAndShowScores) {
                window.calculateAndShowScores();
            }
        }
        
        // Seyirci bilgisi ekle
        const spectatorInfo = document.createElement('div');
        spectatorInfo.id = 'spectator-info';
        spectatorInfo.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(108, 92, 231, 0.9);
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            font-weight: bold;
            z-index: 1000;
        `;
        spectatorInfo.textContent = '👁️ Misafir Modu - Sadece İzleme';
        document.body.appendChild(spectatorInfo);
        showGameControlsForRole();
    });
    
    socket.on('playerJoined', (data) => {
        console.log('🚀 playerJoined event tetiklendi:', data);
        if (data && data.players) {
            console.log('🔍 Oyuncu listesi güncelleniyor...');
            players = data.players;
            console.log('🔍 players değişkeni güncellendi, updatePlayersList çağrılıyor...');
            updatePlayersList();
            updateStartButton();
        } else {
            console.error('❌ playerJoined event\'inde players verisi yok!');
        }
    });
    
    socket.on('playerLeft', (data) => {
        console.log('Oyuncu ayrıldı:', data);
        if (data && data.playerId !== undefined) {
            players = players.filter(p => p.position !== data.playerId);
            updatePlayersList();
            updateStartButton();
        }
    });
    
    socket.on('gameStarted', (data) => {
        console.log('Oyun başladı:', data);
        if (data) {
            startOnlineGame(data);
            
            // Otomatik kart dağıtma başlat
            console.log('🚀 gameStarted: Otomatik kart dağıtma başlatılıyor...');
            console.log('🔍 Socket kontrol ediliyor:', !!socket);
            console.log('🔍 currentRoom kontrol ediliyor:', currentRoom);
            
            if (socket && currentRoom) {
                console.log('✅ Socket ve currentRoom bulundu, otomatik kart dağıtma başlatılıyor...');
                // 2 saniye sonra otomatik kart dağıtma
                setTimeout(() => {
                    console.log('⏰ gameStarted: 2 saniye sonra otomatik kart dağıtma başlatılıyor...');
                    socket.emit('dealCards', { roomId: currentRoom });
                    console.log('✅ Otomatik kart dağıtma mesajı gönderildi');
                }, 2000);
            } else {
                console.error('❌ Socket veya currentRoom bulunamadı, otomatik kart dağıtma yapılamıyor');
                console.log('📊 Mevcut değişkenler:', {
                    socket: !!socket,
                    currentRoom: currentRoom
                });
            }
        }
    });
    
    socket.on('cardPlayed', (data) => {
        console.log('Kart oynandı:', data);
        if (data) {
            handleCardPlayed(data);
        }
    });
    
    socket.on('nextPlayer', (data) => {
        console.log('Sıradaki oyuncu:', data);
        if (data) {
            handleNextPlayer(data);
        }
    });
    
    socket.on('trickEnded', (data) => {
        console.log('El bitti:', data);
        if (data) {
            handleTrickEnded(data);
        }
    });
    
    socket.on('bidMade', (data) => {
        console.log('Teklif verildi:', data);
        if (data) {
            handleBidMade(data);
        }
    });
    
    socket.on('playerPassed', (data) => {
        console.log('Oyuncu pas geçti:', data);
        if (data) {
            handlePlayerPassed(data);
        }
    });
    
    socket.on('nextBidder', (data) => {
        console.log('Sıradaki teklifçi:', data);
        if (data) {
            handleNextBidder(data);
        }
    });
    
    socket.on('trumpSelected', (data) => {
        console.log('Koz seçildi:', data);
        if (data) {
            handleTrumpSelected(data);
        }
    });
    
    socket.on('cardsDealt', (data) => {
        console.log('Kartlar dağıtıldı:', data);
        if (data && window.handleCardsDealt) {
            window.handleCardsDealt(data);
        }
    });
    
    socket.on('potaMessage', (data) => {
        console.log('Pota mesajı alındı:', data);
        if (data) {
            console.log('Mesaj:', data.message);
            console.log('Oyuncu ID:', data.playerId);
            console.log('Oyuncu Adı:', data.playerName);
            
            if (window.addPotaMessage && data.message) {
                const playerId = data.playerId !== undefined ? data.playerId + 1 : 'Sistem';
                window.addPotaMessage(data.message, playerId);
                console.log('Pota mesajı chat kutusuna eklendi');
            } else {
                console.error('addPotaMessage fonksiyonu bulunamadı!');
            }
        }
    });
    
    socket.on('hideAuctionControls', (data) => {
        console.log('Pota kontrolleri devre dışı bırakılıyor:', data);
        
        // Pota mesajı kutusunu devre dışı bırak
        const potaChatInput = document.getElementById('pota-chat-input');
        const potaChatSend = document.getElementById('pota-chat-send');
        if (potaChatInput) potaChatInput.disabled = true;
        if (potaChatSend) potaChatSend.disabled = true;
        
        // Teklif kontrollerini gizleme - sadece pota chat kutusunu devre dışı bırak
        console.log('Pota chat kutusu devre dışı bırakıldı');
    });
    
    socket.on('sordumMessage', (data) => {
        console.log('Sordum mesajı alındı:', data);
        
        if (data && data.playerName) {
            // Mesaj kutusuna ekle
            if (window.addPotaMessage) {
                const playerId = data.playerId !== undefined ? data.playerId + 1 : 'Sistem';
                window.addPotaMessage(`${data.playerName} sordum dedi`, playerId);
            }
            
            // Sesli okuma
            if (window.speakText) {
                window.speakText(`${data.playerName} sordum dedi`);
            }
            
            // Sordum/Konuş modunu aktif et
            if (typeof window.sordumKonusMode !== 'undefined') {
                window.sordumKonusMode = true;
            }
            if (typeof window.sordumPlayer !== 'undefined' && data.playerId !== undefined) {
                window.sordumPlayer = data.playerId;
            }
            if (typeof window.auctionTurns !== 'undefined') {
                window.auctionTurns++;
            }
            
            console.log('Sordum modu aktif edildi:', {
                sordumKonusMode: window.sordumKonusMode,
                sordumPlayer: window.sordumPlayer,
                auctionTurns: window.auctionTurns
            });
            
            // Buton görünürlüğünü güncelle
            if (window.nextAuctionTurn) {
                window.nextAuctionTurn();
            }
        }
    });
    
    socket.on('passMessage', (data) => {
        console.log('Pas mesajı alındı:', data);
        
        if (data && data.playerName) {
            // Mesaj kutusuna ekle
            if (window.addPotaMessage) {
                const playerId = data.playerId !== undefined ? data.playerId + 1 : 'Sistem';
                window.addPotaMessage(`${data.playerName} pas`, playerId);
            }
            
            // Sesli okuma
            if (window.speakText) {
                window.speakText(`${data.playerName} pas`);
            }
        }
    });
    
    socket.on('konusMessage', (data) => {
        console.log('Konuş mesajı alındı:', data);
        
        if (data && data.playerName) {
            // Mesaj kutusuna ekle
            if (window.addPotaMessage) {
                const playerId = data.playerId !== undefined ? data.playerId + 1 : 'Sistem';
                window.addPotaMessage(`${data.playerName} konuş dedi`, playerId);
            }
            
            // Sesli okuma
            if (window.speakText) {
                window.speakText(`${data.playerName} konuş dedi`);
            }
        }
    });
    
    socket.on('konusPlayerUpdate', (data) => {
        console.log('Konuş player güncellendi:', data);
        
        if (data && data.konusPlayer !== undefined) {
            // Konuş player'ı güncelle
            if (typeof window.konusPlayer !== 'undefined') {
                window.konusPlayer = data.konusPlayer;
            }
            
            // Buton görünürlüğünü güncelle
            if (window.nextAuctionTurn) {
                window.nextAuctionTurn();
            }
        }
    });
    
    socket.on('auctionEnded', (data) => {
        console.log('İhale bitti:', data);
        
        if (data && data.playerName && data.winningBid !== undefined) {
            // İhale mesajını göster
            const message = `İhale ${data.playerName}'e ${data.winningBid}'ye kaldı`;
            if (window.addPotaMessage) {
                const winner = data.winner !== undefined ? data.winner + 1 : 'Sistem';
                window.addPotaMessage(message, winner);
            }
            
            // Sesli okuma
            if (window.speakText) {
                window.speakText(message);
            }
            
            // İhale bittiğini işle
            if (window.endAuction) {
                window.auctionActive = false;
                if (data.winner !== undefined) {
                    window.auctionWinner = data.winner;
                }
                if (data.winningBid !== undefined) {
                    window.auctionHighestBid = data.winningBid;
                }
                
                // Global değişkenleri de güncelle
                window.auctionActive = false;
                if (data.winner !== undefined) {
                    window.auctionWinner = data.winner;
                }
                if (data.winningBid !== undefined) {
                    window.auctionHighestBid = data.winningBid;
                }
                
                // script.js'deki local değişkenleri de güncelle
                if (typeof auctionActive !== 'undefined') {
                    auctionActive = false;
                    console.log('auctionActive güncellendi:', auctionActive);
                } else {
                    // Global scope'da tanımla
                    window.auctionActive = false;
                }
                
                // Local auctionWinner değişkenini güncelle
                try {
                    if (typeof auctionWinner !== 'undefined' && data.winner !== undefined) {
                        auctionWinner = data.winner;
                        console.log('Local auctionWinner güncellendi:', auctionWinner);
                    } else {
                        // Global scope'da tanımla
                        if (data.winner !== undefined) {
                            window.auctionWinner = data.winner;
                        }
                        console.log('Local auctionWinner tanımlı değil, window kullanılıyor');
                    }
                } catch (e) {
                    console.log('Local auctionWinner güncellenemedi, sadece window kullanılıyor');
                    if (data.winner !== undefined) {
                        window.auctionWinner = data.winner;
                    }
                }
                
                // Window auctionWinner'ı da güncelle
                if (data.winner !== undefined) {
                    window.auctionWinner = data.winner;
                }
                
                if (typeof auctionHighestBid !== 'undefined' && data.winningBid !== undefined) {
                    auctionHighestBid = data.winningBid;
                    console.log('auctionHighestBid güncellendi:', auctionHighestBid);
                } else {
                    // Global scope'da tanımla
                    if (data.winningBid !== undefined) {
                        window.auctionHighestBid = data.winningBid;
                    }
                }
                
                console.log('İhale bitti - Değişken durumu:', {
                    'window.auctionWinner': window.auctionWinner,
                    'local auctionWinner': typeof auctionWinner !== 'undefined' ? auctionWinner : 'undefined',
                    'data.winner': data.winner
                });
                
                // Sırayı ihale kazanan oyuncuya geçir
                const currentPlayerFromServer = data.currentPlayer !== undefined ? data.currentPlayer : (data.winner !== undefined ? data.winner : 0);

                if (typeof window.currentPlayer !== 'undefined') window.currentPlayer = currentPlayerFromServer;
                // Yerel değişkeni (let) de güncelle
                if (typeof onlineCurrentPlayer !== 'undefined') onlineCurrentPlayer = currentPlayerFromServer;
                // Global yansımayı da güncelle
                if (typeof window.onlineCurrentPlayer !== 'undefined') window.onlineCurrentPlayer = currentPlayerFromServer;
                
                window.endAuction();
                
                // Koz seçimini başlat
                if (window.showTrumpSelect) {
                    window.showTrumpSelect();
                }
                
                // Oyuncuları yeniden render et (sıra değişikliğini göstermek için)
                if (window.renderPlayers && window.playersGlobal) {
                    window.renderPlayers(window.playersGlobal);
                }
                
                // Aktif oyuncuyu güncelle - window.currentPlayer set edildi, renderPlayersWithClick otomatik olarak çağrılacak
                console.log('Aktif oyuncu güncelleniyor:', currentPlayerFromServer);
            }
        }
    });
}

// Odaya katılma
function joinRoom() {
    console.log('joinRoom() fonksiyonu çağrıldı');
    
    const roomIdInput = document.getElementById('room-id');
    const playerNameInput = document.getElementById('player-name');
    
    if (!roomIdInput || !playerNameInput) {
        console.error('Gerekli input elementleri bulunamadı!');
        alert('Sayfa yüklenirken hata oluştu. Lütfen sayfayı yenileyin.');
        return;
    }
    
    const roomId = roomIdInput.value.trim();
    const playerName = playerNameInput.value.trim();
    
    console.log('Oda ID:', roomId);
    console.log('Oyuncu Adı:', playerName);
    console.log('Katılım Türü: Oyuncu');
    
    if (!roomId || !playerName) {
        alert('Oda ID ve oyuncu adı gerekli!');
        return;
    }
    
    // Socket bağlantısını kontrol et
    if (!socket) {
        console.error('Socket bağlantısı yok!');
        alert('Sunucu bağlantısı yok! Lütfen sayfayı yenileyin ve sunucunun çalıştığından emin olun.');
        return;
    }
    
    if (!socket.connected) {
        console.error('Socket bağlantısı aktif değil!');
        alert('Sunucu bağlantısı aktif değil! Lütfen sayfayı yenileyin ve sunucunun çalıştığından emin olun.');
        return;
    }
    
    currentRoom = roomId;
    isSpectator = false;
    window.currentRoom = roomId;
    console.log('Odaya katılma isteği gönderiliyor...');
    
    // Socket event'ini gönder
    socket.emit('joinRoom', { roomId, playerName, isSpectator: false });
    
    // Arayüzü hemen güncelle (başarılı olup olmadığını socket event'leri ile kontrol edeceğiz)
    const joinSection = document.getElementById('join-section');
    const lobbySection = document.getElementById('lobby-section');
    const roomDisplay = document.getElementById('room-display');
    
    if (joinSection && lobbySection && roomDisplay) {
        joinSection.style.display = 'none';
        lobbySection.style.display = 'block';
        roomDisplay.textContent = roomId;
        console.log('Arayüz güncellendi - Lobby bölümü gösterildi');
    } else {
        console.error('Arayüz elementleri bulunamadı!');
    }
}

// Misafir olarak katılma
function joinAsSpectator() {
    console.log('joinAsSpectator() fonksiyonu çağrıldı');
    
    const roomIdInput = document.getElementById('room-id');
    const playerNameInput = document.getElementById('player-name');
    
    if (!roomIdInput || !playerNameInput) {
        console.error('Gerekli input elementleri bulunamadı!');
        alert('Sayfa yüklenirken hata oluştu. Lütfen sayfayı yenileyin.');
        return;
    }
    
    const roomId = roomIdInput.value.trim();
    const playerName = playerNameInput.value.trim();
    
    console.log('Oda ID:', roomId);
    console.log('Oyuncu Adı:', playerName);
    console.log('Katılım Türü: Misafir');
    
    if (!roomId || !playerName) {
        alert('Oda ID ve oyuncu adı gerekli!');
        return;
    }
    
    if (!socket) {
        console.error('Socket bağlantısı yok!');
        alert('Sunucu bağlantısı yok! Lütfen sayfayı yenileyin ve sunucunun çalıştığından emin olun.');
        return;
    }
    
    if (!socket.connected) {
        console.error('Socket bağlantısı aktif değil!');
        alert('Sunucu bağlantısı aktif değil! Lütfen sayfayı yenileyin ve sunucunun çalıştığından emin olun.');
        return;
    }
    
    currentRoom = roomId;
    isSpectator = true;
    console.log('Misafir olarak katılma isteği gönderiliyor...');
    socket.emit('joinRoom', { roomId, playerName, isSpectator: true });
}

// Oyuncu listesini güncelle
function updatePlayersList() {
    console.log('=== updatePlayersList BAŞLADI ===');
    console.log('🔍 players.length:', players.length);
    console.log('🔍 players:', players);
    console.log('🔍 socket:', !!socket);
    console.log('🔍 currentRoom:', currentRoom);
    console.log('🔍 Socket ID:', socket ? socket.id : 'YOK');
    console.log('🔍 Socket connected:', socket ? socket.connected : 'YOK');
    
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '';
    
    players.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.textContent = `${player.name} (Pozisyon ${player.position + 1})`;
        playerDiv.style.padding = '5px';
        playerDiv.style.margin = '2px 0';
        playerDiv.style.background = 'rgba(255,255,255,0.1)';
        playerDiv.style.borderRadius = '3px';
        playersList.appendChild(playerDiv);
    });
    
    // Oyun alanındaki oyuncu isimlerini güncelle
    updatePlayerNames();
    
    console.log('Oyuncu listesi güncellendi:', players.length, 'oyuncu');
    
    // 4 oyuncu olduğunda otomatik oyun başlat
    if (players.length === 4) {
        console.log('🚀 4 oyuncu tamamlandı, otomatik işlemler başlatılıyor...');
        console.log('🔍 Oyuncu sayısı:', players.length);
        console.log('🔍 Oyuncular:', players.map(p => p.name));
        
        // Socket ve currentRoom kontrolü
        console.log('🔍 Socket kontrol ediliyor:', !!socket);
        console.log('🔍 Socket ID:', socket ? socket.id : 'YOK');
        console.log('🔍 currentRoom kontrol ediliyor:', currentRoom);
        console.log('🔍 Socket connected:', socket ? socket.connected : 'YOK');
        
        if (socket && currentRoom) {
            console.log('✅ Socket ve currentRoom bulundu, otomatik kart dağıtma başlatılıyor...');
            // 1 saniye sonra otomatik kart dağıtma
            setTimeout(() => {
                console.log('🚀 updatePlayersList: 1 saniye sonra otomatik kart dağıtma başlatılıyor...');
                console.log('🔍 dealCards mesajı gönderiliyor, roomId:', currentRoom);
                socket.emit('dealCards', { roomId: currentRoom });
                console.log('✅ Otomatik kart dağıtma mesajı gönderildi');
                
                // Otomatik kart dağıtma sonrası dağıt butonunu pasif hale getir
                setTimeout(() => {
                    const dealBtn = document.getElementById('dealBtn');
                    if (dealBtn) {
                        dealBtn.disabled = true;
                        dealBtn.style.opacity = '0.5';
                        dealBtn.style.cursor = 'not-allowed';
                        dealBtn.style.backgroundColor = '#ccc';
                        dealBtn.textContent = 'Kartlar Otomatik Dağıtıldı';
                        dealBtn.title = 'Kartlar otomatik olarak dağıtıldı';
                        console.log('✅ Dağıt butonu otomatik kart dağıtma sonrası pasif hale getirildi');
                    }
                }, 500); // Kart dağıtma mesajından 500ms sonra
            }, 1000);
        } else {
            console.error('❌ Socket veya currentRoom bulunamadı, otomatik kart dağıtma yapılamıyor');
            console.log('📊 Mevcut değişkenler:', {
                socket: !!socket,
                currentRoom: currentRoom,
                socketId: socket ? socket.id : 'YOK',
                socketConnected: socket ? socket.connected : 'YOK'
            });
        }
    } else {
        console.log('🔍 Oyuncu sayısı henüz 4 değil:', players.length);
    }
}

// Oyun alanındaki oyuncu isimlerini güncelle
function updatePlayerNames() {
    players.forEach(player => {
        const playerNameElement = document.getElementById(`player${player.position + 1}-name`);
        if (playerNameElement) {
            playerNameElement.textContent = player.name;
        }
    });
    
    // Dağıt butonunu manuel olarak güncelle
    const dealBtn = document.getElementById('dealBtn');
    if (dealBtn && window.currentDealer !== undefined) {
        // Oyuncu isimlerini kullanarak dağıtıcı ismini bul
        let dealerName = `Oyuncu ${window.currentDealer + 1}`;
        if (window.players && window.players[window.currentDealer]) {
            dealerName = window.players[window.currentDealer].name;
        }
        dealBtn.textContent = `Kartları Dağıt (${dealerName})`;
        dealBtn.title = `Sadece ${dealerName} kartları dağıtabilir`;
        dealBtn.style.display = 'block';
        dealBtn.style.visibility = 'visible';
        
        // Eğer mevcut oyuncu dağıtıcı değilse butonu devre dışı bırak
        if (window.onlineCurrentPlayer !== undefined && window.onlineCurrentPlayer !== window.currentDealer) {
            dealBtn.disabled = true;
            dealBtn.style.opacity = '0.5';
            dealBtn.style.cursor = 'not-allowed';
            dealBtn.style.backgroundColor = '#ccc';
        } else {
            dealBtn.disabled = false;
            dealBtn.style.opacity = '1';
            dealBtn.style.cursor = 'pointer';
            dealBtn.style.backgroundColor = '';
        }
    }
}

// Başlat butonunu güncelle
function updateStartButton() {
    const startBtn = document.getElementById('start-game-btn');
    if (window.isSpectator) {
        startBtn.style.display = 'none';
        return;
    }
    startBtn.style.display = 'block';
    if (players.length === 4) {
        startBtn.disabled = false;
        startBtn.textContent = 'Oyunu Başlat';
    } else {
        startBtn.disabled = true;
        startBtn.textContent = `Oyunu Başlat (${4 - players.length} oyuncu daha gerekli)`;
    }
    console.log('Başlat butonu güncellendi:', players.length, 'oyuncu');
}

// Oyunu başlat
function startGame() {
    console.log('Oyun başlatma isteği gönderiliyor...');
    socket.emit('startGame', { roomId: currentRoom });
}

// Online oyunu başlat
function startOnlineGame(data) {
    console.log('=== startOnlineGame BAŞLADI ===');
    
    console.log('🔍 Otomatik dağıtma kontrolü:');
    console.log('  - socket:', !!socket);
    console.log('  - currentRoom:', currentRoom);
    console.log('  - window.cardsDealt:', window.cardsDealt);
    console.log('  - oyuncu sayısı:', data?.gameState?.players?.length);
    
    console.log('Online oyun başlatılıyor:', data);
    isOnlineMode = true;
    onlineCurrentPlayer = data.gameState.players.find(p => p.id === socket.id)?.position || 0;
    
    // Global değişkenleri ayarla
    window.isSpectator = false;
    window.isOnlineMode = true;
    window.players = players;
    window.currentDealer = data.gameState.currentDealer || 0; // Dağıtıcıyı ayarla
    window.onlineCurrentPlayer = onlineCurrentPlayer; // Online oyuncu kimliğini global olarak ayarla
    
    // Socket ve currentRoom'u global olarak ayarla
    window.socket = socket;
    window.currentRoom = currentRoom;
    console.log('Global değişkenler ayarlandı:', {
        windowSocket: !!window.socket,
        windowCurrentRoom: window.currentRoom,
        socket: !!socket,
        currentRoom: currentRoom
    });
    
    // Arayüzü güncelle
    document.getElementById('lobby-section').style.display = 'none';
    document.getElementById('game-section').style.display = 'block';
    
    // Dağıt butonunu zorla görünür hale getir
    const dealBtn = document.getElementById('dealBtn');
    if (dealBtn) {
        dealBtn.style.display = 'block';
        dealBtn.style.visibility = 'visible';
    }
    
    // Misafir bilgisini gizle (normal oyuncular için)
    const spectatorInfo = document.getElementById('spectator-info');
    if (spectatorInfo) {
        spectatorInfo.remove();
    }
    
    // Oyuncu isimlerini güncelle
    updatePlayerNames();
    
    // Oyun durumunu senkronize et
    syncGameState(data.gameState);
    
    // Global değişkenleri ayarla
    if (window.playersGlobal) {
        // Oyuncuların kartlarını senkronize et
        window.playersGlobal = data.gameState.players.map(p => p.cards || []);
        window.currentPlayer = onlineCurrentPlayer;
        window.trumpSuit = data.gameState.trumpSuit;
        window.playedCards = data.gameState.playedCards || [];
        
        // Arayüzü güncelle
        if (window.renderPlayersWithClick) {
            window.renderPlayersWithClick(onlineCurrentPlayer);
        }
    }
    // Otomatik kart dağıtma başlat
    console.log('🚀 startOnlineGame: Otomatik kart dağıtma başlatılıyor...');
    console.log('🔍 Socket kontrol ediliyor:', !!socket);
    console.log('🔍 currentRoom kontrol ediliyor:', currentRoom);
    
    if (socket && currentRoom) {
        console.log('✅ Socket ve currentRoom bulundu, otomatik kart dağıtma başlatılıyor...');
        // 2 saniye sonra otomatik kart dağıtma
        setTimeout(() => {
            console.log('⏰ startOnlineGame: 2 saniye sonra otomatik kart dağıtma başlatılıyor...');
            socket.emit('dealCards', { roomId: currentRoom });
            console.log('✅ Otomatik kart dağıtma mesajı gönderildi');
        }, 2000);
    } else {
        console.error('❌ Socket veya currentRoom bulunamadı, otomatik kart dağıtma yapılamıyor');
        console.log('📊 Mevcut değişkenler:', {
            socket: !!socket,
            currentRoom: currentRoom
        });
    }
    
    // İhale sürecini başlat
    if (data.gameState.auctionActive) {
        console.log('İhale süreci başlatılıyor...');
        startAuction(data.gameState);
    }
    
    showGameControlsForRole();
    console.log('=== startOnlineGame TAMAMLANDI ===');
}

// İhale sürecini başlat
function startAuction(gameState) {
    console.log('İhale başladı, mevcut teklifçi:', gameState.auctionCurrent);
    
    // Global değişkenleri güncelle
    window.auctionActive = true;
    window.auctionCurrent = gameState.auctionCurrent;
    window.auctionHighestBid = gameState.auctionHighestBid || 150;
    
    // İhale kontrollerini göster
    const auctionControls = document.getElementById('auction-controls');
    const auctionStatus = document.getElementById('auction-status');
    const auctionHighestBid = document.getElementById('auction-highest-bid');
    
    if (auctionControls) auctionControls.style.display = 'block';
    if (auctionStatus) auctionStatus.textContent = `İhale başladı - Sıra: Oyuncu ${gameState.auctionCurrent + 1}`;
    if (auctionHighestBid) auctionHighestBid.textContent = `En yüksek teklif: ${gameState.auctionHighestBid}`;
    
    // Eğer sıra bu oyuncudaysa teklif verme kontrollerini göster
    if (gameState.auctionCurrent === onlineCurrentPlayer) {
        console.log('Sıra sizde, teklif verebilirsiniz');
        // Teklif verme kontrollerini aktifleştir
    }
    
    // Arayüzü güncelle - window.auctionCurrent set edildi, renderPlayersWithClick otomatik olarak çağrılacak
    console.log('startAuction: window.auctionCurrent set edildi:', gameState.auctionCurrent);
}

// Oyun durumunu senkronize et
function syncGameState(gameState) {
    console.log('Oyun durumu senkronize ediliyor:', gameState);
    
    // Global değişkenleri güncelle
    if (window.playersGlobal) {
        window.playersGlobal = gameState.players.map(p => p.cards || []);
        window.currentPlayer = onlineCurrentPlayer;
        window.onlineCurrentPlayer = onlineCurrentPlayer; // Online oyuncu kimliğini güncelle
        window.trumpSuit = gameState.trumpSuit;
        window.playedCards = gameState.playedCards || [];
        
        // Dağıtıcıyı güncelle
        window.currentDealer = gameState.currentDealer || 0;
        
        // İhale durumunu güncelle
        if (typeof auctionActive !== 'undefined') {
            auctionActive = gameState.auctionActive;
        }
        if (typeof auctionCurrent !== 'undefined') {
            auctionCurrent = gameState.auctionCurrent;
        }
        
        // Arayüzü güncelle - window değişkenleri set edildi, renderPlayersWithClick otomatik olarak çağrılacak
        console.log('syncGameState: Global değişkenler set edildi:', {
            auctionActive: gameState.auctionActive,
            auctionCurrent: gameState.auctionCurrent,
            currentPlayer: gameState.currentPlayer
        });
        
        // Oyuncu isimlerini güncelle
        updatePlayerNames();
    }
}

// Kart oynandığında
function handleCardPlayed(data) {
    console.log('Kart oynandı işleniyor:', data);
    // Masaya kartı ekle
    // renderCenterCards();
    
    // Eğer 4 kart oynandıysa eli bitir
    if (data.playedCards.length === 4) {
        setTimeout(() => {
            // El sonucunu hesapla
            // calculateTrickResult(data.playedCards);
        }, 1000);
    }
}

// Sıradaki oyuncu
function handleNextPlayer(data) {
    console.log('Sıradaki oyuncu işleniyor:', data);
    onlineCurrentPlayer = data.currentPlayer;
    
    // Global değişkenleri güncelle
    if (window.currentPlayer !== undefined) {
        window.currentPlayer = onlineCurrentPlayer;
        window.onlineCurrentPlayer = onlineCurrentPlayer; // Online oyuncu kimliğini güncelle
        
        // Arayüzü güncelle - window.currentPlayer set edildi, renderPlayersWithClick otomatik olarak çağrılacak
        console.log('handleNextPlayer: window.currentPlayer set edildi:', data.currentPlayer);
    }
}

// El bittiğinde
function handleTrickEnded(data) {
    console.log('El bitti işleniyor:', data);
    const winner = data && typeof data.winner === 'number' ? data.winner : null;
    if (winner === null) return;

    // Sesli bildirim (varsa)
    // Not: İstek üzerine el kazananını sesli söylemiyoruz

    // Sırayı elin kazananına geçir
    onlineCurrentPlayer = winner;
    if (typeof window.currentPlayer !== 'undefined') window.currentPlayer = winner
    if (typeof window.onlineCurrentPlayer !== 'undefined') window.onlineCurrentPlayer = winner

    // Masayı temizle ve merkezi yeniden çiz
    if (Array.isArray(window.playedCards)) window.playedCards.length = 0
    else window.playedCards = []
    if (typeof window.renderCenterCards === 'function') window.renderCenterCards()

    // Arayüzü aktif oyuncuya göre tazele
    if (typeof window.renderPlayers === 'function' && window.playersGlobal) window.renderPlayers(window.playersGlobal)
    // window.currentPlayer set edildi, renderPlayersWithClick otomatik olarak çağrılacak
    console.log('handleTrickEnded: window.currentPlayer set edildi:', winner);

    // Puan tablosunu güncelle (varsa)
    if (typeof window.calculateAndShowScores === 'function') window.calculateAndShowScores()

    // Oyun bitti mi? Tüm eller boşsa final skoru göster
    try {
        if (Array.isArray(window.playersGlobal)) {
            const allEmpty = window.playersGlobal.every(hand => Array.isArray(hand) && hand.length === 0)
            if (allEmpty && typeof window.calculateEndGameScores === 'function') {
                window.calculateEndGameScores()
            }
        }
    } catch (_) {}
}

// Teklif verildiğinde
function handleBidMade(data) {
    console.log('Teklif verildi işleniyor:', data);
    
    // Sunucudan gelen playerName'i kullan, yoksa fallback
    const playerName = data.playerName || (window.getPlayerName ? window.getPlayerName(data.playerId) : `Oyuncu ${data.playerId + 1}`);
    const message = `${playerName} teklif verdi: ${data.bid}`;
    
    // Mesaj kutusuna ekle
    if (window.addPotaMessage) {
        window.addPotaMessage(message, data.playerId + 1);
    }
    
    // Sesli okuma
    if (window.speakText) {
        window.speakText(message);
    }
}

// Oyuncu pas geçtiğinde
function handlePlayerPassed(data) {
    console.log('Oyuncu pas geçti işleniyor:', data);
    
    // Sunucudan gelen playerName'i kullan, yoksa fallback
    const playerName = data.playerName || (window.getPlayerName ? window.getPlayerName(data.playerId) : `Oyuncu ${data.playerId + 1}`);
    const message = `${playerName} pas`;
    
    // Mesaj kutusuna ekle
    if (window.addPotaMessage) {
        window.addPotaMessage(message, data.playerId + 1);
    }
    
    // Sesli okuma
    if (window.speakText) {
        window.speakText(message);
    }
}

// Sıradaki teklifçi
function handleNextBidder(data) {
    console.log('Sıradaki teklifçi işleniyor:', data);
    
    // Oyun durumunu güncelle
    window.auctionCurrent = data.currentBidder;
    
    // Global auctionCurrent değişkenini güncelle
    if (typeof auctionCurrent !== 'undefined') {
        auctionCurrent = data.currentBidder;
    }
    
    // İhale sırasını güncelle - tüm sekmelerde aynı görüntü olmalı
    if (window.nextAuctionTurn) {
        console.log('nextAuctionTurn çağrılıyor, auctionCurrent:', auctionCurrent);
        window.nextAuctionTurn();
    } else {
        console.error('nextAuctionTurn fonksiyonu bulunamadı!');
        
        // Fallback: Manuel olarak ışıkları güncelle
        for (let i = 0; i < 4; i++) {
            const playerDiv = document.getElementById(`player${i+1}`);
            if (playerDiv) {
                if (i === data.currentBidder) {
                    playerDiv.classList.add('auction-active');
                    playerDiv.classList.remove('active-player');
                } else {
                    playerDiv.classList.remove('auction-active', 'active-player');
                }
            }
        }
    }
}

// Koz seçildiğinde
function handleTrumpSelected(data) {
    console.log('Koz seçildi işleniyor:', data);
    
    const trumpSuit = data.trumpSuit;
    window.trumpSuit = trumpSuit;
    
    // İhale sürecini sonlandır - ışıkları temizle
    window.auctionActive = false;
    window.auctionCurrent = undefined;
    
    // Kozun Türkçe adını belirle
    let kozAd = '';
    switch(trumpSuit) {
        case '♥': kozAd = 'Kupa'; break;
        case '♠': kozAd = 'Maça'; break;
        case '♦': kozAd = 'Karo'; break;
        case '♣': kozAd = 'Sinek'; break;
        default: kozAd = trumpSuit;
    }
    
    const message = `Seçilen koz: ${kozAd}`;
    
    // Mesaj kutusuna ekle
    if (window.addPotaMessage) {
        window.addPotaMessage(message, 'Sistem');
    }
    
    // Sesli okuma
    if (window.speakText) {
        window.speakText(message);
    }
    
    // Koz seçim ekranını gizle
    if (window.hideTrumpSelect) {
        window.hideTrumpSelect();
    }
    
    // Aktif oyuncuyu güncelle
    if (data.currentPlayer !== undefined) {
        window.currentPlayer = data.currentPlayer;
        window.onlineCurrentPlayer = data.currentPlayer; // Online oyuncu kimliğini güncelle
    }
    
    // İlk eli oynamayı etkinleştir
    if (window.enableFirstPlay) {
        window.enableFirstPlay();
    }
    
    // Başlangıç puanlarını göster
    if (window.calculateAndShowScores) {
        window.calculateAndShowScores();
    }
    
    // Oyuncuları yeniden render et - ihale bitti, kart atma başladı
    if (window.renderPlayersWithClick) {
        // window.currentPlayer set edildi, renderPlayersWithClick otomatik olarak çağrılacak
        console.log('handleTrumpSelected: window.currentPlayer set edildi:', data.currentPlayer);
    }
    
    // Global trumpSuit değişkenini güncelle
    if (typeof trumpSuit !== 'undefined') {
        window.trumpSuit = trumpSuit;
    }
    if (typeof window.trumpSuit !== 'undefined') {
        window.trumpSuit = trumpSuit;
    }
    
    // Auction status'u güncelle
    const auctionStatus = document.getElementById('auction-status');
    if (auctionStatus) {
        auctionStatus.innerHTML += `<br>Koz: ${trumpSuit}`;
    }
}

// Event listener'ları ekle
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM yüklendi, event listener\'lar ekleniyor...');
    
    // Başlangıçta butonları devre dışı bırak
    const joinBtn = document.getElementById('join-btn');
    const spectatorBtn = document.getElementById('spectator-btn');
    if (joinBtn) joinBtn.disabled = true;
    if (spectatorBtn) spectatorBtn.disabled = true;
    
    // WebSocket bağlantısını kur
    setTimeout(() => {
        connectToServer();
    }, 100);
    
    // Event listener'ları ekle
    setupEventListeners();
    
    console.log('Tüm event listener\'lar eklendi');
});

// Event listener'ları kur
function setupEventListeners() {
    console.log('setupEventListeners başlatıldı');
    
    // Odaya katıl butonu
    const joinBtn = document.getElementById('join-btn');
    const botsVsBtn = document.getElementById('bots-vs-btn');
    console.log('join-btn elementi:', joinBtn);
    if (joinBtn) {
        // Mevcut event listener'ları temizle
        const oldJoinBtn = joinBtn;
        const newJoinBtn = oldJoinBtn.cloneNode(true);
        newJoinBtn.disabled = oldJoinBtn.disabled;
        oldJoinBtn.parentNode.replaceChild(newJoinBtn, oldJoinBtn);
        
        // Yeni butona event listener ekle
        newJoinBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Odaya Katıl butonuna tıklandı');
            
            // Buton disabled ise işlemi durdur
            if (this.disabled) {
                console.log('Buton disabled, işlem durduruldu');
                alert('Sunucu bağlantısı henüz kurulmadı. Lütfen bekleyin...');
                return;
            }
            
            // Socket bağlantısını kontrol et
            if (!socket || !socket.connected) {
                console.error('Socket bağlantısı yok veya aktif değil!');
                alert('Sunucu bağlantısı yok! Lütfen sayfayı yenileyin ve sunucunun çalıştığından emin olun.');
                return;
            }
            
            joinRoom();
        });
        
        console.log('Odaya Katıl butonu event listener eklendi');
    } else {
        console.error('Odaya Katıl butonu bulunamadı!');
        // 1 saniye sonra tekrar dene
        setTimeout(() => {
            setupEventListeners();
        }, 1000);
        return;
    }
    
    // Misafir butonu
    const spectatorBtn = document.getElementById('spectator-btn');
    if (spectatorBtn) {
        spectatorBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Misafir butonuna tıklandı');
            joinAsSpectator();
        });
        console.log('Misafir butonu event listener eklendi');
    } else {
        console.error('Misafir butonu bulunamadı!');
    }

    // Botlara karşı oyna
    if (botsVsBtn) {
        botsVsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Botlara Karşı Oyna butonuna tıklandı');

            // Girdi değerleri
            const roomIdInput = document.getElementById('room-id');
            const playerNameInput = document.getElementById('player-name');
            const playerName = (playerNameInput ? playerNameInput.value.trim() : '') || 'Oyuncu';

            // Offline moda geç (sunucu bağımlılığını kaldır)
            try { if (socket && socket.connected) socket.disconnect() } catch (_) {}
            socket = null;
            window.isOnlineMode = false;
            window.isSpectator = false;
            // Dağıtım kontrolü için aktif oyuncuyu sıfırla (dağıtıcı dışında engeli kaldır)
            try { window.currentPlayer = null } catch (_) {}

            // Arayüz: oyun ekranını aç, join/lobby'yi gizle
            const joinSection = document.getElementById('join-section');
            const lobbySection = document.getElementById('lobby-section');
            const gameSection = document.getElementById('game-section');
            if (joinSection) joinSection.style.display = 'none';
            if (lobbySection) lobbySection.style.display = 'none';
            if (gameSection) gameSection.style.display = 'block';

            // 4 koltuğu hazırla: 1 insan + 3 bot
            const offlinePlayers = [
                { id: 'human-local', name: playerName, position: 0 },
                { id: 'bot-1', name: 'Bot 2', position: 1 },
                { id: 'bot-2', name: 'Bot 3', position: 2 },
                { id: 'bot-3', name: 'Bot 4', position: 3 }
            ];
            // online.js yerel durumu ve globali güncelle
            players = offlinePlayers;
            window.players = offlinePlayers;

            // Oyuncu isimlerini UI'da göster ve dağıt butonunu görünür yap
            updatePlayerNames();

            // Botları aktifleştir (insan dışındaki tüm pozisyonlar)
            if (window.botManager) {
                for (let i = 1; i < 4; i++) window.botManager.createBot(i);
            }

            // Offline UI/akış init (script.js onload atlandıysa elle kur)
            try {
                if (typeof window.setupDealButton === 'function') window.setupDealButton(); // script.js içinde tanımlı
                if (typeof window.setupBidButton === 'function') window.setupBidButton(); // script.js içinde tanımlı
                if (typeof window.setupBotControls === 'function') window.setupBotControls(); // script.js içinde tanımlı
                // Online modda updateDealButton çağırma - updatePlayerNames zaten deal button durumunu yönetiyor
                // if (typeof window.updateDealButton === 'function') window.updateDealButton();
            } catch (_) {}

            // Skor tablosunu görünür yap (offline başlangıç)
            const scoreTable = document.getElementById('score-table');
            if (scoreTable) scoreTable.style.display = 'block';

            // Biraz gecikmeyle kartları dağıt (offline akış)
            setTimeout(() => {
                const dealBtn = document.getElementById('dealBtn');
                if (dealBtn) dealBtn.click();
                // Fallback: kısa süre sonra ihale kontrolleri görünmüyorsa başlatmayı zorla
                setTimeout(() => {
                    const auctionControls = document.getElementById('auction-controls');
                    const auctionStatus = document.getElementById('auction-status');
                    const notStarted = auctionControls && auctionControls.style.display === 'none';
                    if (notStarted) {
                        if (typeof window.offlineStartAuction === 'function') window.offlineStartAuction();
                        else if (auctionControls) auctionControls.style.display = 'block';
                        if (auctionStatus && auctionStatus.textContent.includes('Kartlar dağıtıldıktan sonra')) {
                            auctionStatus.textContent = 'İhale başladı! (En az 150)';
                        }
                    }
                }, 500);
            }, 250);
        });
    }
    
    // Oyunu başlat butonu
    const startBtn = document.getElementById('start-game-btn');
    console.log('start-game-btn elementi:', startBtn);
    if (startBtn) {
        startBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Oyunu Başlat butonuna tıklandı');
            startGame();
        });
        console.log('Oyunu Başlat butonu event listener eklendi');
    } else {
        console.error('Oyunu Başlat butonu bulunamadı!');
    }
    
    // Enter tuşu ile odaya katıl
    const roomIdInput = document.getElementById('room-id');
    if (roomIdInput) {
        roomIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('Enter tuşu ile odaya katılma');
                joinRoom();
            }
        });
    }
    
    const playerNameInput = document.getElementById('player-name');
    if (playerNameInput) {
        playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('Enter tuşu ile odaya katılma');
                joinRoom();
            }
        });
    }
    
    // Debug butonu
    const debugBtn = document.getElementById('debug-btn');
    if (debugBtn) {
        debugBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Debug butonuna tıklandı');
            debugConnection();
        });
        console.log('Debug butonu event listener eklendi');
    }
    
    // Kartları dağıt butonu
    const dealBtn = document.getElementById('dealBtn');
    console.log('dealBtn elementi:', dealBtn);
    if (dealBtn) {
        dealBtn.addEventListener('click', () => {
            console.log('Kartları dağıt butonuna tıklandı');
            if (isOnlineMode && socket) {
                console.log('Online modda kart dağıtma mesajı gönderiliyor');
                if (window.dealCardsOnline) {
                    window.dealCardsOnline();
                } else {
                    console.error('dealCardsOnline fonksiyonu bulunamadı!');
                    socket.emit('dealCards', { roomId: currentRoom });
                }
                return;
            }
            // Offline mod: burada hiçbir şey yapma, public/script.js içindeki listener offline dağıtımı yönetiyor
            console.log('Offline modda dağıtım, script.js listener devreye girecek');
        });
        console.log('Kartları dağıt butonu event listener eklendi');
    } else {
        console.error('Kartları dağıt butonu bulunamadı!');
    }
    
    console.log('Tüm event listener\'lar başarıyla eklendi');
}

// Online modda kart oynama
function playCardOnline(playerIdx, card, suit, idxInSuit) {
    if (!isOnlineMode || !socket) return;
    
    socket.emit('playCard', {
        roomId: currentRoom,
        playerId: playerIdx,
        card: card
    });
}

// Online modda teklif verme
function makeBidOnline(bid) {
    if (!isOnlineMode || !socket) return;
    
    socket.emit('makeBid', {
        roomId: currentRoom,
        playerId: onlineCurrentPlayer,
        bid: bid
    });
}

// Online modda koz seçimi
function selectTrumpOnline(trumpSuit) {
    if (!isOnlineMode || !socket) return;
    
    socket.emit('selectTrump', {
        roomId: currentRoom,
        trumpSuit: trumpSuit
    });
}

// Online modda kart dağıtma
window.dealCardsOnline = function() {
    console.log('dealCardsOnline fonksiyonu çağrıldı');
    console.log('isOnlineMode:', isOnlineMode);
    console.log('socket var mı:', !!socket);
    console.log('socket connected:', socket ? socket.connected : 'N/A');
    console.log('currentRoom:', currentRoom);
    
    if (!isOnlineMode || !socket) {
        console.error('Online mod veya socket yok!');
        return;
    }
    
    if (!socket.connected) {
        console.error('Socket bağlantısı yok!');
        return;
    }
    
    console.log('dealCards mesajı gönderiliyor, roomId:', currentRoom);
    socket.emit('dealCards', {
        roomId: currentRoom
    });
    console.log('dealCards mesajı gönderildi');
}

// Kartlar dağıtıldığında çağrılır
// Yardımcı: script yükleyici (tek sefer)
function loadScriptOnce(src, id, onload) {
    if (document.getElementById(id)) {
        if (typeof onload === 'function') onload()
        return
    }
    const s = document.createElement('script')
    const cacheBust = `v=${Date.now()}`
    s.src = src.includes('?') ? `${src}&${cacheBust}` : `${src}?${cacheBust}`
    s.id = id
    s.onload = () => {
        console.log(`[online.js] ${src} yüklendi`)
        if (typeof onload === 'function') onload()
    }
    s.onerror = () => console.error(`[online.js] ${src} yüklenemedi`)
    document.head.appendChild(s)
}

window.handleCardsDealt = function(data) {
    console.log('Kartlar dağıtıldı, oyun durumu güncelleniyor:', data);
    
    // Oyun durumunu senkronize et
    if (data.gameState) {
        // Global değişkenleri güncelle
        window.auctionActive = data.gameState.auctionActive;
        window.auctionCurrent = data.gameState.auctionCurrent;
        window.auctionHighestBid = data.gameState.auctionHighestBid;
        window.currentDealer = data.gameState.currentDealer;
        
        syncGameState(data.gameState);
    }
    
    // Kartları render et
    if (data.players) {
        
        // players verisini doğru formata dönüştür
        const playersForRender = data.players.map(player => player.cards || []);
        // İsimler için tam oyuncu listesi, eller için sade matris tut
        window.players = data.players;
        window.playersGlobal = playersForRender;
        
        const ensureFallbacks = () => {
            if (typeof window.renderPlayers !== 'function') {
                console.warn('[online.js] renderPlayers için fallback tanımlanıyor')
                const suitClass = { '♥': 'hearts', '♦': 'diamonds', '♠': 'spades', '♣': 'clubs' }
                const rankOrder = ['A','10','K','Q','J','9']
                const suitOrder = ['♥','♠','♦','♣']
                window.renderPlayers = function(hands) {
                    for (let i = 0; i < 4; i++) {
                        const cardsDiv = document.querySelector(`#player${i+1} .cards`)
                        if (!cardsDiv) continue
                        cardsDiv.innerHTML = ''
                        const hand = (hands && Array.isArray(hands[i])) ? hands[i] : []
                        for (const suit of suitOrder) {
                            const rowDiv = document.createElement('div')
                            rowDiv.style.marginBottom = '2px'
                            const suitCards = hand
                                .filter(c => c && c.suit === suit)
                                .sort((a,b) => rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank))
                            suitCards.forEach(card => {
                                const cardDiv = document.createElement('span')
                                cardDiv.className = 'card ' + (suitClass[card.suit] || '')
                                cardDiv.textContent = `${card.rank}${card.suit}`
                                rowDiv.appendChild(cardDiv)
                            })
                            cardsDiv.appendChild(rowDiv)
                        }
                    }
                }
            }
            if (typeof window.renderCenterCards !== 'function') {
                console.warn('[online.js] renderCenterCards için fallback tanımlanıyor')
                const suitClass = { '♥': 'hearts', '♦': 'diamonds', '♠': 'spades', '♣': 'clubs' }
                window.renderCenterCards = function() {
                    const centerDiv = document.getElementById('center-cards')
                    if (!centerDiv) return
                    centerDiv.innerHTML = ''
                    const played = (window.playedCards && Array.isArray(window.playedCards)) ? window.playedCards : []
                    played.forEach(play => {
                        if (!play?.card) return
                        const cardDiv = document.createElement('span')
                        cardDiv.className = 'card ' + (suitClass[play.card.suit] || '')
                        cardDiv.textContent = `${play.card.rank}${play.card.suit}`
                        cardDiv.title = `Oyuncu ${play.player + 1}`
                        centerDiv.appendChild(cardDiv)
                    })
                }
            }
        }

        const doRender = () => {
            ensureFallbacks()
            if (typeof window.renderPlayers === 'function') {
                console.log('renderPlayers fonksiyonu çağrılıyor')
                window.renderPlayers(playersForRender)
            } else {
                console.error('renderPlayers fonksiyonu bulunamadı (fallback başarısız)')
            }

            if (typeof window.renderCenterCards === 'function') {
                console.log('renderCenterCards fonksiyonu çağrılıyor')
                window.renderCenterCards()
            } else {
                console.error('renderCenterCards fonksiyonu bulunamadı (fallback başarısız)')
            }
        }

        // Fonksiyonlar yoksa script.js'i dinamik yükle ve sonra render et
        if (typeof window.renderPlayers !== 'function' || typeof window.renderCenterCards !== 'function') {
            console.warn('Render fonksiyonları bulunamadı, script.js dinamik yükleniyor...')
            loadScriptOnce('/script.js', 'script-js-dynamic', doRender)
        } else doRender()
    }
    
    // Oyuncu isimlerini güncelle
    updatePlayerNames();
    
    // Kartlar dağıtıldıktan sonra dağıt butonunu pasif hale getir
    const dealBtn = document.getElementById('dealBtn');
    if (dealBtn) {
        dealBtn.disabled = true;
        dealBtn.style.opacity = '0.5';
        dealBtn.style.cursor = 'not-allowed';
        dealBtn.style.backgroundColor = '#ccc';
        dealBtn.textContent = 'Kartlar Zaten Dağıtıldı';
        dealBtn.title = 'Kartlar otomatik olarak dağıtıldı';
        console.log('✅ Dağıtma butonu pasif hale getirildi: Kartlar otomatik olarak dağıtıldı');
        
        // Butonun tıklanabilir olmasını engelle
        dealBtn.onclick = null;
        dealBtn.removeEventListener('click', dealBtn.onclick);
    }
    
    // İhale başladıktan sonra arayüzü güncelle
    if (window.startAuction) {
        window.startAuction(data.gameState);
    }
    
    // Arayüzü hemen güncelle - window değişkenleri set edildi, renderPlayersWithClick otomatik olarak çağrılacak
    console.log('handleCardsDealt: Global değişkenler set edildi, renderPlayersWithClick otomatik olarak çağrılacak');
}

// Kart oynandığında çağrılır
function handleCardPlayed(data) {
    console.log('Kart oynandı, güncelleniyor:', data);
    
    // Oynanan kartı merkeze ekle
    if (data.card && data.playerId !== undefined) {
        const playedCard = {
            player: data.playerId,
            card: data.card
        };
        
        if (!window.playedCards) {
            window.playedCards = [];
        }
        window.playedCards.push(playedCard);
        
        // Kartı oyuncunun elinden çıkar
        const hand = window.playersGlobal[data.playerId];
        for (let i = 0; i < hand.length; i++) {
            if (hand[i].suit === data.card.suit && hand[i].rank === data.card.rank) {
                hand.splice(i, 1);
                break;
            }
        }
        
        // Merkez kartları render et
        if (window.renderCenterCards) {
            window.renderCenterCards();
        }
        
        // Oyuncu kartlarını render et
        if (window.renderPlayers && window.playersGlobal) {
            window.renderPlayers(window.playersGlobal);
        }
        
        // Not: İstek üzerine oynanan kart mesajını pota kutusuna yazmıyoruz ve sesli okumuyoruz
    }
}

// Debug fonksiyonu
function debugConnection() {
    console.log('=== DEBUG BİLGİLERİ ===');
    console.log('Socket var mı:', !!socket);
    console.log('Socket bağlı mı:', socket ? socket.connected : 'N/A');
    console.log('Current room:', currentRoom);
    console.log('Is online mode:', isOnlineMode);
    
    const joinBtn = document.getElementById('join-btn');
    const roomIdInput = document.getElementById('room-id');
    const playerNameInput = document.getElementById('player-name');
    
    console.log('Join button var mı:', !!joinBtn);
    console.log('Room ID input var mı:', !!roomIdInput);
    console.log('Player name input var mı:', !!playerNameInput);
    
    if (joinBtn) {
        console.log('Join button text:', joinBtn.textContent);
        console.log('Join button disabled:', joinBtn.disabled);
        console.log('Join button event listeners: Çalışıyor');
    }
    
    if (socket) {
        console.log('Socket ID:', socket.id);
        console.log('Socket connected:', socket.connected);
    }
    
    // Input değerlerini kontrol et
    if (roomIdInput) {
        console.log('Room ID value:', roomIdInput.value);
    }
    if (playerNameInput) {
        console.log('Player name value:', playerNameInput.value);
    }
    
    alert('Debug bilgileri konsola yazıldı. F12 tuşuna basarak Developer Tools\'u açın ve Console sekmesini kontrol edin.');
} 

// Oyun başlatıldığında ve arayüz güncellenirken kontrolleri göster/gizle
function showGameControlsForRole() {
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    const startBtn = document.getElementById('start-game-btn');
    if (window.isSpectator) {
        if (leftPanel) leftPanel.style.display = 'none';
        if (rightPanel) rightPanel.style.display = 'none';
        if (startBtn) startBtn.style.display = 'none';
    } else {
        if (leftPanel) leftPanel.style.display = 'block';
        if (rightPanel) rightPanel.style.display = 'block';
        if (startBtn) startBtn.style.display = 'block';
    }
} 