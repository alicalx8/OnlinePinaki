// Pinaki Bot Sistemi
class PinakiBot {
    constructor(playerId) {
        this.playerId = playerId;
        this.name = `Bot ${playerId}`;
    }

    // Bot kart oynama stratejisi
    playCard(hand, leadSuit, trumpSuit, playedCards) {
        if (!hand || hand.length === 0) return null;

        // Eğer ilk oyuncuysa, en yüksek kartı oyna
        if (playedCards.length === 0) {
            return this.getHighestCard(hand);
        }

        // Masada koz var mı kontrol et
        const trumpPlayed = playedCards.some(pc => pc.card.suit === trumpSuit);
        const highestTrump = this.getHighestTrump(playedCards, trumpSuit);

        // Elinde açılan renk var mı?
        const hasLeadSuit = hand.some(card => card.suit === leadSuit);
        
        if (hasLeadSuit) {
            // Açılan rengi oyna
            const leadCards = hand.filter(card => card.suit === leadSuit);
            
            // Eğer masada koz varsa ve elinde daha yüksek koz yoksa, en düşük kartı oyna
            if (trumpPlayed && trumpSuit) {
                const hasHigherTrump = leadCards.some(card => 
                    card.suit === trumpSuit && this.isHigherCard(card, highestTrump)
                );
                if (!hasHigherTrump) {
                    return this.getLowestCard(leadCards);
                }
            }
            
            // En yüksek kartı oyna
            return this.getHighestCard(leadCards);
        } else {
            // Açılan renk yoksa
            if (trumpSuit && hand.some(card => card.suit === trumpSuit)) {
                // Koz varsa koz oyna
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
                return this.getHighestCard(trumpCards);
            } else {
                // Koz da yoksa en düşük kartı oyna
                return this.getLowestCard(hand);
            }
        }
    }

    // Bot ihale teklifi stratejisi
    makeBid(currentHighestBid, hand, trumpSuit) {
        // Basit strateji: Elindeki kartlara göre teklif ver
        const handValue = this.calculateHandValue(hand, trumpSuit);
        
        if (handValue > 200) {
            return Math.max(currentHighestBid + 10, 200);
        } else if (handValue > 150) {
            return Math.max(currentHighestBid + 10, 150);
        }
        
        return null; // Pas geç
    }

    // Bot koz seçimi stratejisi
    selectTrump(hand) {
        const suitCounts = { '♥': 0, '♠': 0, '♦': 0, '♣': 0 };
        const suitValues = { '♥': 0, '♠': 0, '♦': 0, '♣': 0 };
        
        // Her renkteki kart sayısını ve değerini hesapla
        hand.forEach(card => {
            suitCounts[card.suit]++;
            suitValues[card.suit] += this.getCardValue(card);
        });
        
        // En çok kartı olan ve en yüksek değere sahip rengi seç
        let bestSuit = '♥';
        let bestScore = suitCounts['♥'] * 10 + suitValues['♥'];
        
        ['♠', '♦', '♣'].forEach(suit => {
            const score = suitCounts[suit] * 10 + suitValues[suit];
            if (score > bestScore) {
                bestScore = score;
                bestSuit = suit;
            }
        });
        
        return bestSuit;
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

    calculateHandValue(hand, trumpSuit) {
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
        const bot = this.bots.get(playerId);
        if (!bot || !this.isBotActive(playerId)) return null;
        
        return bot.makeBid(currentHighestBid, hand, trumpSuit);
    }

    // Bot'un koz seçimi
    botSelectTrump(playerId, hand) {
        const bot = this.bots.get(playerId);
        if (!bot || !this.isBotActive(playerId)) return null;
        
        return bot.selectTrump(hand);
    }
}

// Global bot yöneticisi
window.botManager = new BotManager(); 