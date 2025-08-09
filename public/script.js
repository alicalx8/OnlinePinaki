const suits = ['♥', '♠', '♦', '♣'];
const ranks = ['9', '10', 'J', 'Q', 'K', 'A'];

// 48 kartlık deste (her karttan iki tane)
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

// Deste karıştırma (Fisher-Yates)
function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// 4 oyuncuya 4'erli gruplar halinde 12'şer kart dağıt
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

// Kart büyüklük sırası (A > 10 > K > Q > J > 9)
const rankOrder = ['A', '10', 'K', 'Q', 'J', '9'];
const suitOrder = ['♥', '♠', '♦', '♣'];
const suitClass = {
    '♥': 'hearts',
    '♦': 'diamonds',
    '♠': 'spades',
    '♣': 'clubs',
};

function sortPlayerCards(cards) {
    // Önce suit'e göre, sonra rankOrder'a göre sırala
    return cards.slice().sort((a, b) => {
        const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
        if (suitDiff !== 0) return suitDiff;
        return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
    });
}

function renderPlayers(players) {
    console.log('renderPlayers çağrıldı:', players);
    
    if (!players || !Array.isArray(players)) {
        console.error('renderPlayers: players parametresi geçersiz:', players);
        return;
    }
    
    for (let i = 0; i < 4; i++) {
        const cardsDiv = document.querySelector(`#player${i+1} .cards`);
        if (!cardsDiv) {
            console.error(`renderPlayers: #player${i+1} .cards elementi bulunamadı`);
            continue;
        }
        
        cardsDiv.innerHTML = '';
        
        // players[i] undefined kontrolü
        if (!players[i] || !Array.isArray(players[i])) {
            console.warn(`renderPlayers: Oyuncu ${i} için kart verisi bulunamadı:`, players[i]);
            continue;
        }
        
        // Her suit için bir satır
        for (const suit of suitOrder) {
            const rowDiv = document.createElement('div');
            rowDiv.style.marginBottom = '2px';
            const suitCards = sortPlayerCards(players[i]).filter(card => card.suit === suit);
            suitCards.forEach(card => {
                const cardDiv = document.createElement('span');
                cardDiv.className = 'card ' + suitClass[card.suit];
                cardDiv.textContent = card.rank + card.suit;
                rowDiv.appendChild(cardDiv);
            });
            cardsDiv.appendChild(rowDiv);
        }
    }
    
    // Online modda oyuncu isimlerini güncelle
    if (window.isOnlineMode && window.players) {
        window.players.forEach(player => {
            const playerNameElement = document.getElementById(`player${player.position + 1}-name`);
            if (playerNameElement) {
                playerNameElement.textContent = player.name;
            }
        });
    }
}

// İhale değişkenleri
let auctionActive = false;
let auctionPlayers = [0, 1, 2, 3]; // Oyuncu indexleri
let auctionBids = [null, null, null, null];
let auctionPasses = [false, false, false, false];
let auctionCurrent = 0;
window.auctionCurrent = 0;
let auctionHighestBid = 0;
let auctionWinner = null;
window.auctionWinner = null; // Global erişim için
let auctionTurns = 0;
window.auctionTurns = 0;
let trumpSuit = null;

// Dağıtıcı sırası (0=1. oyuncu, 1=2. oyuncu, 2=3. oyuncu, 3=4. oyuncu)
window.currentDealer = 3; // İlk eli 4. oyuncu dağıtır
let consecutiveBozCount = 0; // Ard arda boz sayısı

// Samandağ Pinaki özel değişkenleri
let sordumKonusMode = false; // Sordum/Konuş modunda mı?
let sordumPlayer = null; // Sordum diyen oyuncu
let konusPlayer = null; // Konuş diyen oyuncu

// Window objesine ekle (online mod için)
window.sordumKonusMode = sordumKonusMode;
window.sordumPlayer = sordumPlayer;
window.konusPlayer = konusPlayer;

// Değişkenleri senkronize etme fonksiyonu
function syncAuctionVariables() {
    window.sordumKonusMode = sordumKonusMode;
    window.sordumPlayer = sordumPlayer;
    window.konusPlayer = konusPlayer;
    window.auctionTurns = auctionTurns;
    window.auctionCurrent = auctionCurrent;
    window.auctionWinner = auctionWinner;
    window.auctionHighestBid = auctionHighestBid;
}

function updateAuctionHighestBid() {
    const div = document.getElementById('auction-highest-bid');
    // Sadece gerçek bir teklif verildiyse göster
    if (auctionHighestBid && auctionHighestBid > 150) {
        div.textContent = `En Yüksek Teklif: ${auctionHighestBid}`;
    } else {
        div.textContent = '';
    }
}

function startAuction() {
    auctionActive = true;
    auctionBids = [null, null, null, null];
    auctionPasses = [false, false, false, false];
    // Dağıtıcıdan sonraki oyuncu ihale başlatır
    auctionCurrent = (window.currentDealer + 1) % 4;
    auctionHighestBid = 150; // İhale en az 150'den başlar
    auctionWinner = null;
    auctionTurns = 0;
    // Koz seçimini sıfırla
    trumpSuit = null;
    // Samandağ Pinaki değişkenlerini sıfırla
    sordumKonusMode = false;
    sordumPlayer = null;
    konusPlayer = null;
    
    // Window değişkenlerini de güncelle
    window.auctionActive = true;
    window.auctionCurrent = auctionCurrent;
    window.auctionHighestBid = auctionHighestBid;
    window.auctionWinner = auctionWinner;
    window.auctionTurns = auctionTurns;
    window.sordumKonusMode = sordumKonusMode;
    window.sordumPlayer = sordumPlayer;
    window.konusPlayer = konusPlayer;
    
    document.getElementById('auction-status').innerHTML = `İhale başladı! (En az 150)`;
    document.getElementById('auction-controls').style.display = '';
    
    // Tüm oyuncu kutularından parlaklık efektlerini kaldır
    for (let i = 0; i < 4; i++) {
        const playerDiv = document.getElementById(`player${i+1}`);
        if (playerDiv) {
            playerDiv.classList.remove('active-player', 'auction-active');
        }
    }
    
    // updateDealButton() çağrısını kaldırdık - el tamamlanana kadar aynı dağıtıcı kalmalı
    nextAuctionTurn();
}

window.nextAuctionTurn = function() {
    // Sordum/Konuş modunda değilse normal ihale bitiş kontrolü yap
    if (!sordumKonusMode && auctionTurns >= 4) {
        // İhale bittiğinde tüm kutulardan kaldır
        for (let i = 0; i < 4; i++) {
            document.getElementById(`player${i+1}`).classList.remove('auction-active');
        }

        endAuction();
        return;
    }
    // Sıradaki oyuncu
    const currentPlayerName = window.getPlayerName(auctionCurrent);
    document.getElementById('auction-player').textContent = `${currentPlayerName} sırada: `;
    document.getElementById('bid-input').value = '';
    document.getElementById('bid-input').focus();
    // Tüm kutulardan kaldır, sadece teklif sırası gelen oyuncuya ekle
    for (let i = 0; i < 4; i++) {
        const div = document.getElementById(`player${i+1}`);
        if (i === auctionCurrent) div.classList.add('auction-active');
        else div.classList.remove('auction-active');
    }
    
    // Eğer sıradaki oyuncu bot ise, otomatik teklif ver
    if (window.botManager && window.botManager.isBotActive(auctionCurrent)) {
        setTimeout(() => {
            botMakeBid(auctionCurrent);
        }, 1500); // 1.5 saniye bekle
    }
    
    // Samandağ Pinaki kuralı: Buton görünürlüğünü yönet
    const sordumBtn = document.getElementById('sordum-btn');
    const konusBtn = document.getElementById('konus-btn');
    const bozBtn = document.getElementById('boz-btn');
    const bidBtn = document.getElementById('bid-btn');
    const passBtn = document.getElementById('pass-btn');
    
    // Tüm butonları gizle
    sordumBtn.style.display = 'none';
    konusBtn.style.display = 'none';
    bozBtn.style.display = 'none';
    bidBtn.style.display = 'inline-block';
    passBtn.style.display = 'inline-block';
    
    // Online modda window değişkenlerini kullan
    const currentSordumMode = window.isOnlineMode ? window.sordumKonusMode : sordumKonusMode;
    const currentSordumPlayer = window.isOnlineMode ? window.sordumPlayer : sordumPlayer;
    const currentAuctionCurrent = window.isOnlineMode ? window.auctionCurrent : auctionCurrent;
    
    if (currentSordumMode) {
        // Sordum/Konuş modunda - dinamik oyuncu numaraları
        const dealer = window.currentDealer;
        const thirdPlayer = (dealer + 3) % 4; // 3. oyuncu (dağıtıcıdan 3 sonraki)
        const fourthPlayer = dealer; // 4. oyuncu (dağıtıcı)
        
        console.log('Sordum/Konuş modu - Buton kontrolü:', {
            currentSordumMode,
            currentSordumPlayer,
            currentAuctionCurrent,
            dealer,
            thirdPlayer,
            fourthPlayer
        });
        
        if (currentAuctionCurrent === fourthPlayer && currentSordumPlayer === thirdPlayer && auctionBids[thirdPlayer] === null) {
            // 4. oyuncu sırasında ve 3. oyuncu sordum demiş, 3. oyuncu henüz teklif vermemiş
            bozBtn.style.display = 'inline-block';
            konusBtn.style.display = 'inline-block';
            bidBtn.style.display = 'none';
            passBtn.style.display = 'none';
        } else if (currentAuctionCurrent === fourthPlayer && currentSordumPlayer === thirdPlayer && auctionBids[thirdPlayer] !== null) {
            // 4. oyuncu sırasında ve 3. oyuncu teklif vermiş, 4. oyuncu teklif verebilir veya pas diyebilir
            bidBtn.style.display = 'inline-block';
            passBtn.style.display = 'inline-block';
        } else if (currentAuctionCurrent === thirdPlayer && (window.isOnlineMode ? window.konusPlayer : konusPlayer) === fourthPlayer) {
            // 3. oyuncu sırasında ve 4. oyuncu konuş demiş
            bidBtn.style.display = 'inline-block';
            passBtn.style.display = 'inline-block';
        }
    } else {
        // Normal mod - dinamik oyuncu numaraları
        const dealer = window.currentDealer;
        const firstPlayer = (dealer + 1) % 4; // 1. oyuncu (dağıtıcıdan sonraki)
        const secondPlayer = (dealer + 2) % 4; // 2. oyuncu
        const thirdPlayer = (dealer + 3) % 4; // 3. oyuncu
        
        if (currentAuctionCurrent === thirdPlayer && auctionBids[firstPlayer] === null && auctionBids[secondPlayer] === null) {
            // Normal 3. oyuncu sırasında ve 1. ve 2. oyuncu teklif vermemiş
            sordumBtn.style.display = 'inline-block';
            bidBtn.style.display = 'inline-block';
            passBtn.style.display = 'inline-block';
        }
    }
}

function endAuction() {
    auctionActive = false;
    document.getElementById('auction-controls').style.display = 'none';
    updateAuctionHighestBid();
    // Online modda winner ve bid sunucudan gelir; yerel hesaplama ile üzerine yazmayalım
    if (window.isOnlineMode) {
        // Sunucudan set edilmiş değerleri koru, sadece UI kapat
        // window.auctionWinner ve window.auctionHighestBid zaten online.js tarafından set ediliyor
        return;
    }
    // En yüksek teklifi veren oyuncuyu bul
    let maxBid = -1;
    let winner = null;
    for (let i = 0; i < 4; i++) {
        if (auctionBids[i] !== null && auctionBids[i] > maxBid) {
            maxBid = auctionBids[i];
            winner = i;
        }
    }
    auctionHighestBid = maxBid;
    auctionWinner = winner;
    // Window değişkenini de güncelle
    window.auctionWinner = winner;
    window.auctionHighestBid = maxBid;
    
    if (auctionWinner !== null) {
        const winnerName = getPlayerName(auctionWinner);
        document.getElementById('auction-status').innerHTML = `İhaleyi ${winnerName} kazandı!<br>Teklif: ${auctionHighestBid}`;
        
        // Not: İstek üzerine ihale sonucunu pota kutusuna yazmıyoruz ve sesli okumuyoruz
        //calculateAndShowScores(); // Başlangıç puanlarını gösterme
        showTrumpSelect();
        // Burada koz seçimi ve ilk kart atımı başlatılabilir
    } else {
        // İhale bitti ama kimse kazanmadı - sessizce geç
    }
}

function showTrumpSelect() {
    const trumpSelect = document.getElementById('trump-select');
    const trumpPlayer = document.getElementById('trump-player');
    
    if (trumpSelect) {
        trumpSelect.style.display = '';
    }
    
    if (trumpPlayer) {
        // Window değişkenini öncelik ver, eğer null ise local değişkeni kullan
        let winner = window.auctionWinner;
        if (winner === null || winner === undefined) {
            winner = auctionWinner;
        }
        
        console.log('Koz seçimi gösteriliyor:', { 
            auctionWinner: winner,
            currentPlayer: window.currentPlayer
        });
        
        const winnerName = window.getPlayerName ? window.getPlayerName(winner) : `Oyuncu ${winner + 1}`;
        trumpPlayer.textContent = `Kozu seçme hakkı: ${winnerName}`;
    } else {
        console.error('trump-player elementi bulunamadı');
    }
    
    // Eğer ihale kazananı bot ise, otomatik koz seç
    let winner = window.auctionWinner;
    if (winner === null || winner === undefined) {
        winner = auctionWinner;
    }
    
    if (window.botManager && window.botManager.isBotActive(winner)) {
        setTimeout(() => {
            botSelectTrump(winner);
        }, 2000); // 2 saniye bekle
    }
}

function hideTrumpSelect() {
    document.getElementById('trump-select').style.display = 'none';
}

let playedCards = [];
window.currentPlayer = null; // Sırası gelen oyuncu
let firstPlayerOfTrick = null; // Elin ilk oyuncusu

function enableFirstPlay() {
    // Window değişkenini öncelik ver, eğer null ise local değişkeni kullan
    let winner = window.auctionWinner;
    if (winner === null || winner === undefined) {
        winner = auctionWinner;
    }
    
    console.log('İlk el başlatılıyor:', {
        auctionWinner: winner,
        currentPlayer: window.currentPlayer
    });
    
    firstPlayerOfTrick = winner;
    window.currentPlayer = winner;
    
    if (window.renderPlayersWithClick) {
        window.renderPlayersWithClick(window.currentPlayer);
    }
}

function renderPlayersWithClick(activePlayer) {
    console.log('renderPlayersWithClick çağrıldı:', { activePlayer, playersGlobal: window.playersGlobal });
    
    // playersGlobal tanımlı değilse çık
    if (!window.playersGlobal) {
        console.error('playersGlobal tanımlı değil');
        return;
    }
    
    // Elin başında ilk atılan kartın rengi (leadSuit) belirlenir
    let leadSuit = null;
    if (window.playedCards && window.playedCards.length > 0 && window.playedCards[0] && window.playedCards[0].card) {
        leadSuit = window.playedCards[0].card.suit;
    }
    
    for (let i = 0; i < 4; i++) {
        const playerDiv = document.getElementById(`player${i+1}`);
        if (!playerDiv) {
            console.error(`player${i+1} elementi bulunamadı`);
            continue;
        }
        
        if (activePlayer === i) {
            playerDiv.classList.add('active-player');
        } else {
            playerDiv.classList.remove('active-player');
        }
        
        const cardsDiv = playerDiv.querySelector('.cards');
        if (!cardsDiv) {
            console.error(`player${i+1} için cards elementi bulunamadı`);
            continue;
        }
        
        cardsDiv.innerHTML = '';
        
        // Aktif oyuncunun oynayabileceği kartları belirle
        let allowedCards = null;
        if (i === activePlayer && !leadSuit) {
            // İlk kart atan oyuncu - istediği kartı atabilir
            allowedCards = window.playersGlobal[i] || [];
        } else if (i === activePlayer && leadSuit) {
            const hand = window.playersGlobal[i];
            if (!hand || !Array.isArray(hand)) {
                console.error(`player${i+1} için geçerli el bulunamadı`);
                continue;
            }
            
            const hasLeadSuit = hand.some(c => c && c.suit === leadSuit);
            const hasTrump = window.trumpSuit && hand.some(c => c && c.suit === window.trumpSuit);
            
            console.log(`Oyuncu ${i + 1} - Hand:`, hand);
            console.log(`LeadSuit: ${leadSuit}, TrumpSuit: ${window.trumpSuit}`);
            console.log(`HasLeadSuit: ${hasLeadSuit}, HasTrump: ${hasTrump}`);
            
            // Eğer açılan kart koz ise, koz yükseltme zorunluluğu uygula
            if (leadSuit === window.trumpSuit && hasTrump) {
                // Masadaki en yüksek kozun sırasını bul
                const playedTrumps = window.playedCards ? window.playedCards.filter(pc => pc && pc.card && pc.card.suit === window.trumpSuit).map(pc => pc.card) : [];
                let maxTrumpRankIdx = -1;
                if (playedTrumps.length > 0) {
                    maxTrumpRankIdx = Math.min(...playedTrumps.map(c => rankOrder.indexOf(c.rank)));
                }
                // Elinde daha yüksek koz var mı?
                const higherTrumps = hand.filter(c => c && c.suit === window.trumpSuit && rankOrder.indexOf(c.rank) < maxTrumpRankIdx);
                if (playedTrumps.length > 0 && higherTrumps.length > 0) {
                    allowedCards = higherTrumps;
                } else {
                    allowedCards = hand.filter(c => c && c.suit === window.trumpSuit);
                }
            } else if (hasLeadSuit) {
                // Açılan rengi takip et
                allowedCards = hand.filter(c => c && c.suit === leadSuit);
            } else if (hasTrump) {
                // Masada koz var mı?
                const playedTrumps = window.playedCards ? window.playedCards.filter(pc => pc && pc.card && pc.card.suit === window.trumpSuit).map(pc => pc.card) : [];
                let maxTrumpRankIdx = -1;
                if (playedTrumps.length > 0) {
                    maxTrumpRankIdx = Math.min(...playedTrumps.map(c => rankOrder.indexOf(c.rank)));
                }
                // Elinde daha yüksek koz var mı?
                const higherTrumps = hand.filter(c => c && c.suit === window.trumpSuit && rankOrder.indexOf(c.rank) < maxTrumpRankIdx);
                if (playedTrumps.length > 0 && higherTrumps.length > 0) {
                    allowedCards = higherTrumps;
                } else {
                    allowedCards = hand.filter(c => c && c.suit === window.trumpSuit);
                }
            } else {
                // Hiçbir kural yoksa istediği kartı atabilir
                allowedCards = hand;
            }
        }
        
        // Kartları render et
        const currentHand = window.playersGlobal[i];
        if (!currentHand || !Array.isArray(currentHand)) {
            console.error(`player${i+1} için geçerli el bulunamadı`);
            continue;
        }
        
        for (const suit of suitOrder) {
            const rowDiv = document.createElement('div');
            rowDiv.style.marginBottom = '2px';
            const suitCards = sortPlayerCards(currentHand).filter(card => card && card.suit === suit);
            suitCards.forEach((card, idx) => {
                if (!card) return; // Geçersiz kart atla
                
                const cardDiv = document.createElement('span');
                cardDiv.className = 'card ' + suitClass[card.suit];
                cardDiv.textContent = card.rank + card.suit;
                
                // Sadece aktif oyuncu için tıklanabilirlik ver
                if (i === activePlayer) {
                    // Misafir oyuncu kontrolü
                    if (window.isSpectator) {
                        cardDiv.style.opacity = 0.7;
                        cardDiv.title = 'Misafir oyuncu - kart oynayamazsınız';
                        cardDiv.style.cursor = 'not-allowed';
                    } else if (window.botManager && window.botManager.isBotActive(i)) {
                        cardDiv.style.opacity = 0.7;
                        cardDiv.title = 'Bot oyuncu - otomatik oynar';
                    } else {
        // İnsan oyuncu için tıklanabilirlik ver
        // Koz seçilmeden hiç kimse kart atamaz
        if (!window.trumpSuit) {
            cardDiv.style.opacity = 0.6;
            cardDiv.title = 'Önce koz seçilmeli';
            cardDiv.style.cursor = 'not-allowed';
        } else {
                        let canPlay = true;
                        if (leadSuit && allowedCards) {
                            canPlay = allowedCards.some(c => c && c.suit === card.suit && c.rank === card.rank);
                        }
                        
                        // Debug bilgisi ekle
                        if (i === activePlayer) {
                            console.log(`Oyuncu ${i + 1} - Kart: ${card.rank}${card.suit}`);
                            console.log(`LeadSuit: ${leadSuit}, TrumpSuit: ${window.trumpSuit}`);
                            console.log(`AllowedCards:`, allowedCards);
                            console.log(`CanPlay: ${canPlay}`);
                        }
                        
                        if (canPlay) {
                            cardDiv.style.cursor = 'pointer';
                            cardDiv.title = 'Bu kartı oyna';
                            cardDiv.addEventListener('click', () => {
                                playCard(i, card, suit, idx);
                            });
                        } else {
                            cardDiv.style.opacity = 0.5;
                            cardDiv.title = 'Bu kartı oynayamazsın';
                        }
        }
                    }
                } else {
                    // Pasif oyuncular için tıklanabilirlik verme
                    cardDiv.style.opacity = 0.3;
                    cardDiv.title = 'Sıranız değil';
                }
                rowDiv.appendChild(cardDiv);
            });
            cardsDiv.appendChild(rowDiv);
        }
    }
}

let playersGlobal = null;
// Oyun sonu puanlama için takımların topladığı kartlar
let team1Tricks = [];
let team2Tricks = [];
let lastTrickWinnerTeam = null;

// Birikimli takım puanları (2000 puana ulaşma için)
let cumulativeTeam1Score = 0;
let cumulativeTeam2Score = 0;

function playCard(playerIdx, card, suit, idxInSuit) {
    // Online modda kart oynama mesajı gönder
    if (window.isOnlineMode && window.socket) {
        window.socket.emit('playCard', {
            roomId: window.currentRoom,
            playerId: playerIdx,
            card: card
        });
        return;
    }
    
    // Kartı oyuncunun elinden çıkar
    const hand = playersGlobal[playerIdx];
    for (let i = 0; i < hand.length; i++) {
        if (hand[i].suit === card.suit && hand[i].rank === card.rank) {
            hand.splice(i, 1);
            break;
        }
    }
    // Masaya ekle
    playedCards.push({ player: playerIdx, card });
    renderCenterCards();
    
    // Bot kontrolü - sıradaki oyuncu bot mu?
    if (playedCards.length < 4) {
        window.currentPlayer = (window.currentPlayer + 1) % 4;
        renderPlayersWithClick(window.currentPlayer);
        
        // Eğer sıradaki oyuncu bot ise, otomatik oyna
        if (window.botManager && window.botManager.isBotActive(window.currentPlayer)) {
            setTimeout(() => {
                botPlayCard(window.currentPlayer);
            }, 1000); // 1 saniye bekle
        }
    } else {
        // 4 kart atıldıysa, 1 saniye bekle, masayı temizle ve yeni eli başlat
        setTimeout(() => {
            const winner = findTrickWinner();
            const trickCards = playedCards.map(pc => pc.card);
            const winnerTeam = (winner % 2 === 0) ? 1 : 2; // 0 ve 2: Takım 1, 1 ve 3: Takım 2
            // Son trick ise, lastTrickWinnerTeam'i set et ve kartları ekle
            if (
                playersGlobal[0].length === 0 &&
                playersGlobal[1].length === 0 &&
                playersGlobal[2].length === 0 &&
                playersGlobal[3].length === 0
            ) {
                lastTrickWinnerTeam = winnerTeam;
                if (winnerTeam === 1) team1Tricks.push(...trickCards);
                else team2Tricks.push(...trickCards);
                calculateEndGameScores();
            } else {
                if (winnerTeam === 1) team1Tricks.push(...trickCards);
                else team2Tricks.push(...trickCards);
            }
            playedCards = [];
            renderCenterCards();
            firstPlayerOfTrick = winner;
            window.currentPlayer = winner;
            renderPlayersWithClick(window.currentPlayer);
            
            // Eğer sıradaki oyuncu bot ise, otomatik oyna
            if (window.botManager && window.botManager.isBotActive(window.currentPlayer)) {
                setTimeout(() => {
                    botPlayCard(window.currentPlayer);
                }, 1500); // 1.5 saniye bekle
            }
        }, 1000);
    }
}

// Bot'un otomatik kart oynaması
function botPlayCard(playerIdx) {
    if (!window.botManager || !window.botManager.isBotActive(playerIdx)) return;
    
    console.log(`Bot ${playerIdx + 1} kart oynuyor...`);
    
    const hand = playersGlobal[playerIdx];
    const leadSuit = playedCards.length > 0 ? playedCards[0].card.suit : null;
    
    const card = window.botManager.botPlayCard(playerIdx, hand, leadSuit, trumpSuit, playedCards);
    
    if (card) {
        console.log(`Bot ${playerIdx + 1} kartı: ${card.rank}${card.suit}`);
        // Kartı oyna
        const suit = card.suit;
        const idxInSuit = hand.findIndex(c => c.suit === suit && c.rank === card.rank);
        playCard(playerIdx, card, suit, idxInSuit);
    } else {
        console.log(`Bot ${playerIdx + 1} oynayacak kart bulamadı`);
    }
}

// Bot'un otomatik ihale teklifi vermesi
function botMakeBid(playerIdx) {
    if (!window.botManager || !window.botManager.isBotActive(playerIdx)) return;
    
    const hand = playersGlobal[playerIdx];
    const bid = window.botManager.botMakeBid(playerIdx, auctionHighestBid, hand, trumpSuit);
    
    if (bid !== null) {
        // Teklif ver
        auctionBids[playerIdx] = bid;
        auctionTurns++;
        auctionHighestBid = bid;
        updateAuctionHighestBid();
        
        // Sıradaki oyuncuya geç
        auctionCurrent = (auctionCurrent + 1) % 4;
        nextAuctionTurn();
    } else {
        // Pas geç
        auctionPasses[playerIdx] = true;
        auctionTurns++;
        
        // Sıradaki oyuncuya geç
        auctionCurrent = (auctionCurrent + 1) % 4;
        nextAuctionTurn();
        updateAuctionHighestBid();
    }
}

// Elin kazananını bul (ilk atılan kartın rengine bak, en büyük kartı atan kazanır, koz varsa koza bakılır)
function findTrickWinner() {
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
            if (rankOrder.indexOf(c.rank) < rankOrder.indexOf(bestCard.rank)) {
                bestIdx = i;
                bestCard = c;
            }
        }
    }
    return playedCards[bestIdx].player;
}

function getPlayerName(playerIndex) {
    // Oyuncu isimlerini al
    const playerNames = ['Oyuncu 1', 'Oyuncu 2', 'Oyuncu 3', 'Oyuncu 4'];
    
    // Eğer window.players varsa, gerçek isimleri kullan
    if (window.players && window.players[playerIndex]) {
        return window.players[playerIndex].name || `Oyuncu ${playerIndex + 1}`;
    }
    
    return playerNames[playerIndex] || `Oyuncu ${playerIndex + 1}`;
}

function renderCenterCards() {
    const centerDiv = document.getElementById('center-cards');
    if (!centerDiv) {
        console.error('renderCenterCards: #center-cards elementi bulunamadı');
        return;
    }
    
    centerDiv.innerHTML = '';
    
    // window.playedCards kullan, eğer yoksa boş array kullan
    const playedCards = window.playedCards || [];
    
    playedCards.forEach(play => {
        if (play && play.card) {
            const cardDiv = document.createElement('span');
            cardDiv.className = 'card ' + suitClass[play.card.suit];
            cardDiv.textContent = play.card.rank + play.card.suit;
            cardDiv.title = `Oyuncu ${play.player + 1}`;
            centerDiv.appendChild(cardDiv);
        }
    });
}

function calculateAndShowScores() {
    console.log('Puanlar hesaplanıyor:', { 
        playersGlobal: window.playersGlobal,
        trumpSuit: window.trumpSuit 
    });
    
    if (!window.playersGlobal) {
        console.error('playersGlobal tanımlı değil');
        return;
    }
    
    const scores = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
        const hand = window.playersGlobal[i];
        if (!hand) {
            console.error(`Oyuncu ${i} için el bulunamadı`);
            continue;
        }
        
        let sritKoz = false;
        // 1. Kozda srit var mı?
        if (window.trumpSuit &&
            hand.filter(c => c.suit === window.trumpSuit && c.rank === 'A').length > 0 &&
            hand.filter(c => c.suit === window.trumpSuit && c.rank === '10').length > 0 &&
            hand.filter(c => c.suit === window.trumpSuit && c.rank === 'K').length > 0 &&
            hand.filter(c => c.suit === window.trumpSuit && c.rank === 'Q').length > 0 &&
            hand.filter(c => c.suit === window.trumpSuit && c.rank === 'J').length > 0) {
            sritKoz = true;
            scores[i] += 150;
        }
        // 2. Koz renginde toplam K ve Q sayısı
        let kozKCount = hand.filter(c => c.suit === window.trumpSuit && c.rank === 'K').length;
        let kozQCount = hand.filter(c => c.suit === window.trumpSuit && c.rank === 'Q').length;
        // Srit için bir K ve bir Q kullanıldıysa, fazladan kalan çiftler için 40 puan ekle
        let extraKozEvli = 0;
        if (kozKCount > 0 && kozQCount > 0) {
            let usedK = sritKoz ? 1 : 0;
            let usedQ = sritKoz ? 1 : 0;
            let kalanK = kozKCount - usedK;
            let kalanQ = kozQCount - usedQ;
            extraKozEvli = Math.min(kalanK, kalanQ);
            scores[i] += extraKozEvli * 40;
        }
        // 3. Diğer renklerdeki her K+Q çifti için 20 puan
        for (const suit of suitOrder) {
            if (suit === window.trumpSuit) continue;
            let kCount = hand.filter(c => c.suit === suit && c.rank === 'K').length;
            let qCount = hand.filter(c => c.suit === suit && c.rank === 'Q').length;
            let evliCount = Math.min(kCount, qCount);
            scores[i] += evliCount * 20;
        }
        // 4. Farklı renklerden 4 J
        if (suitOrder.every(suit => hand.some(c => c.suit === suit && c.rank === 'J'))) {
            scores[i] += 40;
        }
        // 5. Farklı renklerden 4 Q
        if (suitOrder.every(suit => hand.some(c => c.suit === suit && c.rank === 'Q'))) {
            scores[i] += 60;
        }
        // 6. Farklı renklerden 4 K
        if (suitOrder.every(suit => hand.some(c => c.suit === suit && c.rank === 'K'))) {
            scores[i] += 80;
        }
        // 7. Farklı renklerden 4 As
        if (suitOrder.every(suit => hand.some(c => c.suit === suit && c.rank === 'A'))) {
            scores[i] += 100;
        }
        // 8. Q♠ + J♦
        if (hand.some(c => c.suit === '♠' && c.rank === 'Q') && hand.some(c => c.suit === '♦' && c.rank === 'J')) {
            scores[i] += 40;
        }
        // 9. (Koz dışında) Aynı renkten A+10+K+Q+J (srit)
        for (const suit of suitOrder) {
            if (suit === window.trumpSuit) continue;
            if (
                hand.some(c => c.suit === suit && c.rank === 'A') &&
                hand.some(c => c.suit === suit && c.rank === '10') &&
                hand.some(c => c.suit === suit && c.rank === 'K') &&
                hand.some(c => c.suit === suit && c.rank === 'Q') &&
                hand.some(c => c.suit === suit && c.rank === 'J')
            ) {
                scores[i] += 150;
            }
        }
        // 10. Koz ile aynı renkteki 9'lar (her biri 10 puan)
        if (trumpSuit) {
            const nines = hand.filter(c => c.suit === trumpSuit && c.rank === '9').length;
            scores[i] += nines * 10;
        }
    }
    // Tabloyu oluştur
    const tableDiv = document.getElementById('score-table');
    let html = '<table style="width:100%;background:#fff;color:#222;border-radius:4px;text-align:center;font-size:14px;border-collapse:collapse;"><tr><th style="padding:4px;border:1px solid #ddd;">Oyuncu</th><th style="padding:4px;border:1px solid #ddd;">Puan</th></tr>';
    for (let i = 0; i < 4; i++) {
        const playerName = getPlayerName(i);
        html += `<tr><td style="padding:4px;border:1px solid #ddd;">${playerName}</td><td style="padding:4px;border:1px solid #ddd;">${scores[i]}</td></tr>`;
    }
    // Takım puanlarını ekle
    const team1 = scores[0] + scores[2];
    const team2 = scores[1] + scores[3];
    const player1Name = getPlayerName(0);
    const player3Name = getPlayerName(2);
    const player2Name = getPlayerName(1);
    const player4Name = getPlayerName(3);
    html += `<tr style='font-weight:bold;background:#eee;'><td style="padding:4px;border:1px solid #ddd;">Takım 1</td><td style="padding:4px;border:1px solid #ddd;">${team1}</td></tr>`;
    html += `<tr style='font-weight:bold;background:#eee;'><td style="padding:4px;border:1px solid #ddd;">Takım 2</td><td style="padding:4px;border:1px solid #ddd;">${team2}</td></tr>`;
    html += '</table>';
    tableDiv.innerHTML = html;
    tableDiv.style.display = '';
}
// Koz seçimi butonunda, koz seçildikten sonra puanları göster
Array.from(document.getElementsByClassName('trump-btn')).forEach(btn => {
    btn.addEventListener('click', function() {
        console.log('Koz butonu tıklandı - auctionWinner:', auctionWinner, 'window.auctionWinner:', window.auctionWinner);
        
        // Window değişkenini öncelik ver, eğer null ise local değişkeni kullan
        let winner = window.auctionWinner;
        if (winner === null || winner === undefined) {
            winner = auctionWinner;
        }
        
        console.log('Koz seçimi kontrol - winner:', winner, 'auctionWinner local:', auctionWinner);
        
        if (winner === null || winner === undefined) {
            console.log('İhale kazananı belirli değil, koz seçimi iptal edildi. winner:', winner);
            return;
        }
        
        // Online modda sadece ihale kazanan oyuncu koz seçebilir
        if (window.isOnlineMode) {
            console.log('Koz seçimi kontrol:', { 
                currentPlayer: window.currentPlayer,
                winner,
                socketId: window.socket.id,
                players: window.players
            });
            
            // Socket ID'ye göre oyuncuyu bul
            const currentPlayerIndex = window.players.findIndex(p => p.id === window.socket.id);
            console.log('Oyuncu pozisyonu:', currentPlayerIndex);
            
            if (currentPlayerIndex === -1) {
                console.log('Oyuncu bulunamadı');
                return;
            }
            
            // Pozisyon kontrolü
            if (currentPlayerIndex !== winner) {
                console.log(`Sadece ihale kazanan oyuncu (${winner}) koz seçebilir, siz ${currentPlayerIndex}. oyuncusunuz`);
                return;
            }
        }
        
        trumpSuit = this.getAttribute('data-suit');
        // Kozun Türkçe adını belirle
        let kozAd = '';
        switch(trumpSuit) {
            case '♥': kozAd = 'Kupa'; break;
            case '♠': kozAd = 'Maça'; break;
            case '♦': kozAd = 'Karo'; break;
            case '♣': kozAd = 'Sinek'; break;
            default: kozAd = trumpSuit;
        }
        // Online modda sunucuya bildir
        if (window.isOnlineMode && window.socket && window.currentRoom) {
            window.socket.emit('selectTrump', {
                roomId: window.currentRoom,
                trumpSuit: trumpSuit
            });
        } else {
            // Offline modda yerel işle
            // Not: İstek üzerine sesli okuma devre dışı
            hideTrumpSelect();
            document.getElementById('auction-status').innerHTML += `<br>Koz: ${trumpSuit}`;
            // Koz seçildikten sonra ilk kart atımı başlasın
            enableFirstPlay();
            calculateAndShowScores();
        }
    });
});

// Bot'un otomatik kart dağıtması
function botDealCards() {
    if (!window.botManager || !window.botManager.isBotActive(window.currentDealer)) return;
    
    // Not: İstek üzerine sesli okuma devre dışı
    
    // Kart dağıt butonuna programatik olarak tıkla
    const dealBtn = document.getElementById('dealBtn');
    if (dealBtn && !dealBtn.disabled) {
        dealBtn.click();
    }
}

// Bot'un otomatik koz seçimi
function botSelectTrump(playerIdx) {
    if (!window.botManager || !window.botManager.isBotActive(playerIdx)) return;
    
    const hand = playersGlobal[playerIdx];
    const selectedTrump = window.botManager.botSelectTrump(playerIdx, hand);
    
    if (selectedTrump) {
        trumpSuit = selectedTrump;
        // Kozun Türkçe adını belirle
        let kozAd = '';
        switch(trumpSuit) {
            case '♥': kozAd = 'Kupa'; break;
            case '♠': kozAd = 'Maça'; break;
            case '♦': kozAd = 'Karo'; break;
            case '♣': kozAd = 'Sinek'; break;
            default: kozAd = trumpSuit;
        }
        // Not: İstek üzerine sesli okuma devre dışı
        hideTrumpSelect();
        document.getElementById('auction-status').innerHTML += `<br>Koz: ${trumpSuit}`;
        // Koz seçildikten sonra ilk kart atımı başlasın
        enableFirstPlay();
        calculateAndShowScores();
    }
}

// Teklif verme butonu
function setupBidButton() {
    const bidBtn = document.getElementById('bid-btn');
    if (bidBtn) {
        bidBtn.addEventListener('click', () => {
            if (!auctionActive) return;
            
            // Online modda teklif verme
            if (window.isOnlineMode && window.socket) {
                const bid = parseInt(document.getElementById('bid-input').value, 10);
                if (isNaN(bid) || bid < 150 || bid % 10 !== 0) {
                    alert('Teklif en az 150 ve 10\'un katı olmalı!');
                    return;
                }
                
                console.log('Online modda teklif veriliyor:', bid);
                window.socket.emit('makeBid', {
                    roomId: window.currentRoom,
                    playerId: window.currentPlayer,
                    bid: bid
                });
                
                // Input'u temizle
                document.getElementById('bid-input').value = '';
                return;
            }
            
            // Offline modda teklif verme
            const bid = parseInt(document.getElementById('bid-input').value, 10);
            // İlk teklif mi?
            const isFirstBid = auctionHighestBid === 150 && auctionBids.every(b => b === null);
            if (
                isNaN(bid) ||
                bid < 150 ||
                bid % 10 !== 0 ||
                (!isFirstBid && (bid <= auctionHighestBid || bid < auctionHighestBid + 10))
            ) {
                alert('Teklif, mevcut en yüksekten en az 10 fazla, en az 150 ve 10\'un katı olmalı!');
                return;
            }
            auctionBids[auctionCurrent] = bid;
            auctionTurns++;
            auctionHighestBid = bid;
            updateAuctionHighestBid();
            // Not: İstek üzerine sesli okuma devre dışı

            // Sordum/Konuş sonrası 3. oyuncu teklif verirse sadece sırayı 4. oyuncuya geçir
            const dealer = window.currentDealer;
            const thirdPlayer = (dealer + 3) % 4; // 3. oyuncu (dağıtıcıdan 3 sonraki)
            const fourthPlayer = dealer; // 4. oyuncu (dağıtıcı)
            
            if (sordumKonusMode && konusPlayer === fourthPlayer && auctionCurrent === thirdPlayer) {
                auctionCurrent = fourthPlayer;
                nextAuctionTurn();
                return;
            }
            // Sordum/Konuş sonrası 4. oyuncu teklif verirse ihale hemen 4. oyuncuya kalır ve biter
            if (sordumKonusMode && konusPlayer === fourthPlayer && auctionCurrent === fourthPlayer) {
                sordumKonusMode = false;
                konusPlayer = null;
                sordumPlayer = null;
                auctionWinner = fourthPlayer;
                const player4Name = getPlayerName(fourthPlayer);
                // Not: İstek üzerine sesli okuma devre dışı
                endAuction();
                return;
            }
            auctionCurrent = (auctionCurrent + 1) % 4;
            nextAuctionTurn();
        });
        console.log('Teklif verme butonu event listener eklendi');
    }
}

document.getElementById('pass-btn').addEventListener('click', () => {
    if (!auctionActive) return;
    
    // Online modda sunucuya bildir
    if (window.isOnlineMode && window.socket && window.currentRoom) {
        console.log('Online modda pas mesajı gönderiliyor');
        
        // Oyuncu ID'sini bul
        let playerId = 0;
        if (window.players && window.players.length > 0) {
            const currentPlayer = window.players.find(p => p.id === window.socket.id);
            if (currentPlayer) {
                playerId = currentPlayer.position;
            }
        }
        
        window.socket.emit('passMessage', {
            roomId: window.currentRoom,
            playerId: playerId
        });
        
        console.log('Pas mesajı sunucuya gönderildi');
    } else {
        // Offline modda yerel işle
            // Not: İstek üzerine sesli okuma devre dışı
        auctionPasses[auctionCurrent] = true;
        auctionTurns++;

        // Sordum/Konuş sonrası 3. oyuncu konuş sonrası pas derse, ihale 4. oyuncuya 150'ye kalır
        const dealer = window.currentDealer;
        const thirdPlayer = (dealer + 3) % 4; // 3. oyuncu (dağıtıcıdan 3 sonraki)
        const fourthPlayer = dealer; // 4. oyuncu (dağıtıcı)
        
        if (auctionCurrent === thirdPlayer && sordumKonusMode && konusPlayer === fourthPlayer) {
            auctionBids[fourthPlayer] = 150;
            auctionHighestBid = 150;
            auctionWinner = fourthPlayer;
            const player4Name = getPlayerName(fourthPlayer);
            // Not: İstek üzerine sesli okuma devre dışı
            updateAuctionHighestBid();
            sordumKonusMode = false;
            endAuction();
            return;
        }
        // Sordum/Konuş sonrası 4. oyuncu pas derse ihale 3. oyuncuya kalır ve biter
        if (auctionCurrent === fourthPlayer && sordumKonusMode && konusPlayer === fourthPlayer && auctionBids[thirdPlayer] !== null) {
            auctionWinner = thirdPlayer;
            auctionHighestBid = auctionBids[thirdPlayer];
            const player3Name = getPlayerName(thirdPlayer);
            // Not: İstek üzerine sesli okuma devre dışı
            sordumKonusMode = false;
            konusPlayer = null;
            sordumPlayer = null;
            endAuction();
            return;
        }
        auctionCurrent = (auctionCurrent + 1) % 4;
        nextAuctionTurn();
    }
});

// Samandağ Pinaki - Sordum butonu
document.getElementById('sordum-btn').addEventListener('click', () => {
    if (!auctionActive) return;
    
    // Dinamik oyuncu numaraları
    const dealer = window.currentDealer;
    const thirdPlayer = (dealer + 3) % 4; // 3. oyuncu (dağıtıcıdan 3 sonraki)
    
    // Online modda sunucuya bildir
    if (window.isOnlineMode && window.socket && window.currentRoom) {
        // Online modda oyuncu pozisyonunu kontrol et
        let playerId = 0;
        if (window.players && window.players.length > 0) {
            const currentPlayer = window.players.find(p => p.id === window.socket.id);
            if (currentPlayer) {
                playerId = currentPlayer.position;
            }
        }
        
        // Sadece 3. oyuncu sordum diyebilir
        if (playerId !== thirdPlayer) {
            console.log(`Sadece 3. oyuncu (${thirdPlayer}) sordum diyebilir, siz ${playerId}. oyuncusunuz`);
            return;
        }
        console.log('Online modda sordum mesajı gönderiliyor');
        
        window.socket.emit('sordumMessage', {
            roomId: window.currentRoom,
            playerId: playerId
        });
        
        console.log('Sordum mesajı sunucuya gönderildi');
    } else {
        // Offline modda yerel işle
        if (auctionCurrent !== thirdPlayer) {
            console.log(`Sadece 3. oyuncu sordum diyebilir`);
            return;
        }
        
        // Not: İstek üzerine sesli okuma devre dışı
        sordumKonusMode = true;
        sordumPlayer = auctionCurrent;
        auctionTurns++;
        auctionCurrent = (auctionCurrent + 1) % 4; // Sıra 4. oyuncuya geçer
        nextAuctionTurn();
    }
});

// Samandağ Pinaki - Konuş butonu (3. oyuncu için)
document.getElementById('konus-btn').addEventListener('click', () => {
    if (!auctionActive) return;
    
    // Online modda sunucuya bildir
    if (window.isOnlineMode && window.socket && window.currentRoom) {
        console.log('Online modda konuş mesajı gönderiliyor');
        
        // Oyuncu ID'sini bul
        let playerId = 0;
        if (window.players && window.players.length > 0) {
            const currentPlayer = window.players.find(p => p.id === window.socket.id);
            if (currentPlayer) {
                playerId = currentPlayer.position;
            }
        }
        
        window.socket.emit('konusMessage', {
            roomId: window.currentRoom,
            playerId: playerId
        });
        
        console.log('Konuş mesajı sunucuya gönderildi');
    } else {
        // Offline modda yerel işle
        // Dinamik oyuncu numaraları
        const dealer = window.currentDealer;
        const thirdPlayer = (dealer + 3) % 4; // 3. oyuncu (dağıtıcıdan 3 sonraki)
        const fourthPlayer = dealer; // 4. oyuncu (dağıtıcı)
        
        if (auctionCurrent === thirdPlayer && !sordumKonusMode) {
            // 3. oyuncu direkt konuş diyor
            // Not: İstek üzerine sesli okuma devre dışı
            auctionTurns++;
            auctionCurrent = (auctionCurrent + 1) % 4;
            nextAuctionTurn();
        } else if (auctionCurrent === fourthPlayer && sordumKonusMode) {
            // 4. oyuncu 3. oyuncuya konuş diyor
            // Not: İstek üzerine sesli okuma devre dışı
            konusPlayer = auctionCurrent;
            auctionCurrent = thirdPlayer; // Sıra 3. oyuncuya geri döner
            nextAuctionTurn();
        }
    }
});

// Samandağ Pinaki - Boz butonu
document.getElementById('boz-btn').addEventListener('click', () => {
    if (!auctionActive || !sordumKonusMode) return;
    
    // Dinamik oyuncu numaraları
    const dealer = window.currentDealer;
    const fourthPlayer = dealer; // 4. oyuncu (dağıtıcı)
    
    if (auctionCurrent !== fourthPlayer) return;
    // Boz dendiğinde sesli okuma
    // Not: İstek üzerine sesli okuma devre dışı
    
    // İhale durumunu sıfırla
    auctionActive = false;
    
    // İhale ve koz ekranlarını sıfırla
    document.getElementById('auction-controls').style.display = 'none';
    document.getElementById('trump-select').style.display = 'none';
    document.getElementById('auction-status').textContent = 'Kartlar dağıtıldıktan sonra ihale başlayacak.';
    
    // Pota kutusunu temizle
    const potaMessages = document.getElementById('pota-chat-messages');
    const potaInput = document.getElementById('pota-chat-input');
    if (potaMessages) {
        potaMessages.innerHTML = '';
    }
    if (potaInput) {
        potaInput.value = '';
    }
    if (window.potaChatLog) {
        window.potaChatLog = [];
    }
    
    // Skor tablosunu sıfırla (oyuncu ve takım puanlarını 0 yap)
    const tableDiv = document.getElementById('score-table');
    if (tableDiv) {
        let html = '<table style="width:100%;background:#fff;color:#222;border-radius:4px;text-align:center;font-size:14px;border-collapse:collapse;"><tr><th style="padding:4px;border:1px solid #ddd;">Oyuncu</th><th style="padding:4px;border:1px solid #ddd;">Puan</th></tr>';
        for (let i = 0; i < 4; i++) {
            const playerName = getPlayerName(i);
            html += `<tr><td style="padding:4px;border:1px solid #ddd;">${playerName}</td><td style="padding:4px;border:1px solid #ddd;">0</td></tr>`;
        }
        const player1Name = getPlayerName(0);
        const player3Name = getPlayerName(2);
        const player2Name = getPlayerName(1);
        const player4Name = getPlayerName(3);
        html += `<tr style='font-weight:bold;background:#eee;'><td style="padding:4px;border:1px solid #ddd;">Takım 1</td><td style="padding:4px;border:1px solid #ddd;">0</td></tr>`;
        html += `<tr style='font-weight:bold;background:#eee;'><td style="padding:4px;border:1px solid #ddd;">Takım 2</td><td style="padding:4px;border:1px solid #ddd;">0</td></tr>`;
        html += `<tr style='font-weight:bold;background:#ffd700;color:#222;'><td style="padding:4px;border:1px solid #ddd;">Birikimli Takım 1</td><td style="padding:4px;border:1px solid #ddd;">${cumulativeTeam1Score}</td></tr>`;
        html += `<tr style='font-weight:bold;background:#ffd700;color:#222;'><td style="padding:4px;border:1px solid #ddd;">Birikimli Takım 2</td><td style="padding:4px;border:1px solid #ddd;">${cumulativeTeam2Score}</td></tr>`;
        html += '</table>';
        tableDiv.innerHTML = html;
        tableDiv.style.display = '';
    }
    
    // Oyun sonu sonucu sıfırla
    const resultDiv = document.getElementById('endgame-result');
    if (resultDiv) resultDiv.innerHTML = '';
    
    // Sağ alt köşedeki game-result kutusunu gizle
    const gameResultDiv = document.getElementById('game-result');
    if (gameResultDiv) {
        gameResultDiv.style.display = 'none';
    }
    
    // Ard arda boz sayısını artır
    consecutiveBozCount++;
    
    // Eğer 3 kez ard arda boz olduysa, dağıtıcı sırasını değiştir
    if (consecutiveBozCount >= 3) {
        window.currentDealer = (window.currentDealer + 1) % 4;
        consecutiveBozCount = 0; // Sayacı sıfırla
    }
    // 3'ten az boz varsa aynı oyuncu dağıtmaya devam eder
    
    // Tüm oyuncu kutularından parlaklık efektlerini kaldır
    for (let i = 0; i < 4; i++) {
        const playerDiv = document.getElementById(`player${i+1}`);
        if (playerDiv) {
            playerDiv.classList.remove('active-player', 'auction-active');
        }
    }
    
    // Dağıtıcı sırasına göre butonu güncelle
    window.updateDealButton();
    
    // Kartları yeniden dağıt
    let deck = createDeck();
    deck = shuffle(deck);
    const players = dealCards(deck);
    playersGlobal = players;
    playedCards = [];
    team1Tricks = [];
    team2Tricks = [];
    lastTrickWinnerTeam = null;
    renderPlayers(players);
    renderCenterCards();
    
    // İhaleyi sıfırla ve yeniden başlat
    startAuction()
})

// Kartlar dağıtıldıktan sonra ihale başlat
function setupDealButton() {
    const dealBtn = document.getElementById('dealBtn');
    if (dealBtn) {
        dealBtn.addEventListener('click', () => {
            console.log('Kartları dağıt butonuna tıklandı');
            
            // Sadece dağıtma sırası gelen oyuncu kartları dağıtabilir
            if (window.currentPlayer && window.currentPlayer !== window.currentDealer) {
                const dealerName = window.getPlayerName(window.currentDealer);
                // Not: İstek üzerine sesli okuma devre dışı
                return;
            }
            
            // Online modda kart dağıtma mesajı gönder
            if (window.isOnlineMode && window.socket) {
                console.log('Online modda kart dağıtma mesajı gönderiliyor');
                console.log('Room ID:', window.currentRoom);
                console.log('Socket connected:', window.socket.connected);
                
                // dealCardsOnline fonksiyonunu çağır
                if (window.dealCardsOnline) {
                    window.dealCardsOnline();
                } else {
                    console.error('dealCardsOnline fonksiyonu bulunamadı!');
                    window.socket.emit('dealCards', { roomId: window.currentRoom });
                }
                return;
            }
            
            console.log('Offline modda kartlar dağıtılıyor');
            
            // --- EK: Skor ve pota kutusu sıfırlama ---
            // Birikimli puanları sıfırlama - artık saklanıyor
            // cumulativeTeam1Score = 0; // Bu satırı kaldırdık
            // cumulativeTeam2Score = 0; // Bu satırı kaldırdık
            
            // İhale ve koz ekranlarını sıfırla
            document.getElementById('auction-controls').style.display = 'none';
            document.getElementById('trump-select').style.display = 'none';
            document.getElementById('auction-status').textContent = 'Kartlar dağıtıldıktan sonra ihale başlayacak.';
            
            // Pota kutusunu temizle
            const potaMessages = document.getElementById('pota-chat-messages');
            const potaInput = document.getElementById('pota-chat-input');
            if (potaMessages) {
                potaMessages.innerHTML = '';
            }
            if (potaInput) {
                potaInput.value = '';
            }
            if (window.potaChatLog) {
                window.potaChatLog = [];
            }
            
            // Skor tablosunu sıfırla (oyuncu ve takım puanlarını 0 yap)
            const tableDiv = document.getElementById('score-table');
            if (tableDiv) {
                let html = '<table style="width:100%;background:#fff;color:#222;border-radius:4px;text-align:center;font-size:14px;border-collapse:collapse;"><tr><th style="padding:4px;border:1px solid #ddd;">Oyuncu</th><th style="padding:4px;border:1px solid #ddd;">Puan</th></tr>';
                for (let i = 0; i < 4; i++) {
                    const playerName = getPlayerName(i);
                    html += `<tr><td style="padding:4px;border:1px solid #ddd;">${playerName}</td><td style="padding:4px;border:1px solid #ddd;">0</td></tr>`;
                }
                const player1Name = getPlayerName(0);
                const player3Name = getPlayerName(2);
                const player2Name = getPlayerName(1);
                const player4Name = getPlayerName(3);
                html += `<tr style='font-weight:bold;background:#eee;'><td style="padding:4px;border:1px solid #ddd;">Takım 1</td><td style="padding:4px;border:1px solid #ddd;">0</td></tr>`;
                html += `<tr style='font-weight:bold;background:#eee;'><td style="padding:4px;border:1px solid #ddd;">Takım 2</td><td style="padding:4px;border:1px solid #ddd;">0</td></tr>`;
                html += `<tr style='font-weight:bold;background:#ffd700;color:#222;'><td style="padding:4px;border:1px solid #ddd;">Birikimli Takım 1</td><td style="padding:4px;border:1px solid #ddd;">${cumulativeTeam1Score}</td></tr>`;
                html += `<tr style='font-weight:bold;background:#ffd700;color:#222;'><td style="padding:4px;border:1px solid #ddd;">Birikimli Takım 2</td><td style="padding:4px;border:1px solid #ddd;">${cumulativeTeam2Score}</td></tr>`;
                html += '</table>';
                tableDiv.innerHTML = html;
                tableDiv.style.display = '';
            }
            // Oyun sonu sonucu sıfırla
            const resultDiv = document.getElementById('endgame-result');
            if (resultDiv) resultDiv.innerHTML = '';
            // Sağ alt köşedeki game-result kutusunu gizle
            const gameResultDiv = document.getElementById('game-result');
            if (gameResultDiv) {
                gameResultDiv.style.display = 'none';
            }
            // Pota kutusunu temizle
            const potaChatMessages = document.getElementById('pota-chat-messages');
            if (potaChatMessages) potaChatMessages.innerHTML = '';
            if (window.potaChatLog) window.potaChatLog = [];
            // Normal el oynandığında ard arda boz sayısını sıfırla
            consecutiveBozCount = 0;
            // Dağıtıcı sırasını değiştirme - el tamamlanana kadar aynı oyuncu dağıtmalı
            
            // Tüm oyuncu kutularından parlaklık efektlerini kaldır
            for (let i = 0; i < 4; i++) {
                const playerDiv = document.getElementById(`player${i+1}`);
                if (playerDiv) {
                    playerDiv.classList.remove('active-player', 'auction-active');
                }
            }
            
            // --- mevcut kart dağıt kodu ---
            let deck = createDeck();
            deck = shuffle(deck);
            const players = dealCards(deck);
            playersGlobal = players;
            playedCards = [];
            team1Tricks = [];
            team2Tricks = [];
            lastTrickWinnerTeam = null;
            renderPlayers(players);
            renderCenterCards();
            startAuction();
        });
        console.log('Kartları dağıt butonu event listener eklendi');
    } else {
        console.error('dealBtn bulunamadı!');
    }
}

// Oyun sonu puanlaması: Her As ve 10'lu 10 puan, K ve Q 5 puan, son eli alan takım 10 puan
function calculateEndGameScores() {
    function trickPoints(cards) {
        let points = 0;
        for (const c of cards) {
            if (c.rank === 'A' || c.rank === '10') points += 10;
            else if (c.rank === 'K' || c.rank === 'Q') points += 5;
        }
        return points;
    }
    let t1 = trickPoints(team1Tricks);
    let t2 = trickPoints(team2Tricks);
    // Bonus 10 puan sadece son eli kazanan takıma eklenmeli
    if (lastTrickWinnerTeam === 1) t1 += 10;
    else if (lastTrickWinnerTeam === 2) t2 += 10;
    
    // Takımların başlangıç puanlarını score-table'dan çek
    const s1 = parseInt(document.querySelector('#score-table tr:nth-child(2) td:last-child').textContent, 10);
    const s2 = parseInt(document.querySelector('#score-table tr:nth-child(3) td:last-child').textContent, 10);
    const s3 = parseInt(document.querySelector('#score-table tr:nth-child(4) td:last-child').textContent, 10);
    const s4 = parseInt(document.querySelector('#score-table tr:nth-child(5) td:last-child').textContent, 10);
    let team1Start = s1 + s3;
    let team2Start = s2 + s4;
    let kabbut = false;
    let oyunBatti = false;
    let cezaPuan = 0;
    
    // Kabbut kontrolü: ihaleyi kazanan takım tüm elleri aldıysa
    let kazananTakim = null;
    if (auctionWinner === 0 || auctionWinner === 2) kazananTakim = 1;
    if (auctionWinner === 1 || auctionWinner === 3) kazananTakim = 2;
    if (kazananTakim === 1 && t2 === 0) {
        team2Start = 0;
        kabbut = true;
    } else if (kazananTakim === 2 && t1 === 0) {
        team1Start = 0;
        kabbut = true;
    }
    
    let team1Total = team1Start + t1;
    let team2Total = team2Start + t2;
    let teklif = auctionHighestBid;
    
    // Oyun Battı kontrolü
    if (kazananTakim && teklif) {
        if ((kazananTakim === 1 && team1Total < teklif)) {
            oyunBatti = true;
            cezaPuan = teklif;
            team1Start = 0;
            team1Total = -cezaPuan;
        } else if ((kazananTakim === 2 && team2Total < teklif)) {
            oyunBatti = true;
            cezaPuan = teklif;
            team2Start = 0;
            team2Total = -cezaPuan;
        }
    }
    
    // Birikimli puanları güncelle - her iki takımın da toplam puanları biriktirilir
    if (oyunBatti) {
        // Oyun battığında, battan takımın birikimli puanından ihale teklif puanı çıkarılır
        if (kazananTakim === 1) {
            cumulativeTeam1Score -= cezaPuan;
        } else if (kazananTakim === 2) {
            cumulativeTeam2Score -= cezaPuan;
        }
        // Diğer takımın puanı normal şekilde biriktirilir
        if (kazananTakim === 1) {
            cumulativeTeam2Score += team2Total;
        } else if (kazananTakim === 2) {
            cumulativeTeam1Score += team1Total;
        }
    } else {
        // Normal durumda her iki takımın da toplam puanlarını biriktir
        cumulativeTeam1Score += team1Total;
        cumulativeTeam2Score += team2Total;
    }
    
    // 2000 puana ulaşma kontrolü
    let gameWinner = null;
    if (cumulativeTeam1Score >= 2000) {
        gameWinner = 1;
    } else if (cumulativeTeam2Score >= 2000) {
        gameWinner = 2;
    }
    
    // Sonucu ekrana yaz
    const resultDiv = document.getElementById('endgame-result');
    resultDiv.innerHTML = `Oyun Sonu Sonuçları:<br>
    Takım 1: <b>${t1}</b> puan<br>
    Takım 2: <b>${t2}</b> puan<br>
    1. Takımın Toplam Puanı: <b>${team1Start} + ${t1} = ${team1Total}</b><br>
    2. Takımın Toplam Puanı: <b>${team2Start} + ${t2} = ${team2Total}</b><br>
    <br><strong>Birikimli Puanlar:</strong><br>
    Takım 1: <b>${cumulativeTeam1Score}</b> puan<br>
    Takım 2: <b>${cumulativeTeam2Score}</b> puan`
    + (kabbut ? `<br><span style='color:#ff4444;font-weight:bold;'>Kabbut! Rakip takımın puanı sıfırlandı.</span>` : '')
    + (oyunBatti ? `<br><span style='color:#ff2222;font-weight:bold;'>Oyun Battı! Takımın puanı sıfırlandı ve -${cezaPuan} ceza puanı verildi.</span>` : '')
    + (gameWinner ? `<br><span style='color:#00ff00;font-weight:bold;font-size:24px;'>🎉 TAKIM ${gameWinner} OYUNU KAZANDI! 🎉</span>` : '');

    // Sonucu sağ alt köşeye yaz
    const gameResultDiv = document.getElementById('game-result');
    if (gameResultDiv) {
        if (gameWinner) {
            gameResultDiv.textContent = `Takım ${gameWinner} oyunu kazandı!`;
            gameResultDiv.style.display = '';
        } else if (kazananTakim && teklif) {
            if (oyunBatti) {
                gameResultDiv.textContent = 'Oyun Battı!';
            } else if (team1Total >= teklif && kazananTakim === 1) {
                gameResultDiv.textContent = 'Oyunu kazandınız.';
            } else if (team2Total >= teklif && kazananTakim === 2) {
                gameResultDiv.textContent = 'Oyunu kazandınız.';
            } else {
                gameResultDiv.textContent = 'Oyunu kaybettiniz.';
            }
            gameResultDiv.style.display = '';
        } else {
            gameResultDiv.style.display = 'none';
        }
    }
    
    // Sonuç tablosunu görünür yap
    document.getElementById('score-table').style.display = '';

    // --- EK: Pota kutusunu ve skor tablosunu sıfırla ---
    // Pota kutusunu temizle
    const potaChatMessages = document.getElementById('pota-chat-messages');
    if (potaChatMessages) potaChatMessages.innerHTML = '';
    if (window.potaChatLog) window.potaChatLog = [];
    // Skor tablosunu sıfırla (oyuncu ve takım puanlarını 0 yap)
    const tableDiv = document.getElementById('score-table');
    if (tableDiv) {
        let html = '<table style="width:100%;background:#fff;color:#222;border-radius:4px;text-align:center;font-size:14px;border-collapse:collapse;"><tr><th style="padding:4px;border:1px solid #ddd;">Oyuncu</th><th style="padding:4px;border:1px solid #ddd;">Puan</th></tr>';
        for (let i = 0; i < 4; i++) {
            html += `<tr><td style="padding:4px;border:1px solid #ddd;">Oyuncu ${i+1}</td><td style="padding:4px;border:1px solid #ddd;">0</td></tr>`;
        }
        html += `<tr style='font-weight:bold;background:#eee;'><td style="padding:4px;border:1px solid #ddd;">Takım 1</td><td style="padding:4px;border:1px solid #ddd;">0</td></tr>`;
        html += `<tr style='font-weight:bold;background:#eee;'><td style="padding:4px;border:1px solid #ddd;">Takım 2</td><td style="padding:4px;border:1px solid #ddd;">0</td></tr>`;
        html += '</table>';
        tableDiv.innerHTML = html;
    }
    
    // Normal el oynandığında ard arda boz sayısını sıfırla
    consecutiveBozCount = 0;
    // Dağıtıcı sırasını değiştir (bir sonraki oyuncu dağıtacak)
    window.currentDealer = (window.currentDealer + 1) % 4;
    
    // Oyun bittiğinde oyun durumunu sıfırla ki buton aktif olsun
    window.currentPlayer = null;
    auctionActive = false;
    
    window.updateDealButton(); // Dağıtıcı sırasına göre butonu güncelle
}

// Bot kontrol fonksiyonu
function setupBotControls() {
    const botButtons = document.querySelectorAll('.bot-btn');
    
    botButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const playerId = parseInt(this.getAttribute('data-player'));
            const isBot = this.textContent.includes('Bot');
            
            if (isBot) {
                // Bot'u devre dışı bırak
                window.botManager.deactivateBot(playerId);
                this.textContent = `Oyuncu ${playerId + 1}: İnsan`;
                this.style.background = '#4CAF50';
            } else {
                // Bot'u aktifleştir
                window.botManager.createBot(playerId);
                this.textContent = `Oyuncu ${playerId + 1}: Bot`;
                this.style.background = '#f44336';
            }
        });
    });
}

// Global speakText fonksiyonu
function speakText(text) {
    if ('speechSynthesis' in window) {
        const utter = new window.SpeechSynthesisUtterance(text);
        utter.lang = 'tr-TR';
        window.speechSynthesis.speak(utter);
    }
}

// Oyuncu numarasını gerçek isimle değiştir
window.getPlayerName = function(playerIndex) {
    if (window.players && window.players[playerIndex]) {
        return window.players[playerIndex].name;
    }
    return `Oyuncu ${playerIndex + 1}`;
}

// Dağıtıcı sırasına göre "Kart Dağıt" butonunu güncelle
window.updateDealButton = function() {
    const dealBtn = document.getElementById('dealBtn');
    if (dealBtn) {
        // Sadece dağıtıcı sırası gelen oyuncu butona basabilir
        const dealerName = window.getPlayerName(window.currentDealer);
        dealBtn.textContent = `Kartları Dağıt (${dealerName})`;
        dealBtn.title = `Sadece ${dealerName} kartları dağıtabilir`;
        
        // Butonun stilini oyun durumuna göre ayarla
        if (auctionActive === true || (typeof window.currentPlayer !== 'undefined' && window.currentPlayer !== null && window.currentPlayer !== undefined)) {
            // İhale aktifse veya oyun devam ediyorsa buton devre dışı
            dealBtn.disabled = true;
            dealBtn.style.opacity = '0.5';
            dealBtn.style.cursor = 'not-allowed';
            dealBtn.style.display = 'none'; // Navbar'da gizle
        } else {
            // Oyun başlamamışsa buton aktif
            dealBtn.disabled = false;
            dealBtn.style.opacity = '1';
            dealBtn.style.cursor = 'pointer';
            dealBtn.style.display = 'block'; // Navbar'da göster
            
            // Eğer dağıtıcı bot ise, otomatik kart dağıt
            if (window.botManager && window.botManager.isBotActive(window.currentDealer)) {
                setTimeout(() => {
                    botDealCards();
                }, 2000); // 2 saniye bekle
            }
        }
    }
}

window.onload = function() {
    console.log('[script.js] onload çalıştı, window fonksiyonları atanıyor')
    // Online modda ise bu fonksiyonları çalıştırma
    if (window.isOnlineMode) {
        console.log('Online mod aktif, script.js onload fonksiyonları atlanıyor');
        return;
    }
    
    console.log('Offline mod aktif, script.js onload fonksiyonları çalıştırılıyor');
    
    // Kartları dağıt butonunu ayarla
    setupDealButton();
    
    // Butonu zorla görünür hale getir
    const dealBtn = document.getElementById('dealBtn');
    if (dealBtn) {
        dealBtn.style.display = 'block';
        dealBtn.style.visibility = 'visible';
        // Buton metnini güncelle
        const dealerName = window.getPlayerName(window.currentDealer);
        dealBtn.textContent = `Kartları Dağıt (${dealerName})`;
        dealBtn.title = `Sadece ${dealerName} kartları dağıtabilir`;
    }
    
    // Bot kontrol butonları
    setupBotControls();
    
    // Teklif verme butonu
    setupBidButton();
    
    // Pota iletişim kutusu işlevselliği
    const potaChatMessages = document.getElementById('pota-chat-messages');
    const potaChatInput = document.getElementById('pota-chat-input');
    const potaChatSend = document.getElementById('pota-chat-send');
    window.potaChatLog = [];

    function getCurrentPlayerNumber() {
        if (typeof auctionActive !== 'undefined' && auctionActive) return auctionCurrent + 1;
        if (typeof window.currentPlayer !== 'undefined' && window.currentPlayer !== null) return window.currentPlayer + 1;
        return '?';
    }

    window.addPotaMessage = function(msg, playerNum) {
        // Pota chat log'unu başlat (eğer yoksa)
        if (!window.potaChatLog) {
            window.potaChatLog = [];
        }
        
        window.potaChatLog.push({msg, playerNum});
        const lastMsgs = window.potaChatLog.slice(-10);
        potaChatMessages.innerHTML = lastMsgs.map(m => `<div><b>${m.playerNum}:</b> ${m.msg}</div>`).join('');
        potaChatMessages.scrollTop = potaChatMessages.scrollHeight;
        
        // Sesli okuma burada yapılmıyor - sadece mesaj ekleniyor
    }

    potaChatSend.addEventListener('click', () => {
        const text = potaChatInput.value.trim();
        if (!text) return;
        
        console.log('Pota mesajı gönderiliyor:', text);
        console.log('Online mod:', window.isOnlineMode);
        console.log('Socket var mı:', !!window.socket);
        console.log('Current room:', window.currentRoom);
        
        const playerNum = getCurrentPlayerNumber();
        
        // Online modda sunucuya gönder
        if (window.isOnlineMode && window.socket && window.currentRoom) {
            console.log('Online modda pota mesajı gönderiliyor');
            
            // Oyuncu ID'sini bul
            let playerId = 0;
            if (window.players && window.players.length > 0) {
                const currentPlayer = window.players.find(p => p.id === window.socket.id);
                if (currentPlayer) {
                    playerId = currentPlayer.position;
                }
            }
            
            console.log('Oyuncu ID:', playerId);
            
            // Kontrolleri gizleme mantığı sunucu tarafında yapılacak
            
            window.socket.emit('potaMessage', {
                roomId: window.currentRoom,
                message: text,
                playerId: playerId
            });
            
            console.log('Pota mesajı sunucuya gönderildi');
            
            // Sadece mesajı gönderen oyuncu için sesli okuma
            if (window.speakText) {
                // Oyuncu ismini bul
                let playerName = `Oyuncu ${playerId + 1}`;
                if (window.players && window.players.length > 0) {
                    const currentPlayer = window.players.find(p => p.id === window.socket.id);
                    if (currentPlayer) {
                        playerName = currentPlayer.name;
                    }
                }
                // Not: İstek üzerine sesli okuma devre dışı
            }
        } else {
            console.log('Offline modda pota mesajı işleniyor');
            
            // Offline modda yerel işle
            addPotaMessage(text, playerNum);
            // Not: İstek üzerine sesli okuma devre dışı
            
            // Koz belirlenmeden önce oyun akışını etkilesin, belirlendikten sonra sadece sohbet olsun
            if (trumpSuit === null) {
                // Koz belirlenmeden önce: sıra değişsin
                if (typeof auctionActive !== 'undefined' && auctionActive) {
                    auctionTurns++;
                    auctionCurrent = (auctionCurrent + 1) % 4;
                    nextAuctionTurn();
                } else if (typeof window.currentPlayer !== 'undefined' && window.currentPlayer !== null) {
                    window.currentPlayer = (window.currentPlayer + 1) % 4;
                    renderPlayersWithClick(window.currentPlayer);
                }
            }
        }
        
        potaChatInput.value = '';
        potaChatInput.focus();
        // Koz belirlendikten sonra sadece sohbet amaçlı, oyuncu sırasını etkilemez
    });

    // Enter tuşu ile de mesaj gönder
    potaChatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            potaChatSend.click();
        }
    });

};

// Global fonksiyonları window objesine ekle (her zaman erişilebilir olmalı)
window.renderCenterCards = renderCenterCards;
window.renderPlayersWithClick = renderPlayersWithClick;
window.getPlayerName = getPlayerName;
window.addPotaMessage = addPotaMessage;
window.startAuction = startAuction;
window.renderPlayers = renderPlayers;
window.calculateAndShowScores = calculateAndShowScores;
window.speakText = speakText;
window.nextAuctionTurn = nextAuctionTurn;
window.endAuction = endAuction;
window.showTrumpSelect = showTrumpSelect;
window.hideTrumpSelect = hideTrumpSelect;
window.enableFirstPlay = enableFirstPlay;
console.log('[script.js] global fonksiyonlar expose edildi', {
  hasRenderPlayers: typeof window.renderPlayers === 'function',
  hasRenderCenterCards: typeof window.renderCenterCards === 'function'
})