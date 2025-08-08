const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
});

// Statik dosyaları serve et
app.use(express.static(path.join(__dirname, 'public')));

// Hata yönetimi middleware
app.use((err, req, res, next) => {
    console.error('Express hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
});

// Kart oyunu sabitleri
const suits = ['♥', '♠', '♦', '♣'];
const ranks = ['9', '10', 'J', 'Q', 'K', 'A'];

// Kart deste oluşturma
function createDeck() {
    let deck = [];
    for (let d = 0; d < 2; d++) { // iki deste
        for (let suit of suits) {
            for (let rank of ranks) {
                deck.push({ suit, rank });
            }
        }
    }
    return deck;
}

// Deste karıştırma
function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// Kartları dağıtma
function dealCards(deck) {
    const players = [[], [], [], []];
    let cardIndex = 0;
    for (let round = 0; round < 3; round++) { // 3 turda 4'er kart
        for (let p = 0; p < 4; p++) {
            for (let k = 0; k < 4; k++) {
                players[p].push(deck[cardIndex++]);
            }
        }
    }
    return players;
}

// Deste oluştur ve karıştır
function createAndShuffleDeck() {
    const deck = createDeck();
    return shuffle(deck);
}

// Oda yönetimi
const rooms = new Map();

// Oda oluşturma
function createRoom(roomId) {
    const room = {
        id: roomId,
        players: [],
        gameState: null,
        currentDealer: 3,
        auctionActive: false,
        trumpSuit: null,
        playedCards: [],
        currentPlayer: null,
        auctionCurrent: 0,
        auctionHighestBid: 150,
        auctionWinner: null,
        consecutiveBozCount: 0
    };
    rooms.set(roomId, room);
    return room;
}

// Socket bağlantı yönetimi
io.on('connection', (socket) => {
    console.log('Yeni bağlantı:', socket.id);

    // Bağlantı durumu kontrolü
    socket.on('ping', () => {
        socket.emit('pong');
    });

    // Pong yanıtı
    socket.on('pong', () => {
        // Client'ın pong yanıtını aldık, bağlantı aktif
        console.log(`Pong alındı: ${socket.id}`);
    });

    // Bağlantı kesildiğinde temizlik
    socket.on('disconnect', (reason) => {
        console.log(`Bağlantı kesildi: ${socket.id}, Sebep: ${reason}`);
        
        // Oyuncuyu tüm odalardan çıkar
        for (const [roomId, room] of rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const player = room.players[playerIndex];
                console.log(`Oyuncu ${player.name} odadan çıktı: ${roomId}`);
                
                // Oyuncuyu listeden çıkar
                room.players.splice(playerIndex, 1);
                
                // Diğer oyunculara bildir
                socket.to(roomId).emit('playerLeft', { 
                    playerId: playerIndex,
                    playerName: player.name,
                    players: room.players.map(p => ({ id: p.id, name: p.name, position: p.position }))
                });
                
                // Oda boşsa odayı sil
                if (room.players.length === 0) {
                    rooms.delete(roomId);
                    console.log(`Oda silindi: ${roomId}`);
                }
                break;
            }
        }
    });

    // Odaya katılma
    socket.on('joinRoom', (data) => {
        try {
            const { roomId, playerName, isSpectator = false } = data;
            
            if (!roomId || !playerName) {
                socket.emit('error', { message: 'Geçersiz oda ID veya oyuncu adı' });
                return;
            }
            
            let room = rooms.get(roomId);
            
            if (!room) {
                room = createRoom(roomId);
            }

            // Seyirci ise sadece odaya katıl, oyuncu ekleme
            if (isSpectator) {
                socket.join(roomId);
                
                // Misafir oyuncuya mevcut oyun durumunu da gönder
                const spectatorData = { 
                    message: 'Seyirci olarak katıldınız',
                    players: room.players.map(p => ({ id: p.id, name: p.name, position: p.position }))
                };
                
                // Eğer oyun başlamışsa ve kartlar dağıtılmışsa, oyun durumunu da gönder
                if (room.gameState) {
                    spectatorData.gameState = room.gameState;
                    spectatorData.hasGameStarted = true;
                    spectatorData.playedCards = room.gameState.playedCards || [];
                    spectatorData.trumpSuit = room.gameState.trumpSuit;
                    spectatorData.currentPlayer = room.gameState.currentPlayer;
                    spectatorData.auctionActive = room.gameState.auctionActive;
                    spectatorData.auctionCurrent = room.gameState.auctionCurrent;
                    spectatorData.auctionHighestBid = room.gameState.auctionHighestBid;
                }
                
                socket.emit('spectatorJoined', spectatorData);
                
                // Diğer oyunculara sadece bilgi mesajı gönder (arayüzü etkilemesin)
                socket.to(roomId).emit('spectatorInfo', { 
                    message: 'Yeni seyirci katıldı',
                    spectatorName: playerName
                });
                
                console.log(`Seyirci ${playerName} oda ${roomId}'ye katıldı`);
                return;
            }

            // Aynı isimle oyuncu var mı kontrol et
            const existingPlayer = room.players.find(p => p.name === playerName);
            if (existingPlayer) {
                socket.emit('error', { message: 'Bu isimle bir oyuncu zaten var!' });
                return;
            }

            // Oyuncu sayısı kontrolü
            if (room.players.length >= 4) {
                socket.emit('roomFull', { message: 'Oda dolu!' });
                return;
            }

            // Oyuncuyu odaya ekle
            const player = {
                id: socket.id,
                name: playerName,
                position: room.players.length
            };
            room.players.push(player);
            socket.join(roomId);

            // Oyuncuya pozisyonunu bildir
            socket.emit('playerJoined', { 
                playerId: player.position,
                players: room.players.map(p => ({ id: p.id, name: p.name, position: p.position }))
            });

            // Diğer oyunculara yeni oyuncuyu bildir
            socket.to(roomId).emit('playerJoined', { 
                playerId: player.position,
                players: room.players.map(p => ({ id: p.id, name: p.name, position: p.position }))
            });

            console.log(`Oyuncu ${playerName} oda ${roomId}'ye katıldı. Pozisyon: ${player.position}`);
        } catch (error) {
            console.error('joinRoom hatası:', error);
            socket.emit('error', { message: 'Oda katılırken bir hata oluştu.' });
        }
    });

    // Oyun başlatma
    socket.on('startGame', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);
        
        if (!room || room.players.length !== 4) {
            socket.emit('error', { message: 'Oyun başlatılamaz. 4 oyuncu gerekli.' });
            return;
        }

        // Kartları dağıt
        const deck = createAndShuffleDeck();
        const playerCards = dealCards(deck);
        
        // Oyunculara kartları ata
        room.players.forEach((player, index) => {
            player.cards = playerCards[index];
        });

        // Oyun durumunu başlat
        room.gameState = {
            players: room.players,
            currentDealer: room.currentDealer,
            auctionActive: true,
            trumpSuit: null,
            playedCards: [],
            currentPlayer: (room.currentDealer + 1) % 4, // İlk teklifçi
            auctionCurrent: (room.currentDealer + 1) % 4,
            auctionHighestBid: 150,
            auctionWinner: null
        };

        // Tüm oyunculara oyun başladığını bildir
        io.to(roomId).emit('gameStarted', { 
            gameState: room.gameState,
            currentDealer: room.currentDealer,
            playerCards: playerCards
        });

        console.log(`Oda ${roomId}'de oyun başladı, kartlar dağıtıldı`);
    });

    // Kart oynama
    socket.on('playCard', (data) => {
        const { roomId, playerId, card } = data;
        const room = rooms.get(roomId);
        
        if (!room || !room.gameState) return;

        // Kartı oyna
        room.gameState.playedCards.push({ player: playerId, card });
        
        // Tüm oyunculara kart oynandığını bildir
        io.to(roomId).emit('cardPlayed', { 
            playerId, 
            card, 
            playedCards: room.gameState.playedCards 
        });

        // Eğer 4 kart oynandıysa, eli bitir
        if (room.gameState.playedCards.length === 4) {
            setTimeout(() => {
                const winner = findTrickWinner(room.gameState.playedCards, room.gameState.trumpSuit);
                room.gameState.currentPlayer = winner;
                room.gameState.playedCards = [];
                
                io.to(roomId).emit('trickEnded', { 
                    winner, 
                    currentPlayer: winner 
                });
            }, 1000);
        } else {
            // Sıradaki oyuncuya geç
            room.gameState.currentPlayer = (room.gameState.currentPlayer + 1) % 4;
            io.to(roomId).emit('nextPlayer', { 
                currentPlayer: room.gameState.currentPlayer 
            });
        }
    });

    // İhale teklifi
    socket.on('makeBid', (data) => {
        console.log('makeBid mesajı alındı:', data);
        const { roomId, playerId, bid } = data;
        const room = rooms.get(roomId);
        
        if (!room) {
            console.error(`Oda bulunamadı: ${roomId}`);
            return;
        }

        console.log(`Teklif işleniyor - Oda: ${roomId}, Oyuncu: ${playerId}, Teklif: ${bid}`);

        if (bid === null) {
            // Pas geç
            console.log(`Oyuncu ${playerId + 1} pas geçiyor`);
            io.to(roomId).emit('playerPassed', { 
                playerId,
                playerName: room.players[playerId]?.name || `Oyuncu ${playerId + 1}`
            });
        } else {
            // Teklif ver
            console.log(`Oyuncu ${playerId + 1} teklif veriyor: ${bid}`);
            room.auctionHighestBid = bid;
            io.to(roomId).emit('bidMade', { 
                playerId, 
                bid,
                playerName: room.players[playerId]?.name || `Oyuncu ${playerId + 1}`
            });
        }

        // Sıradaki oyuncuya geç - Sordum/Konuş modunda özel mantık
        if (room.gameState && room.gameState.auctionActive) {
            const dealer = room.gameState.currentDealer;
            const thirdPlayer = (dealer + 3) % 4;
            const fourthPlayer = dealer;
            
            // Sordum/Konuş sonrası 3. oyuncu teklif verirse sıra 4. oyuncuya geçer
            if (playerId === thirdPlayer && room.gameState.sordumKonusMode && room.gameState.konusPlayer === fourthPlayer) {
                console.log(`3. oyuncu konuş sonrası teklif verdi, sıra 4. oyuncuya geçiyor`);
                room.gameState.auctionCurrent = fourthPlayer;
            } else {
                // Normal sıra ilerletme
                room.gameState.auctionCurrent = (room.gameState.auctionCurrent + 1) % 4;
            }
            
            console.log(`Sıradaki teklifçi: ${room.gameState.auctionCurrent}`);
            io.to(roomId).emit('nextBidder', { currentBidder: room.gameState.auctionCurrent });
        }
    });

    // Koz seçimi
    socket.on('selectTrump', (data) => {
        const { roomId, trumpSuit } = data;
        const room = rooms.get(roomId);
        
        if (!room) return;

        room.gameState.trumpSuit = trumpSuit;
        room.gameState.currentPlayer = room.gameState.auctionWinner;
        
        io.to(roomId).emit('trumpSelected', { 
            trumpSuit,
            currentPlayer: room.gameState.currentPlayer,
            auctionWinner: room.gameState.auctionWinner
        });
    });

    // Pota mesajı
    socket.on('potaMessage', (data) => {
        const { roomId, message, playerId } = data;
        const room = rooms.get(roomId);
        
        if (!room) return;

        // Tüm oyunculara pota mesajını gönder
        io.to(roomId).emit('potaMessage', { 
            message, 
            playerId,
            playerName: room.players[playerId]?.name || `Oyuncu ${playerId + 1}`
        });
        
        // Debug: Oyun durumunu kontrol et
        console.log('Pota mesajı işleniyor - Oyun durumu:', {
            roomId,
            playerId,
            gameState: room.gameState,
            auctionActive: room.gameState?.auctionActive,
            currentDealer: room.gameState?.currentDealer
        });
        
        // Eğer ihale aktifse ve ilk 2 oyuncudan biri pota verdiyse, sırayı ilerlet
        if (room.gameState && room.gameState.auctionActive) {
            const dealer = room.gameState.currentDealer;
            const firstPlayer = (dealer + 1) % 4;
            const secondPlayer = (dealer + 2) % 4;
            
            console.log(`İhale aktif - Dealer: ${dealer}, First: ${firstPlayer}, Second: ${secondPlayer}, Player: ${playerId}`);
            
            if (playerId === firstPlayer || playerId === secondPlayer) {
                console.log(`Oyuncu ${playerId + 1} pota verdi, sıra ilerliyor`);
                
                // Sıradaki oyuncuya geç
                room.gameState.auctionCurrent = (room.gameState.auctionCurrent + 1) % 4;
                
                // Tüm oyunculara sıra değişikliğini bildir
                io.to(roomId).emit('nextBidder', { 
                    currentBidder: room.gameState.auctionCurrent 
                });
                
                // İlk 2 oyuncu pota verdikten sonra teklif kontrollerini gizle
                // Sadece ikinci oyuncu pota verdikten sonra kontrolleri gizle
                if (playerId === secondPlayer) {
                    io.to(roomId).emit('hideAuctionControls', { 
                        hideControls: true 
                    });
                }
            }
        } else {
            console.log('İhale aktif değil veya gameState yok');
        }
    });

    // Sordum mesajı
    socket.on('sordumMessage', (data) => {
        const { roomId, playerId } = data;
        const room = rooms.get(roomId);
        
        if (!room) return;

        console.log(`Oyuncu ${playerId + 1} sordum dedi`);

        // Tüm oyunculara sordum mesajını gönder
        io.to(roomId).emit('sordumMessage', { 
            playerId,
            playerName: room.players[playerId]?.name || `Oyuncu ${playerId + 1}`
        });
        
        // Eğer ihale aktifse, sırayı ilerlet
        if (room.gameState && room.gameState.auctionActive) {
            const dealer = room.gameState.currentDealer;
            const thirdPlayer = (dealer + 3) % 4;
            
            if (playerId === thirdPlayer) {
                console.log(`Oyuncu ${playerId + 1} sordum dedi, sıra ilerliyor`);
                
                // Sordum/Konuş modunu aktif et
                room.gameState.sordumKonusMode = true;
                room.gameState.sordumPlayer = playerId;
                
                // Sıradaki oyuncuya geç (4. oyuncuya)
                room.gameState.auctionCurrent = (room.gameState.auctionCurrent + 1) % 4;
                
                // Tüm oyunculara sıra değişikliğini bildir
                io.to(roomId).emit('nextBidder', { 
                    currentBidder: room.gameState.auctionCurrent 
                });
            }
        }
    });

    // Pas mesajı
    socket.on('passMessage', (data) => {
        const { roomId, playerId } = data;
        const room = rooms.get(roomId);
        
        if (!room) return;

        console.log(`Oyuncu ${playerId + 1} pas geçiyor`);

        // Tüm oyunculara pas mesajını gönder
        io.to(roomId).emit('passMessage', { 
            playerId,
            playerName: room.players[playerId]?.name || `Oyuncu ${playerId + 1}`
        });
        
        // Eğer ihale aktifse, özel mantık kontrol et
        if (room.gameState && room.gameState.auctionActive) {
            const dealer = room.gameState.currentDealer;
            const thirdPlayer = (dealer + 3) % 4;
            const fourthPlayer = dealer;
            
            // Sordum/Konuş sonrası 3. oyuncu pas derse, ihale 4. oyuncuya 150'ye kalır
            if (playerId === thirdPlayer && room.gameState.sordumKonusMode && room.gameState.konusPlayer === fourthPlayer) {
                console.log(`3. oyuncu konuş sonrası pas dedi, ihale 4. oyuncuya 150'ye kalıyor`);
                
                room.gameState.auctionWinner = fourthPlayer;
                room.gameState.auctionHighestBid = 150;
                room.gameState.auctionActive = false;
                room.gameState.sordumKonusMode = false;
                
                // Sırayı kazanan oyuncuya geçir
                room.gameState.currentPlayer = fourthPlayer;
                
                // İhale bittiğini bildir
                io.to(roomId).emit('auctionEnded', {
                    winner: fourthPlayer,
                    winningBid: 150,
                    playerName: room.players[fourthPlayer]?.name || `Oyuncu ${fourthPlayer + 1}`,
                    currentPlayer: fourthPlayer
                });
                
                return;
            }
            
            // Sordum/Konuş sonrası 4. oyuncu pas derse ihale 3. oyuncuya kalır ve biter
            if (playerId === fourthPlayer && room.gameState.sordumKonusMode && room.gameState.konusPlayer === fourthPlayer) {
                console.log(`4. oyuncu konuş sonrası pas dedi, ihale 3. oyuncuya kalıyor`);
                
                room.gameState.auctionWinner = thirdPlayer;
                room.gameState.auctionActive = false;
                room.gameState.sordumKonusMode = false;
                
                // Sırayı kazanan oyuncuya geçir
                room.gameState.currentPlayer = thirdPlayer;
                
                // İhale bittiğini bildir
                io.to(roomId).emit('auctionEnded', {
                    winner: thirdPlayer,
                    winningBid: room.gameState.auctionHighestBid,
                    playerName: room.players[thirdPlayer]?.name || `Oyuncu ${thirdPlayer + 1}`,
                    currentPlayer: thirdPlayer
                });
                
                return;
            }
            
            // Normal pas - sırayı ilerlet
            console.log(`Oyuncu ${playerId + 1} pas geçti, sıra ilerliyor`);
            room.gameState.auctionCurrent = (room.gameState.auctionCurrent + 1) % 4;
            
            // Tüm oyunculara sıra değişikliğini bildir
            io.to(roomId).emit('nextBidder', { 
                currentBidder: room.gameState.auctionCurrent 
            });
        }
    });

    // Konuş mesajı
    socket.on('konusMessage', (data) => {
        const { roomId, playerId } = data;
        const room = rooms.get(roomId);
        
        if (!room) return;

        console.log(`Oyuncu ${playerId + 1} konuş dedi`);

        // Tüm oyunculara konuş mesajını gönder
        io.to(roomId).emit('konusMessage', { 
            playerId,
            playerName: room.players[playerId]?.name || `Oyuncu ${playerId + 1}`
        });
        
        // Eğer ihale aktifse, konuş mantığını uygula
        if (room.gameState && room.gameState.auctionActive) {
            const dealer = room.gameState.currentDealer;
            const thirdPlayer = (dealer + 3) % 4;
            const fourthPlayer = dealer;
            
            if (playerId === thirdPlayer) {
                // 3. oyuncu direkt konuş diyor
                console.log(`Oyuncu ${playerId + 1} direkt konuş dedi, sıra ilerliyor`);
                room.gameState.auctionCurrent = (room.gameState.auctionCurrent + 1) % 4;
                io.to(roomId).emit('nextBidder', { 
                    currentBidder: room.gameState.auctionCurrent 
                });
            } else if (playerId === fourthPlayer) {
                // 4. oyuncu 3. oyuncuya konuş diyor
                console.log(`Oyuncu ${playerId + 1} 3. oyuncuya konuş dedi, sıra 3. oyuncuya döner`);
                room.gameState.auctionCurrent = thirdPlayer;
                room.gameState.konusPlayer = playerId; // Sunucuda da konuş player'ı takip et
                io.to(roomId).emit('nextBidder', { 
                    currentBidder: room.gameState.auctionCurrent 
                });
                // Konuş player'ı güncelle
                io.to(roomId).emit('konusPlayerUpdate', { 
                    konusPlayer: playerId 
                });
            }
        }
    });

    // Kartları dağıtma
    socket.on('dealCards', (data) => {
        console.log('dealCards mesajı alındı:', data);
        const { roomId } = data;
        const room = rooms.get(roomId);
        
        if (!room) {
            console.error(`Oda bulunamadı: ${roomId}`);
            return;
        }

        console.log(`Kartlar dağıtılıyor - Oda: ${roomId}`);

        // Yeni deste oluştur ve karıştır
        const deck = createAndShuffleDeck();
        const players = dealCards(deck);
        
        // Oyun durumunu güncelle
        room.gameState = {
            players: players,
            currentDealer: room.currentDealer,
            auctionActive: true, // İhale aktif olmalı
            trumpSuit: null,
            playedCards: [],
            currentPlayer: null,
            auctionCurrent: (room.currentDealer + 1) % 4,
            auctionHighestBid: 150,
            auctionWinner: null,
            consecutiveBozCount: 0,
            sordumKonusMode: false,
            sordumPlayer: null,
            konusPlayer: null
        };

        // Tüm oyunculara kartları dağıtıldı mesajı gönder
        io.to(roomId).emit('cardsDealt', {
            players: players,
            gameState: room.gameState,
            auctionState: {
                auctionActive: true, // İhale aktif olmalı
                auctionCurrent: room.gameState.auctionCurrent,
                auctionHighestBid: 150
            }
        });

        console.log(`Kartlar dağıtıldı - Oda: ${roomId}`);
    });
});

// El kazananını bul
function findTrickWinner(playedCards, trumpSuit) {
    if (playedCards.length !== 4) return null;
    
    const leadSuit = playedCards[0].card.suit;
    let bestIdx = 0;
    let bestCard = playedCards[0].card;
    
    for (let i = 1; i < 4; i++) {
        const c = playedCards[i].card;
        // Önce koz var mı bak
        if (trumpSuit && c.suit === trumpSuit && bestCard.suit !== trumpSuit) {
            bestIdx = i;
            bestCard = c;
        } else if (c.suit === bestCard.suit) {
            // Aynı renktense büyüklüğe bak
            const rankOrder = ['A', '10', 'K', 'Q', 'J', '9'];
            if (rankOrder.indexOf(c.rank) < rankOrder.indexOf(bestCard.rank)) {
                bestIdx = i;
                bestCard = c;
            }
        }
    }
    
    return playedCards[bestIdx].player;
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor`);
}); 