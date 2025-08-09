// Pinaki Bot Sistemi
class PinakiBot {
    constructor(playerId) {
        this.playerId = playerId;
        this.name = `Bot ${playerId}`;
        this.gameHistory = []; // Oyun geçmişi
        this.partnerId = (playerId + 2) % 4; // Partner ID (2 pozisyon sonra)
    }

    // Bot kart oynama stratejisi - Geliştirilmiş versiyon
    playCard(hand, leadSuit, trumpSuit, playedCards) {
        if (!hand || hand.length === 0) return null;

        // Oyun geçmişini güncelle
        this.updateGameHistory(playedCards);

        // Eğer ilk oyuncuysa, stratejik kart seç
        if (playedCards.length === 0) {
            return this.selectLeadCard(hand, trumpSuit);
        }

        // Masada koz var mı kontrol et
        const trumpPlayed = playedCards.some(pc => pc.card.suit === trumpSuit);
        const highestTrump = this.getHighestTrump(playedCards, trumpSuit);
        const currentWinner = this.getCurrentWinner(playedCards, trumpSuit);

        // Elinde açılan renk var mı?
        const hasLeadSuit = hand.some(card => card.suit === leadSuit);
        
        if (hasLeadSuit) {
            return this.playLeadSuit(hand, leadSuit, trumpPlayed, highestTrump, currentWinner, playedCards);
        } else {
            return this.playNonLeadSuit(hand, trumpSuit, trumpPlayed, highestTrump, currentWinner, playedCards);
        }
    }

    // İlk kart seçimi - stratejik
    selectLeadCard(hand, trumpSuit) {
        // El değerini hesapla
        const handValue = this.calculateHandValue(hand, trumpSuit);
        
        // Oyun sonu stratejisi
        const shouldBeAggressive = this.shouldPlayAggressively(hand, this.gameHistory.flat());
        
        // Eğer el güçlüyse veya agresif oynamalıysa, en yüksek kartı oyna
        if (handValue > 200 || shouldBeAggressive) {
            return this.getHighestCard(hand);
        }
        
        // Eğer el zayıfsa, en düşük kartı oyna
        if (handValue < 100) {
            return this.getLowestCard(hand);
        }
        
        // Orta güçteyse, koz renginde kart varsa onu oyna
        if (trumpSuit && hand.some(card => card.suit === trumpSuit)) {
            const trumpCards = hand.filter(card => card.suit === trumpSuit);
            return this.getHighestCard(trumpCards);
        }
        
        // En yüksek kartı oyna
        return this.getHighestCard(hand);
    }

    // Açılan rengi oynama stratejisi
    playLeadSuit(hand, leadSuit, trumpPlayed, highestTrump, currentWinner, playedCards) {
        const leadCards = hand.filter(card => card.suit === leadSuit);
        
        // Partner kazanıyor mu?
        const isPartnerWinning = currentWinner === this.partnerId;
        
        // Oyun sonu stratejisi
        const shouldBeAggressive = this.shouldPlayAggressively(hand, this.gameHistory.flat());
        
        // Eğer partner kazanıyorsa ve masada koz yoksa, en düşük kartı oyna
        if (isPartnerWinning && !trumpPlayed) {
            return this.getLowestCard(leadCards);
        }
        
        // Eğer masada koz varsa
        if (trumpPlayed && trumpSuit) {
            const hasHigherTrump = leadCards.some(card => 
                card.suit === trumpSuit && this.isHigherCard(card, highestTrump)
            );
            
            // Eğer daha yüksek koz yoksa ve partner kazanmıyorsa, en düşük kartı oyna
            if (!hasHigherTrump && !isPartnerWinning) {
                return this.getLowestCard(leadCards);
            }
            
            // Eğer daha yüksek koz varsa, en yüksek kartı oyna
            if (hasHigherTrump) {
                return this.getHighestCard(leadCards.filter(card => 
                    card.suit === trumpSuit && this.isHigherCard(card, highestTrump)
                ));
            }
        }
        
        // Oyun sonu stratejisi: agresif oynamalıysa en yüksek kartı oyna
        if (shouldBeAggressive) {
            return this.getHighestCard(leadCards);
        }
        
        // Normal durumda en yüksek kartı oyna
        return this.getHighestCard(leadCards);
    }

    // Açılan rengi olmayan durumda oynama stratejisi
    playNonLeadSuit(hand, trumpSuit, trumpPlayed, highestTrump, currentWinner, playedCards) {
        // Partner kazanıyor mu?
        const isPartnerWinning = currentWinner === this.partnerId;
        
        // Oyun sonu stratejisi
        const shouldBeAggressive = this.shouldPlayAggressively(hand, this.gameHistory.flat());
        
        // Eğer partner kazanıyorsa, en düşük kartı oyna
        if (isPartnerWinning) {
            return this.getLowestCard(hand);
        }
        
        // Koz varsa koz oyna
        if (trumpSuit && hand.some(card => card.suit === trumpSuit)) {
            const trumpCards = hand.filter(card => card.suit === trumpSuit);
            
            if (trumpPlayed) {
                // Masada koz varsa, daha yüksek koz varsa oyna
                const higherTrumps = trumpCards.filter(card => 
                    this.isHigherCard(card, highestTrump)
                );
                if (higherTrumps.length > 0) {
                    return this.getHighestCard(higherTrumps);
                }
            }
            
            // Oyun sonu stratejisi: agresif oynamalıysa en yüksek kozu oyna
            if (shouldBeAggressive) {
                return this.getHighestCard(trumpCards);
            }
            
            // En yüksek kozu oyna
            return this.getHighestCard(trumpCards);
        }
        
        // Koz da yoksa, oyun sonu stratejisine göre karar ver
        if (shouldBeAggressive) {
            return this.getHighestCard(hand);
        }
        
        // En düşük kartı oyna
        return this.getLowestCard(hand);
    }

    // Oyun geçmişini güncelle
    updateGameHistory(playedCards) {
        if (playedCards.length === 4) {
            this.gameHistory.push([...playedCards]);
        }
    }

    // Şu anki kazananı bul
    getCurrentWinner(playedCards, trumpSuit) {
        if (playedCards.length === 0) return null;
        
        const leadSuit = playedCards[0].card.suit;
        let bestIdx = 0;
        let bestCard = playedCards[0].card;
        
        for (let i = 1; i < playedCards.length; i++) {
            const c = playedCards[i].card;
            
            // Önce koz var mı bak
            if (trumpSuit && c.suit === trumpSuit && bestCard.suit !== trumpSuit) {
                bestIdx = i;
                bestCard = c;
            } else if (c.suit === bestCard.suit) {
                // Aynı renktense büyüklüğe bak
                if (this.isHigherCard(c, bestCard)) {
                    bestIdx = i;
                    bestCard = c;
                }
            }
        }
        
        return playedCards[bestIdx].player;
    }

    // Bot ihale teklifi stratejisi - Geliştirilmiş
    makeBid(currentHighestBid, hand, trumpSuit) {
        // El değerini hesapla
        const handValue = this.calculateHandValue(hand, trumpSuit);
        const trumpCount = trumpSuit ? hand.filter(card => card.suit === trumpSuit).length : 0;
        const highCardCount = hand.filter(card => card.rank === 'A' || card.rank === '10').length;
        
        // Tahmini el sayısını hesapla
        const estimatedTricks = this.estimateTricksAdvanced(hand, trumpSuit);
        
        // Teklif hesaplama
        let bid = 150; // Minimum teklif
        
        // El değerine göre artır
        if (handValue > 250) bid += 50;
        else if (handValue > 200) bid += 40;
        else if (handValue > 150) bid += 30;
        
        // Koz sayısına göre artır
        if (trumpCount >= 6) bid += 30;
        else if (trumpCount >= 4) bid += 20;
        
        // Yüksek kart sayısına göre artır
        if (highCardCount >= 6) bid += 30;
        else if (highCardCount >= 4) bid += 20;
        
        // Tahmini el sayısına göre artır
        bid += estimatedTricks * 15;
        
        // 10'luk yuvarla
        bid = Math.floor(bid / 10) * 10;
        
        // Minimum ve maksimum sınırlar
        bid = Math.max(150, Math.min(300, bid));
        
        // Mevcut en yüksek tekliften daha yüksek olmalı
        if (currentHighestBid && bid <= currentHighestBid) {
            return null; // Pas geç
        }
        
        return bid;
    }

    // Bot koz seçimi stratejisi - Geliştirilmiş
    selectTrump(hand) {
        const suitCounts = { '♥': 0, '♠': 0, '♦': 0, '♣': 0 };
        const suitValues = { '♥': 0, '♠': 0, '♦': 0, '♣': 0 };
        const suitHighCards = { '♥': 0, '♠': 0, '♦': 0, '♣': 0 };
        
        // Her renkteki kart sayısını, değerini ve yüksek kart sayısını hesapla
        hand.forEach(card => {
            suitCounts[card.suit]++;
            suitValues[card.suit] += this.getCardValue(card);
            if (card.rank === 'A' || card.rank === '10') {
                suitHighCards[card.suit]++;
            }
        });
        
        // En iyi rengi seç (kart sayısı + değer + yüksek kart bonusu)
        let bestSuit = '♥';
        let bestScore = this.calculateSuitScore(suitCounts['♥'], suitValues['♥'], suitHighCards['♥']);
        
        ['♠', '♦', '♣'].forEach(suit => {
            const score = this.calculateSuitScore(suitCounts[suit], suitValues[suit], suitHighCards[suit]);
            if (score > bestScore) {
                bestScore = score;
                bestSuit = suit;
            }
        });
        
        return bestSuit;
    }

    // Renk skoru hesaplama
    calculateSuitScore(count, value, highCards) {
        return count * 15 + value + highCards * 20;
    }

    // Gelişmiş el tahmini
    estimateTricksAdvanced(hand, trumpSuit) {
        if (!hand) return 0;
        
        let tricks = 0;
        
        // As ve 10'lar için
        const highCards = hand.filter(card => card.rank === 'A' || card.rank === '10');
        tricks += highCards.length * 0.8; // %80 ihtimalle el kazanır
        
        // Koz kartları için
        if (trumpSuit) {
            const trumpCards = hand.filter(card => card.suit === trumpSuit);
            tricks += trumpCards.length * 0.6; // %60 ihtimalle el kazanır
        }
        
        // K ve Q için
        const mediumCards = hand.filter(card => card.rank === 'K' || card.rank === 'Q');
        tricks += mediumCards.length * 0.4; // %40 ihtimalle el kazanır
        
        return Math.min(10, Math.floor(tricks));
    }

    // Oyun sonu stratejisi - kalan kart sayısına göre
    shouldPlayAggressively(hand, playedCards) {
        if (!hand) return false;
        
        // Eğer çok az kart kaldıysa agresif oyna
        if (hand.length <= 3) return true;
        
        // Eğer çok fazla kart kaldıysa muhafazakar oyna
        if (hand.length >= 8) return false;
        
        // Orta seviyede kart varsa duruma göre karar ver
        return this.calculateHandValue(hand) > 150;
    }

    // Kart sayma - hangi kartların oynandığını takip et
    getRemainingCards(playedCards) {
        const remaining = new Set();
        
        // Tüm kartları ekle
        const suits = ['♥', '♠', '♦', '♣'];
        const ranks = ['9', '10', 'J', 'Q', 'K', 'A'];
        
        for (const suit of suits) {
            for (const rank of ranks) {
                remaining.add(`${rank}${suit}`);
            }
        }
        
        // Oynanan kartları çıkar
        playedCards.forEach(play => {
            if (play && play.card) {
                remaining.delete(`${play.card.rank}${play.card.suit}`);
            }
        });
        
        return Array.from(remaining);
    }

    // Yardımcı fonksiyonlar
    getHighestCard(cards) {
        if (!cards || cards.length === 0) return null;
        
        const rankOrder = ['A', '10', 'K', 'Q', 'J', '9'];
        return cards.reduce((highest, current) => {
            const highestRank = rankOrder.indexOf(highest.rank);
            const currentRank = rankOrder.indexOf(current.rank);
            return currentRank < highestRank ? current : highest;
        });
    }

    getLowestCard(cards) {
        if (!cards || cards.length === 0) return null;
        
        const rankOrder = ['A', '10', 'K', 'Q', 'J', '9'];
        return cards.reduce((lowest, current) => {
            const lowestRank = rankOrder.indexOf(lowest.rank);
            const currentRank = rankOrder.indexOf(current.rank);
            return currentRank > lowestRank ? current : lowest;
        });
    }

    isHigherCard(card1, card2) {
        if (!card2) return true;
        
        const rankOrder = ['A', '10', 'K', 'Q', 'J', '9'];
        const rank1 = rankOrder.indexOf(card1.rank);
        const rank2 = rankOrder.indexOf(card2.rank);
        return rank1 < rank2;
    }

    getHighestTrump(playedCards, trumpSuit) {
        const trumpCards = playedCards
            .filter(pc => pc.card.suit === trumpSuit)
            .map(pc => pc.card);
        
        if (trumpCards.length === 0) return null;
        return this.getHighestCard(trumpCards);
    }

    calculateHandValue(hand, trumpSuit = null) {
        let value = 0;
        const rankValues = { 'A': 10, '10': 10, 'K': 5, 'Q': 5, 'J': 0, '9': 0 };
        
        hand.forEach(card => {
            value += rankValues[card.rank] || 0;
        });
        
        // Koz rengindeki kartlara bonus ver
        if (trumpSuit) {
            const trumpCards = hand.filter(card => card.suit === trumpSuit);
            value += trumpCards.length * 5;
        }
        
        return value;
    }

    getCardValue(card) {
        const rankValues = { 'A': 10, '10': 10, 'K': 5, 'Q': 5, 'J': 0, '9': 0 };
        return rankValues[card.rank] || 0;
    }
}

// Bot yöneticisi
class BotManager {
    constructor() {
        this.bots = new Map();
        this.activeBots = new Set();
    }

    // Bot oluştur
    createBot(playerId) {
        const bot = new PinakiBot(playerId);
        this.bots.set(playerId, bot);
        this.activeBots.add(playerId);
        return bot;
    }

    // Bot'u devre dışı bırak
    deactivateBot(playerId) {
        this.activeBots.delete(playerId);
    }

    // Bot aktif mi?
    isBotActive(playerId) {
        return this.activeBots.has(playerId);
    }

    // Bot'un kart oynaması
    botPlayCard(playerId, hand, leadSuit, trumpSuit, playedCards) {
        const bot = this.bots.get(playerId);
        if (!bot || !this.isBotActive(playerId)) return null;
        
        return bot.playCard(hand, leadSuit, trumpSuit, playedCards);
    }

    // Bot'un ihale teklifi vermesi
    botMakeBid(playerId, currentHighestBid, hand, trumpSuit) {
        // Özel teklif kuralı: başlangıç puanı + (alabileceği el sayısı*20) + 30
        // Basitleştirme: başlangıç puanını mevcut el puan hesabından çıkar, alabileceği el sayısını kaba tahmin et
        const basePoints = this.calculateStartPoints(hand, trumpSuit);
        const tricksPotential = this.estimateTricks(hand, trumpSuit);
        const proposed = basePoints + tricksPotential * 20 + 30;
        const bid = Math.floor(proposed / 10) * 10; // 10'luk yuvarla

        if (bid < 150 || (currentHighestBid && bid <= currentHighestBid)) return null;
        return bid;
    }

    calculateStartPoints(hand, trumpSuit) {
        if (!hand) return 0;
        const rankValues = { 'A': 10, '10': 10, 'K': 5, 'Q': 5, 'J': 0, '9': 0 };
        let value = 0;
        for (const c of hand) value += rankValues[c.rank] || 0;
        if (trumpSuit) value += hand.filter(c => c.suit === trumpSuit).length * 5;
        return value;
    }

    estimateTricks(hand, trumpSuit) {
        if (!hand) return 0;
        // Gelişmiş el tahmini kullan
        return this.estimateTricksAdvanced(hand, trumpSuit);
    }

    // Bot'un koz seçimi
    botSelectTrump(playerId, hand) {
        const bot = this.bots.get(playerId);
        if (!bot || !this.isBotActive(playerId)) return null;
        
        return bot.selectTrump(hand);
    }

    // Gelişmiş el tahmini (BotManager için)
    estimateTricksAdvanced(hand, trumpSuit) {
        if (!hand) return 0;
        
        let tricks = 0;
        
        // As ve 10'lar için
        const highCards = hand.filter(card => card.rank === 'A' || card.rank === '10');
        tricks += highCards.length * 0.8; // %80 ihtimalle el kazanır
        
        // Koz kartları için
        if (trumpSuit) {
            const trumpCards = hand.filter(card => card.suit === trumpSuit);
            tricks += trumpCards.length * 0.6; // %60 ihtimalle el kazanır
        }
        
        // K ve Q için
        const mediumCards = hand.filter(card => card.rank === 'K' || card.rank === 'Q');
        tricks += mediumCards.length * 0.4; // %40 ihtimalle el kazanır
        
        return Math.min(10, Math.floor(tricks));
    }
}

// Global bot yöneticisi
window.botManager = new BotManager(); 