// ==================== PACK OPENING SYSTEM ====================

export const createPackOpeningSystem = (deps) => {
    
    
    const RARITY_ORDER = JSON.parse(localStorage.getItem('customRarityOrder') || 'null') || ['N','P','M','R','SR','M+SR','P+SR','UR','P+UR','UL','GR','PG','CR','HR','SE','GSE','EXSE','P+SE','PSE','QCSE','20th','10000th','GMR'];
    
    // ---- レアリティ演出設定 ----
    // すべての効果を overlay div として .card-image-container 内に注入
    // → イラストフレームのみに演出が表示される
    const FX_WATERMARK = { '20th': '20th', '25th': '25th' };
    
    let rarityEffectSettings = {};
    try {
        rarityEffectSettings = JSON.parse(localStorage.getItem('rarityEffectSettings') || '{}');
    } catch { rarityEffectSettings = {}; }
    
    function buildEffectHtml(rarity) {
        const effects = (rarityEffectSettings[rarity] || []).filter(e => e !== 'normal');
        if (effects.length === 0) return { outerClasses: '', overlayHtml: '' };
    
        const overlayDivs = effects
            .map(e => `<div class="rarity-fx-overlay rarity-fx-${e}"></div>`)
            .join('');
    
        const wmEffect = effects.find(e => FX_WATERMARK[e]);
        const watermarkDiv = wmEffect
            ? `<div class="rarity-fx-watermark wm-${wmEffect}">${FX_WATERMARK[wmEffect]}</div>`
            : '';
    
        return { outerClasses: '', overlayHtml: overlayDivs + watermarkDiv };
    }
    const RARITY_WEIGHTS = {
        'N': 1000, 'P': 800, 'M': 600, 'R': 400, 'SR': 200,
        'M+SR': 150, 'P+SR': 120, 'UR': 100, 'P+UR': 80, 'UL': 60,
        'GR': 40, 'PG': 30, 'CR': 20, 'HR': 15, 'SE': 10,
        'GSE': 7, 'EXSE': 5, 'P+SE': 4, 'PSE': 3, 'QCSE': 2,
        '20th': 1.5, '10000th': 1, 'GMR': 0.5
    };
    const PACK_DEFAULT_WEIGHT = 500;
    
    let packOverlayOpen = false;
    let packCards = [];
    let packFlippedCount = 0;
    
    function buildCardPool() {
        const seen = new Set();
        const pool = [];
        for (const card of deps.getCollectionCards()) {
            const name = card.data['名前'];
            const rarity = card.data['レアリティ'] || '';
            const key = `${name}|||${rarity}`;
            if (!seen.has(key)) {
                seen.add(key);
                pool.push({
                    name: name,
                    rarity: rarity,
                    selectedCiid: card.data.selectedCiid || '1',
                    weight: RARITY_WEIGHTS[rarity] ?? PACK_DEFAULT_WEIGHT
                });
            }
        }
        return pool;
    }
    
    function weightedRandomPick(pool) {
        const totalWeight = pool.reduce((sum, c) => sum + c.weight, 0);
        let rand = Math.random() * totalWeight;
        for (const card of pool) {
            rand -= card.weight;
            if (rand <= 0) return card;
        }
        return pool[pool.length - 1];
    }
    
    function generatePack() {
        const pool = buildCardPool();
        if (pool.length === 0) return [];
    
        // R以上のレアリティのみのプール（最右カード用）
        const rRankIdx = RARITY_ORDER.indexOf('R');
        const rarePool = pool.filter(c => {
            const idx = RARITY_ORDER.indexOf(c.rarity);
            return idx >= rRankIdx;
        });
    
        const pack = [];
        // 通常4枚
        for (let i = 0; i < 4; i++) {
            pack.push({ ...weightedRandomPick(pool) });
        }
        // 5枚目はR以上確定（R以上のカードがなければ通常プールから）
        const guaranteedPool = rarePool.length > 0 ? rarePool : pool;
        pack.push({ ...weightedRandomPick(guaranteedPool) });
    
        pack.sort((a, b) => {
            const idxA = RARITY_ORDER.indexOf(a.rarity);
            const idxB = RARITY_ORDER.indexOf(b.rarity);
            return (idxA === -1 ? -1 : idxA) - (idxB === -1 ? -1 : idxB);
        });
        return pack;
    }
    
    function getRarityTier(rarity) {
        const idx = RARITY_ORDER.indexOf(rarity);
        if (idx < 0) return 'common';
        if (idx <= 2) return 'common';
        if (idx <= 6) return 'uncommon';
        if (idx <= 9) return 'rare';
        if (idx <= 13) return 'super-rare';
        if (idx <= 19) return 'ultra-rare';
        return 'secret';
    }
    
    function showPackOverlay() {
        const overlay = document.getElementById('packOverlay');
        overlay.style.display = 'flex';
        overlay.offsetHeight; // force reflow
        overlay.classList.add('show', 'visible');
        packOverlayOpen = true;
        resetPackState();
    }
    
    function hidePackOverlay() {
        const overlay = document.getElementById('packOverlay');
        overlay.classList.remove('visible');
        setTimeout(() => {
            overlay.classList.remove('show');
            overlay.style.display = 'none';
        }, 300);
        packOverlayOpen = false;
    }
    
    function resetPackState() {
        document.getElementById('packWrapper').style.display = 'block';
        document.getElementById('packCardsContainer').style.display = 'none';
        document.getElementById('packCardsContainer').innerHTML = '';
        document.getElementById('packBox').classList.remove('opening');
        document.getElementById('packOpenBtn').style.display = '';
        document.getElementById('packFlipAllBtn').style.display = 'none';
        document.getElementById('packAgainBtn').style.display = 'none';
        packFlippedCount = 0;
        packCards = [];
    }
    
    function executePackOpen() {
        if (deps.getCollectionCards().length === 0) {
            alert('コレクションにカードがありません。カードを追加してからお試しください。');
            return;
        }
    
        packCards = generatePack();
        const packBox = document.getElementById('packBox');
        packBox.classList.add('opening');
    
        setTimeout(() => {
            document.getElementById('packWrapper').style.display = 'none';
            document.getElementById('packCardsContainer').style.display = 'flex';
            document.getElementById('packOpenBtn').style.display = 'none';
            document.getElementById('packFlipAllBtn').style.display = '';
            document.getElementById('packAgainBtn').style.display = '';
            renderPackCards(packCards);
        }, 600);
    }
    
    function renderPackCards(cards) {
        const container = document.getElementById('packCardsContainer');
        container.innerHTML = '';
        packFlippedCount = 0;
    
        cards.forEach((card, index) => {
            const tier = getRarityTier(card.rarity);
            const slot = document.createElement('div');
            slot.className = `pack-card-slot rarity-${tier}`;
            slot.dataset.index = index;
    
            slot.innerHTML = `
                <div class="pack-card-inner">
                    <div class="pack-card-back">
                        <div class="card-back-design">
                            <i class="bi bi-question-circle"></i>
                        </div>
                    </div>
                    <div class="pack-card-front">
                        <div class="pack-card-image-container-inner">
                            <i class="bi bi-card-image" style="font-size:2rem;color:rgba(0,0,0,0.1);"></i>
                        </div>
                        <div class="pack-card-rarity-badge rarity-${tier}">${deps.escapeHtml(card.rarity || '?')}</div>
                        <div class="pack-card-name-label">${deps.escapeHtml(deps.decodeHtmlEntities(card.name))}</div>
                    </div>
                </div>
            `;
    
            slot.addEventListener('click', () => flipCard(slot, card, tier));
            container.appendChild(slot);
    
            setTimeout(() => slot.classList.add('dealt'), 100 * index);
            loadPackCardImage(slot, card);
        });
    }
    
    async function loadPackCardImage(slot, card) {
        try {
            const decodedName = deps.decodeHtmlEntities(card.name);
            const ciid = card.selectedCiid || '1';
            const imageUrl = await deps.getCardImageUrl(decodedName, ciid);
            if (imageUrl) {
                const imgContainer = slot.querySelector('.pack-card-image-container-inner');
                const img = document.createElement('img');
                img.src = imageUrl;
                img.alt = decodedName;
                img.onload = () => {
                    imgContainer.innerHTML = '';
                    imgContainer.appendChild(img);
                };
            }
        } catch (error) {
            console.error(`Pack card image load failed for ${card.name}:`, error);
        }
    }
    
    function flipCard(slot, card, tier) {
        if (slot.classList.contains('flipped')) return;
        slot.classList.add('flipped');
        packFlippedCount++;
    
        if (tier === 'secret') {
            const flash = document.createElement('div');
            flash.className = 'pack-flash';
            document.body.appendChild(flash);
            setTimeout(() => flash.remove(), 600);
        }
    
        if (packFlippedCount >= 5) {
            document.getElementById('packFlipAllBtn').style.display = 'none';
        }
    }
    
    function flipAllCards() {
        const slots = document.querySelectorAll('.pack-card-slot:not(.flipped)');
        slots.forEach((slot, i) => {
            setTimeout(() => {
                const index = parseInt(slot.dataset.index);
                const card = packCards[index];
                const tier = getRarityTier(card.rarity);
                flipCard(slot, card, tier);
            }, 200 * i);
        });
    }
    
    // Pack opening event listeners
    document.getElementById('packOpenFab').addEventListener('click', showPackOverlay);
    document.getElementById('packCloseBtn').addEventListener('click', hidePackOverlay);
    document.getElementById('packOpenBtn').addEventListener('click', executePackOpen);
    document.getElementById('packAgainBtn').addEventListener('click', () => {
        resetPackState();
    });
    document.getElementById('packFlipAllBtn').addEventListener('click', flipAllCards);
    document.getElementById('packOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'packOverlay') hidePackOverlay();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && packOverlayOpen) hidePackOverlay();
    });
    

    return { RARITY_ORDER, buildEffectHtml };
};

// ==================== END PACK OPENING SYSTEM ====================
