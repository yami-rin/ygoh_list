// ==================== DECK SYSTEM ====================

export const createDeckSystem = (deps) => {
    const { api } = deps;
    let currentDeck = null;
    const deckListPanel = document.getElementById('deckListPanel');
    let draggedDeckCard = null;


    // Count card usage across all deps.getDecks()
    const getCardUsageInDecks = (cardId) => {
        const usageMap = {}; // { deckName: count }
        let totalUsed = 0;

        deps.getDecks().forEach(deck => {
            let deckTotal = 0;

            // Check main deck
            if (deck.mainDeck) {
                const mainCard = deck.mainDeck.find(c => c.cardId === cardId);
                if (mainCard) deckTotal += mainCard.quantity;
            }

            // Check extra deck
            if (deck.extraDeck) {
                const extraCard = deck.extraDeck.find(c => c.cardId === cardId);
                if (extraCard) deckTotal += extraCard.quantity;
            }

            // Check side deck
            if (deck.sideDeck) {
                const sideCard = deck.sideDeck.find(c => c.cardId === cardId);
                if (sideCard) deckTotal += sideCard.quantity;
            }

            if (deckTotal > 0) {
                usageMap[deck.name || '無題のデッキ'] = deckTotal;
                totalUsed += deckTotal;
            }
        });

        return { usageMap, totalUsed };
    };

    // Load all deps.getDecks() from API
    const loadDecks = async () => {
        if (!deps.getCurrentUser()) return;
        try {
            const result = await api.getDecks();
            deps.setDecks(result.map(d => ({ id: d.id, ...d })));
            console.log(`Loaded ${deps.getDecks().length} deps.getDecks()`);
        } catch (error) {
            console.error('Error loading deps.getDecks():', error);
        }
    };

    // Remove undefined values from object (Firestore doesn't support undefined)
    const removeUndefined = (obj) => {
        if (Array.isArray(obj)) {
            return obj.map(item => removeUndefined(item));
        } else if (obj !== null && typeof obj === 'object') {
            const cleaned = {};
            for (const key in obj) {
                if (obj[key] !== undefined) {
                    cleaned[key] = removeUndefined(obj[key]);
                }
            }
            return cleaned;
        }
        return obj;
    };

    // Save deck to Firestore
    const saveDeck = async () => {
        if (!deps.getCurrentUser() || !currentDeck) return;

        // Clean deck data to remove undefined values
        const cleanDeckArray = (deckArray) => {
            return (deckArray || []).map(card => {
                const cleanedCard = {
                    cardId: card.cardId,
                    name: card.name,
                    code: card.code || '',
                    rarity: card.rarity || '',
                    quantity: card.quantity
                };
                // Only add selectedCiid if it exists
                if (card.selectedCiid) {
                    cleanedCard.selectedCiid = card.selectedCiid;
                }
                return cleanedCard;
            });
        };

        const deckData = {
            name: document.getElementById('deckName').value || '無題のデッキ',
            memo: document.getElementById('deckMemo').value || '',
            mainDeck: cleanDeckArray(currentDeck.mainDeck),
            extraDeck: cleanDeckArray(currentDeck.extraDeck),
            sideDeck: cleanDeckArray(currentDeck.sideDeck),
            updatedAt: new Date().toISOString()
        };

        // Validate deck counts
        const mainCount = deckData.mainDeck.reduce((sum, c) => sum + c.quantity, 0);
        const extraCount = deckData.extraDeck.reduce((sum, c) => sum + c.quantity, 0);
        const sideCount = deckData.sideDeck.reduce((sum, c) => sum + c.quantity, 0);

        if (mainCount < 1 || mainCount > 60) {
            alert(`メインデッキは1~60枚である必要があります。\n現在: ${mainCount}枚`);
            return;
        }
        if (extraCount > 15) {
            alert(`エクストラデッキは0~15枚である必要があります。\n現在: ${extraCount}枚`);
            return;
        }
        if (sideCount > 15) {
            alert(`サイドデッキは0~15枚である必要があります。\n現在: ${sideCount}枚`);
            return;
        }

        try {
            // Check for unowned cards and add to wishlist
            const allDeckCards = [
                ...(deckData.mainDeck || []),
                ...(deckData.extraDeck || []),
                ...(deckData.sideDeck || [])
            ];

            console.log('Checking deck cards for unowned:', allDeckCards);

            const unownedCardsToAdd = [];
            for (const deckCard of allDeckCards) {
                console.log('Checking card:', deckCard.cardId, deckCard.name);

                // Check if card is in collection
                const isInCollection = deps.getCollectionCards().some(c => c.id === deckCard.cardId);
                console.log('  In collection:', isInCollection);

                if (!isInCollection) {
                    // Check if already in wishlist
                    const isInWishlist = deps.getWishlistCards().some(c => c.id === deckCard.cardId);
                    console.log('  In wishlist:', isInWishlist);

                    if (!isInWishlist) {
                        // Use the card data from deckCard itself
                        // Since we already have name, code, rarity stored in deckCard
                        const cardToAdd = {
                            cardId: deckCard.cardId,
                            name: deckCard.name,
                            code: deckCard.code || '',
                            rarity: deckCard.rarity || ''
                        };
                        // Only add selectedCiid if it exists
                        if (deckCard.selectedCiid) {
                            cardToAdd.selectedCiid = deckCard.selectedCiid;
                        }
                        unownedCardsToAdd.push(cardToAdd);
                        console.log('  Added to unowned list');
                    }
                }
            }

            console.log('Unowned cards to add:', unownedCardsToAdd);

            // Add unowned cards to wishlist via API
            if (unownedCardsToAdd.length > 0) {
                for (const card of unownedCardsToAdd) {
                    const wishlistData = {
                        '名前': card.name || '',
                        '型番': card.code || '',
                        'レアリティ': card.rarity || '',
                        '枚数': 1,
                        tags: [],
                        selectedCiid: card.selectedCiid || null,
                    };
                    console.log('Adding to wishlist:', card.cardId, wishlistData);
                    await api.addCard('wishlist', wishlistData);
                }
                console.log(`Added ${unownedCardsToAdd.length} unowned cards to wishlist`);
            }

            if (currentDeck.id) {
                // Update existing deck
                await api.updateDeck(currentDeck.id, deckData);
                if (unownedCardsToAdd.length > 0) {
                    alert(`デッキを保存しました\n未所持カード ${unownedCardsToAdd.length} 枚をウィッシュリストに追加しました`);
                } else {
                    alert('デッキを保存しました');
                }
            } else {
                // Create new deck
                deckData.createdAt = new Date().toISOString();
                const newDeck = await api.createDeck(deckData);
                currentDeck.id = newDeck.id;
                if (unownedCardsToAdd.length > 0) {
                    alert(`デッキを作成しました\n未所持カード ${unownedCardsToAdd.length} 枚をウィッシュリストに追加しました`);
                } else {
                    alert('デッキを作成しました');
                }
            }

            // Reload data to reflect wishlist changes
            if (unownedCardsToAdd.length > 0) {
                // Add to local wishlist data
                for (const card of unownedCardsToAdd) {
                    const wishlistData = {
                        名前: card.name || '',
                        型番: card.code || '',
                        レアリティ: card.rarity || '',
                        枚数: 1,
                        tags: [],
                        addedAt: new Date().toISOString()
                    };
                    if (card.selectedCiid) {
                        wishlistData.selectedCiid = card.selectedCiid;
                    }
                    deps.getWishlistCards().push({ id: card.cardId, data: wishlistData });
                }
            }

            // Update local deck data
            if (currentDeck.id) {
                const existingDeckIndex = deps.getDecks().findIndex(d => d.id === currentDeck.id);
                if (existingDeckIndex >= 0) {
                    deps.getDecks()[existingDeckIndex] = { id: currentDeck.id, ...deckData };
                }
            } else {
                deps.getDecks().push({ id: currentDeck.id, ...deckData });
            }

            // Update cache and metadata
            deps.saveGalleryToCache();
            await deps.updateGalleryMetadata();

            renderDeckList();
            deps.renderCards(); // Re-render cards to update stock badges
        } catch (error) {
            console.error('Error saving deck:', error);
            alert('デッキの保存に失敗しました');
        }
    };

    // Delete deck
    const deleteDeck = async () => {
        if (!deps.getCurrentUser() || !currentDeck || !currentDeck.id) return;

        if (!confirm('このデッキを削除しますか？')) return;

        try {
            await api.deleteDeck(currentDeck.id);

            // Remove from local data
            deps.setDecks(deps.getDecks().filter(d => d.id !== currentDeck.id));

            // Update cache and metadata
            deps.saveGalleryToCache();
            await deps.updateGalleryMetadata();

            alert('デッキを削除しました');
            closeDeckBuilder();
            renderDeckList();
            deps.renderCards(); // Re-render cards to update stock badges
        } catch (error) {
            console.error('Error deleting deck:', error);
            alert('デッキの削除に失敗しました');
        }
    };

    // Open deck list panel
    const openDeckList = () => {
        deckListPanel.classList.add('active');
    };

    // Close deck list panel
    const closeDeckList = () => {
        deckListPanel.classList.remove('active');
    };

    // Open deck builder panel
    const openDeckBuilder = async (deck = null) => {
        currentDeck = deck || { mainDeck: [], extraDeck: [], sideDeck: [] };

        document.getElementById('deckName').value = currentDeck.name || '';
        document.getElementById('deckMemo').value = currentDeck.memo || '';
        document.getElementById('deckBuilderTitle').textContent = deck ? 'デッキ編集' : '新規デッキ';

        await renderDeckCards();

        document.getElementById('deckBuilderPanel').classList.add('active');
        document.body.classList.add('deck-builder-open');

        // Hide delete button for new deps.getDecks()
        document.getElementById('deleteDeckBtn').style.display = deck && deck.id ? 'block' : 'none';
    };

    // Close deck builder panel
    const closeDeckBuilder = () => {
        document.getElementById('deckBuilderPanel').classList.remove('active');
        document.body.classList.remove('deck-builder-open');
        currentDeck = null;
    };

    // Render deck list in modal
    const renderDeckList = () => {
        const container = document.getElementById('deck-list-container');

        if (deps.getDecks().length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="bi bi-inbox" style="font-size: 3rem; color: #ccc;"></i>
                    <p class="text-muted mt-2">デッキがありません</p>
                </div>
            `;
            return;
        }

        container.innerHTML = deps.getDecks().map(deck => {
            const mainCount = deck.mainDeck ? deck.mainDeck.reduce((sum, c) => sum + c.quantity, 0) : 0;
            const extraCount = deck.extraDeck ? deck.extraDeck.reduce((sum, c) => sum + c.quantity, 0) : 0;
            const sideCount = deck.sideDeck ? deck.sideDeck.reduce((sum, c) => sum + c.quantity, 0) : 0;
            const cardCount = mainCount + extraCount + sideCount;
            const cardTypes = (deck.mainDeck?.length || 0) + (deck.extraDeck?.length || 0) + (deck.sideDeck?.length || 0);

            return `
                <div class="deck-list-item" onclick="viewDeck('${deck.id}')">
                    <div class="deck-list-item-header">
                        <div class="deck-list-item-name">${deps.escapeHtml(deck.name || '無題')}</div>
                        <div class="deck-list-item-actions">
                            <button class="btn btn-sm btn-outline-info" onclick="event.stopPropagation(); viewDeck('${deck.id}')" title="閲覧">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); editDeck('${deck.id}')" title="編集">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteDeckFromList('${deck.id}')" title="削除">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                    ${deck.memo ? `<div class="deck-list-item-memo">${deps.escapeHtml(deck.memo)}</div>` : ''}
                    <div class="deck-list-item-stats">
                        <span><i class="bi bi-collection"></i> ${cardCount}枚</span>
                        <span><i class="bi bi-card-list"></i> ${cardTypes}種</span>
                        <span><i class="bi bi-clock"></i> ${new Date(deck.updatedAt || deck.createdAt).toLocaleDateString('ja-JP')}</span>
                    </div>
                </div>
            `;
        }).join('');
    };

    // Edit deck (called from deck list)
    window.editDeck = (deckId) => {
        const deck = deps.getDecks().find(d => d.id === deckId);
        if (deck) {
            closeDeckList();
            openDeckBuilder(deck);
        }
    };

    // Delete deck from list
    window.deleteDeckFromList = async (deckId) => {
        const deck = deps.getDecks().find(d => d.id === deckId);
        if (!deck) return;

        if (!confirm(`「${deck.name || '無題'}」を削除してもよろしいですか？`)) {
            return;
        }

        try {
            if (!deps.getCurrentUser()) return;

            await api.deleteDeck(deckId);

            // Remove from local array
            deps.setDecks(deps.getDecks().filter(d => d.id !== deckId));

            // Update cache and metadata
            deps.saveGalleryToCache();
            await deps.updateGalleryMetadata();

            renderDeckList();
            alert('デッキを削除しました');
        } catch (error) {
            console.error('Error deleting deck:', error);
            alert('デッキの削除に失敗しました');
        }
    };

    // View deck in modal
    let currentViewingDeck = null;

    window.viewDeck = async (deckId) => {
        const deck = deps.getDecks().find(d => d.id === deckId);
        if (!deck) return;

        currentViewingDeck = deck;

        // Set deck name
        document.getElementById('viewDeckName').textContent = deck.name || '無題のデッキ';

        // Render deck view
        await renderDeckView(deck);

        // Load saved card details visibility preference
        const hideCardDetails = localStorage.getItem('deckViewHideCardDetails');
        const deckViewContent = document.getElementById('deckViewContent');
        const btn = document.getElementById('toggleDeckViewDetailsBtn');

        if (hideCardDetails === 'true') {
            deckViewContent.classList.add('hide-card-details');
            btn.classList.remove('btn-outline-secondary');
            btn.classList.add('btn-secondary');
        } else {
            deckViewContent.classList.remove('hide-card-details');
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-outline-secondary');
        }

        // Show modal
        const modal = new deps.bootstrap.Modal(document.getElementById('deckViewModal'));
        modal.show();
    };

    const renderDeckView = async (deck) => {
        const container = document.getElementById('deckViewContent');

        const renderSection = async (title, cards, sectionId) => {
            if (!cards || cards.length === 0) return '';

            // Expand cards based on quantity
            const expandedCards = cards.flatMap(card =>
                Array(card.quantity).fill(card)
            );

            let html = `
                <div class="deck-view-section">
                    <div class="deck-view-section-title">${title} (${expandedCards.length}枚)</div>
                    <div class="deck-view-grid" id="${sectionId}">
            `;

            // Add placeholder cards
            expandedCards.forEach((card, index) => {
                html += `
                    <div class="deck-view-card" data-card-name="${deps.escapeHtml(card.name)}" data-ciid="${deps.escapeHtml(card.selectedCiid || '1')}">
                        <div class="deck-view-card-placeholder">
                            <i class="bi bi-card-image"></i>
                        </div>
                        ${card.rarity ? `<div class="deck-view-card-rarity">${deps.escapeHtml(card.rarity)}</div>` : ''}
                        ${card.code ? `<div class="deck-view-card-code">${deps.escapeHtml(card.code)}</div>` : ''}
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;

            return html;
        };

        // Build HTML
        let html = `
            <div style="text-align: center; margin-bottom: 2rem;">
                <h3>${deps.escapeHtml(deck.name || '無題のデッキ')}</h3>
                ${deck.memo ? `<p style="color: #6c757d;">${deps.escapeHtml(deck.memo)}</p>` : ''}
            </div>
        `;

        html += await renderSection('メインデッキ', deck.mainDeck, 'view-main-deck');
        html += await renderSection('エクストラデッキ', deck.extraDeck, 'view-extra-deck');
        html += await renderSection('サイドデッキ', deck.sideDeck, 'view-side-deck');

        container.innerHTML = html;

        const cardElements = container.querySelectorAll('.deck-view-card');
        deps.imageQueue.observe('deck-view', cardElements, (cardElement) => {
            const decodedCardName = deps.decodeHtmlEntities(cardElement.dataset.cardName || '');
            const ciid = cardElement.dataset.ciid || '1';
            return {
                key: `${decodedCardName}_${ciid}`,
                load: () => deps.getCardImageUrl(decodedCardName, ciid),
                apply: (imageUrl) => {
                    const placeholder = cardElement.querySelector('.deck-view-card-placeholder');
                    if (imageUrl && placeholder) {
                        const img = document.createElement('img');
                        img.src = imageUrl;
                        img.alt = decodedCardName;
                        placeholder.replaceWith(img);
                    }
                },
                onError: (error) => console.error(`Failed to load image for ${decodedCardName}:`, error)
            };
        });
    };

    // Export deck as image
    document.getElementById('exportDeckImageBtn').addEventListener('click', async () => {
        if (!currentViewingDeck) return;

        const content = document.getElementById('deckViewContent');

        // Save original width
        const originalWidth = content.style.width;
        const originalMaxWidth = content.style.maxWidth;

        try {
            // Set fixed width for consistent export (1080px target)
            content.style.width = '1080px';
            content.style.maxWidth = '1080px';

            // Wait a moment for layout to update
            await new Promise(resolve => setTimeout(resolve, 100));

            const canvas = await deps.html2canvas(content, {
                scale: 1,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
                width: 1080
            });

            // Always resize to exactly 1080px width
            const targetWidth = 1080;
            const scale = targetWidth / canvas.width;
            const resizedCanvas = document.createElement('canvas');
            resizedCanvas.width = targetWidth;
            resizedCanvas.height = canvas.height * scale;

            const ctx = resizedCanvas.getContext('2d');
            ctx.drawImage(canvas, 0, 0, resizedCanvas.width, resizedCanvas.height);

            // Convert to blob and download
            resizedCanvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${currentViewingDeck.name || 'デッキ'}.png`;
                a.click();
                URL.revokeObjectURL(url);
            });
        } catch (error) {
            console.error('Error exporting deck image:', error);
            alert('画像の出力に失敗しました');
        } finally {
            // Restore original width
            content.style.width = originalWidth;
            content.style.maxWidth = originalMaxWidth;
        }
    });

    // Save card grid as image
    document.getElementById('save-grid-image-btn').addEventListener('click', async () => {
        const btn = document.getElementById('save-grid-image-btn');
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        const grid = document.getElementById('card-grid');
        try {
            const canvas = await deps.html2canvas(grid, {
                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bs-body-bg') || '#ffffff',
                logging: false,
                useCORS: true,
                scale: 1
            });
            const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const MAX_BYTES = 10 * 1024 * 1024;
            // PNG を試し、超えたら JPEG で品質を落としていく
            const tryExport = (format, quality) => new Promise((resolve) => {
                canvas.toBlob((blob) => resolve(blob), format, quality);
            });
            let blob = await tryExport('image/png');
            let ext = 'png';
            if (blob.size > MAX_BYTES) {
                for (const q of [0.9, 0.75, 0.6]) {
                    blob = await tryExport('image/jpeg', q);
                    ext = 'jpg';
                    if (blob.size <= MAX_BYTES) break;
                }
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cards_${date}.${ext}`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('画像保存エラー:', err);
            alert('画像の保存に失敗しました。');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    });

    // Toggle card details (code and rarity) visibility in deck view modal
    document.getElementById('toggleDeckViewDetailsBtn').addEventListener('click', () => {
        const deckViewContent = document.getElementById('deckViewContent');
        const btn = document.getElementById('toggleDeckViewDetailsBtn');
        const isHidden = deckViewContent.classList.toggle('hide-card-details');

        // Update button appearance
        if (isHidden) {
            btn.classList.remove('btn-outline-secondary');
            btn.classList.add('btn-secondary');
        } else {
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-outline-secondary');
        }

        // Save preference
        localStorage.setItem('deckViewHideCardDetails', isHidden.toString());
        console.log('Deck view card details visibility toggled:', isHidden ? 'hidden' : 'visible');
    });

    // Render cards in deck builder
    const renderDeckCards = async () => {
        if (!currentDeck) return;

        // Helper function to render a deck section
        const renderDeckSection = async (deckType, cards, containerId, countId) => {
            const container = document.getElementById(containerId);
            const placeholder = document.querySelector(`#${containerId.replace('CardsList', 'DropZone')} .deck-drop-placeholder`);
            const count = cards.reduce((sum, c) => sum + c.quantity, 0);

            document.getElementById(countId).textContent = count;

            if (cards.length === 0) {
                container.innerHTML = '';
                if (placeholder) placeholder.style.display = 'block';
                deps.imageQueue.cancel(`deck-builder-${containerId}`);
                return;
            }

            if (placeholder) placeholder.style.display = 'none';

            // First render placeholder cards in grid (repeat each card by its quantity)
            container.innerHTML = `<div class="deck-cards-grid">` + cards.flatMap((deckCard, index) => {
                const decodedCardName = deps.decodeHtmlEntities(deckCard.name);
                // Check if card is unowned
                const isUnowned = !deps.getCollectionCards().some(c => c.id === deckCard.cardId);
                const unownedClass = isUnowned ? ' unowned' : '';
                return Array(deckCard.quantity).fill(null).map((_, copyIndex) => {
                    return `
                    <div class="deck-card-item${unownedClass}" data-card-index="${index}" data-copy-index="${copyIndex}" data-deck-type="${deckType}" data-card-id="${deckCard.cardId}" draggable="true">
                        <div class="deck-card-image-container">
                            <img data-card-name="${deps.escapeHtml(decodedCardName)}" alt="${deps.escapeHtml(decodedCardName)}" style="display:none;">
                            <div class="deck-card-image-placeholder">
                                <i class="bi bi-card-image"></i>
                            </div>
                            <div class="deck-card-rarity">${deps.escapeHtml(deckCard.rarity || '')}</div>
                            <div class="deck-card-code">${deps.escapeHtml(deckCard.code || '')}</div>
                        </div>
                    </div>
                `;
                });
            }).join('') + `</div>`;

            // Queue images only after the deck DOM is available and visible.
            const grid = container.querySelector('.deck-cards-grid');
            if (grid) {
                const targets = cards
                    .map((_, index) => grid.querySelector(`[data-card-index="${index}"]`))
                    .filter(Boolean);
                deps.imageQueue.observe(`deck-builder-${containerId}`, targets, (target) => {
                    const cardIndex = Number(target.dataset.cardIndex);
                    const card = cards[cardIndex];
                    const decodedCardName = deps.decodeHtmlEntities(card.name);
                    const ciid = card.selectedCiid || '1';
                    return {
                        key: `${decodedCardName}_${ciid}`,
                        load: () => deps.getCardImageUrl(decodedCardName, ciid),
                        apply: (imageUrl) => {
                            if (!imageUrl) return;
                            grid.querySelectorAll(`[data-card-index="${cardIndex}"]`).forEach((cardItem) => {
                                const img = cardItem.querySelector('img');
                                const imagePlaceholder = cardItem.querySelector('.deck-card-image-placeholder');
                                img.src = imageUrl;
                                img.style.display = 'block';
                                imagePlaceholder.style.display = 'none';
                            });
                        },
                        onError: (error) => console.error(`Failed to load image for ${card.name}:`, error)
                    };
                });

                // Setup drag events for deck cards
                grid.querySelectorAll('.deck-card-item').forEach(cardItem => {
                    // Mouse drag events
                    cardItem.addEventListener('dragstart', (e) => {
                        const cardIndex = parseInt(cardItem.dataset.cardIndex);
                        const copyIndex = parseInt(cardItem.dataset.copyIndex);
                        const sourceDeckType = cardItem.dataset.deckType;
                        draggedDeckCard = {
                            card: cards[cardIndex],
                            cardIndex: cardIndex,
                            copyIndex: copyIndex,
                            sourceDeckType: sourceDeckType,
                            element: cardItem
                        };
                        cardItem.classList.add('dragging');
                        e.dataTransfer.effectAllowed = 'move';
                    });

                    cardItem.addEventListener('dragend', (e) => {
                        cardItem.classList.remove('dragging');
                    });

                    // Reordering within same deck
                    cardItem.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';

                        if (draggedDeckCard && draggedDeckCard.sourceDeckType === deckType &&
                            draggedDeckCard.element !== cardItem) {
                            const rect = cardItem.getBoundingClientRect();
                            const midpoint = rect.left + rect.width / 2;

                            if (e.clientX < midpoint) {
                                cardItem.style.borderLeft = '3px solid #667eea';
                                cardItem.style.borderRight = '';
                            } else {
                                cardItem.style.borderRight = '3px solid #667eea';
                                cardItem.style.borderLeft = '';
                            }
                        }
                    });

                    cardItem.addEventListener('dragleave', (e) => {
                        cardItem.style.borderLeft = '';
                        cardItem.style.borderRight = '';
                    });

                    cardItem.addEventListener('drop', async (e) => {
                        e.preventDefault();
                        cardItem.style.borderLeft = '';
                        cardItem.style.borderRight = '';

                        if (!draggedDeckCard || draggedDeckCard.sourceDeckType !== deckType) {
                            return;
                        }

                        const targetCardIndex = parseInt(cardItem.dataset.cardIndex);
                        const targetCopyIndex = parseInt(cardItem.dataset.copyIndex);

                        // Calculate positions in the flat array
                        const sourcePosition = cards.slice(0, draggedDeckCard.cardIndex).reduce((sum, c) => sum + c.quantity, 0) + draggedDeckCard.copyIndex;
                        const targetPosition = cards.slice(0, targetCardIndex).reduce((sum, c) => sum + c.quantity, 0) + targetCopyIndex;

                        if (sourcePosition === targetPosition) return;

                        // Determine insert position based on mouse position
                        const rect = cardItem.getBoundingClientRect();
                        const midpoint = rect.left + rect.width / 2;
                        const insertBefore = e.clientX < midpoint;
                        const finalTargetPosition = insertBefore ? targetPosition : targetPosition + 1;

                        // Reorder the cards
                        await reorderDeckCards(deckType, sourcePosition, finalTargetPosition);
                    });

                    // Touch events for mobile
                    cardItem.addEventListener('touchstart', (e) => {
                        const cardIndex = parseInt(cardItem.dataset.cardIndex);
                        const copyIndex = parseInt(cardItem.dataset.copyIndex);
                        const sourceDeckType = cardItem.dataset.deckType;
                        draggedDeckCard = {
                            card: cards[cardIndex],
                            cardIndex: cardIndex,
                            copyIndex: copyIndex,
                            sourceDeckType: sourceDeckType,
                            element: cardItem
                        };
                        cardItem.classList.add('dragging');
                    }, { passive: true });

                    cardItem.addEventListener('touchend', async (e) => {
                        cardItem.classList.remove('dragging');
                        cardItem.style.borderLeft = '';
                        cardItem.style.borderRight = '';

                        const touch = e.changedTouches[0];
                        const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);
                        const targetCardItem = elementAtPoint?.closest('.deck-card-item');

                        if (targetCardItem && draggedDeckCard &&
                            draggedDeckCard.sourceDeckType === deckType &&
                            targetCardItem !== cardItem) {

                            const targetCardIndex = parseInt(targetCardItem.dataset.cardIndex);
                            const targetCopyIndex = parseInt(targetCardItem.dataset.copyIndex);

                            // Calculate positions in the flat array
                            const sourcePosition = cards.slice(0, draggedDeckCard.cardIndex).reduce((sum, c) => sum + c.quantity, 0) + draggedDeckCard.copyIndex;
                            const targetPosition = cards.slice(0, targetCardIndex).reduce((sum, c) => sum + c.quantity, 0) + targetCopyIndex;

                            if (sourcePosition !== targetPosition) {
                                // Determine insert position based on touch position
                                const rect = targetCardItem.getBoundingClientRect();
                                const midpoint = rect.left + rect.width / 2;
                                const insertBefore = touch.clientX < midpoint;
                                const finalTargetPosition = insertBefore ? targetPosition : targetPosition + 1;

                                // Reorder the cards
                                await reorderDeckCards(deckType, sourcePosition, finalTargetPosition);
                            }
                        }

                        draggedDeckCard = null;
                    }, { passive: true });
                });
            }
        };

        // Render each section
        await renderDeckSection('main', currentDeck.mainDeck || [], 'mainDeckCardsList', 'mainDeckCount');
        await renderDeckSection('extra', currentDeck.extraDeck || [], 'extraDeckCardsList', 'extraDeckCount');
        await renderDeckSection('side', currentDeck.sideDeck || [], 'sideDeckCardsList', 'sideDeckCount');
    };

    // Reorder cards within a deck
    const reorderDeckCards = async (deckType, sourcePosition, targetPosition) => {
        if (!currentDeck || sourcePosition === targetPosition) return;

        const deckKey = deckType === 'main' ? 'mainDeck' :
                      deckType === 'extra' ? 'extraDeck' : 'sideDeck';

        const deck = currentDeck[deckKey] || [];

        // Convert cards with quantities to flat array
        const flatCards = [];
        deck.forEach((card, cardIndex) => {
            for (let i = 0; i < card.quantity; i++) {
                flatCards.push({
                    ...card,
                    originalCardIndex: cardIndex,
                    copyIndex: i
                });
            }
        });

        // Adjust target position if moving forward
        const adjustedTargetPosition = sourcePosition < targetPosition ? targetPosition - 1 : targetPosition;

        // Move the card
        const [movedCard] = flatCards.splice(sourcePosition, 1);
        flatCards.splice(adjustedTargetPosition, 0, movedCard);

        // Rebuild deck array from flat cards
        const newDeck = [];
        const cardMap = new Map();

        flatCards.forEach(flatCard => {
            const key = flatCard.cardId;
            if (!cardMap.has(key)) {
                const mapEntry = {
                    cardId: flatCard.cardId,
                    name: flatCard.name,
                    code: flatCard.code || '',
                    rarity: flatCard.rarity || '',
                    quantity: 0,
                    positions: []
                };
                // Only add selectedCiid if it exists
                if (flatCard.selectedCiid) {
                    mapEntry.selectedCiid = flatCard.selectedCiid;
                }
                cardMap.set(key, mapEntry);
            }
            const entry = cardMap.get(key);
            entry.quantity++;
            entry.positions.push(newDeck.length);
        });

        // Build final array maintaining new order
        flatCards.forEach(flatCard => {
            const existingIndex = newDeck.findIndex(c =>
                c.cardId === flatCard.cardId &&
                c.quantity < cardMap.get(flatCard.cardId).quantity
            );

            if (existingIndex === -1) {
                // Create new entry
                const newEntry = {
                    cardId: flatCard.cardId,
                    name: flatCard.name,
                    code: flatCard.code || '',
                    rarity: flatCard.rarity || '',
                    quantity: 1
                };
                // Only add selectedCiid if it exists
                if (flatCard.selectedCiid) {
                    newEntry.selectedCiid = flatCard.selectedCiid;
                }
                newDeck.push(newEntry);
            } else {
                // Increment quantity of existing entry
                newDeck[existingIndex].quantity++;
            }
        });

        // Merge consecutive same cards
        const mergedDeck = [];
        for (let i = 0; i < newDeck.length; i++) {
            if (mergedDeck.length > 0 &&
                mergedDeck[mergedDeck.length - 1].cardId === newDeck[i].cardId) {
                mergedDeck[mergedDeck.length - 1].quantity += newDeck[i].quantity;
            } else {
                mergedDeck.push(newDeck[i]);
            }
        }

        currentDeck[deckKey] = mergedDeck;
        await renderDeckCards();
    };

    // Add card to deck
    const addCardToDeck = async (cardData, deckType) => {
        if (!currentDeck) {
            alert('デッキを開いてください');
            return;
        }

        // Determine which deck to add to
        const deckKey = deckType === 'main' ? 'mainDeck' :
                      deckType === 'extra' ? 'extraDeck' : 'sideDeck';

        if (!currentDeck[deckKey]) {
            currentDeck[deckKey] = [];
        }

        // Check count limits before adding
        const currentCount = currentDeck[deckKey].reduce((sum, c) => sum + c.quantity, 0);
        const limit = deckType === 'main' ? 60 : 15;

        if (currentCount >= limit) {
            const deckName = deckType === 'main' ? 'メインデッキ' :
                           deckType === 'extra' ? 'エクストラデッキ' : 'サイドデッキ';
            alert(`${deckName}は${limit}枚までです。`);
            return;
        }

        // Check if card already exists in this deck
        const existingIndex = currentDeck[deckKey].findIndex(c => c.cardId === cardData.id);

        if (existingIndex >= 0) {
            currentDeck[deckKey][existingIndex].quantity++;
        } else {
            const deckCard = {
                cardId: cardData.id,
                name: cardData.data['名前'] || '',
                code: cardData.data['型番'] || '',
                rarity: cardData.data['レアリティ'] || '',
                quantity: 1
            };
            // Only include selectedCiid if it exists
            if (cardData.data.selectedCiid) {
                deckCard.selectedCiid = cardData.data.selectedCiid;
            }
            currentDeck[deckKey].push(deckCard);
        }

        await renderDeckCards();
    };

    // Remove card from deck
    const removeCardFromDeck = async (card, sourceDeckType) => {
        if (!currentDeck) return;

        const deckKey = sourceDeckType === 'main' ? 'mainDeck' :
                      sourceDeckType === 'extra' ? 'extraDeck' : 'sideDeck';

        const existingIndex = currentDeck[deckKey].findIndex(c => c.cardId === card.cardId);
        if (existingIndex !== -1) {
            if (currentDeck[deckKey][existingIndex].quantity > 1) {
                currentDeck[deckKey][existingIndex].quantity--;
            } else {
                currentDeck[deckKey].splice(existingIndex, 1);
            }
            await renderDeckCards();
        }
    };

    // Move card between deck sections
    const moveCardBetweenDecks = async (card, sourceDeckType, targetDeckType) => {
        if (!currentDeck || sourceDeckType === targetDeckType) return;

        // Check target deck limits first
        const targetKey = targetDeckType === 'main' ? 'mainDeck' :
                       targetDeckType === 'extra' ? 'extraDeck' : 'sideDeck';

        if (!currentDeck[targetKey]) {
            currentDeck[targetKey] = [];
        }

        const currentCount = currentDeck[targetKey].reduce((sum, c) => sum + c.quantity, 0);
        const limit = targetDeckType === 'main' ? 60 : 15;

        if (currentCount >= limit) {
            const deckName = targetDeckType === 'main' ? 'メインデッキ' :
                           targetDeckType === 'extra' ? 'エクストラデッキ' : 'サイドデッキ';
            alert(`${deckName}は${limit}枚までです。`);
            return;
        }

        // Remove from source
        const sourceKey = sourceDeckType === 'main' ? 'mainDeck' :
                       sourceDeckType === 'extra' ? 'extraDeck' : 'sideDeck';
        const existingIndex = currentDeck[sourceKey].findIndex(c => c.cardId === card.cardId);
        if (existingIndex === -1) return;

        if (currentDeck[sourceKey][existingIndex].quantity > 1) {
            currentDeck[sourceKey][existingIndex].quantity--;
        } else {
            currentDeck[sourceKey].splice(existingIndex, 1);
        }

        // Add to target deck
        const targetIndex = currentDeck[targetKey].findIndex(c => c.cardId === card.cardId);
        if (targetIndex !== -1) {
            currentDeck[targetKey][targetIndex].quantity++;
        } else {
            currentDeck[targetKey].push({
                cardId: card.cardId,
                name: card.name,
                code: card.code,
                rarity: card.rarity,
                quantity: 1
            });
        }

        await renderDeckCards();
    };

    // Setup drag and drop
    const setupDragAndDrop = () => {
        const setupDropZone = (dropZoneId, deckType) => {
            const dropZone = document.getElementById(dropZoneId);
            if (!dropZone) return;

            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('drag-over');
            });

            dropZone.addEventListener('drop', async (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');

                // Handle card from gallery
                if (deps.getDraggedCard()) {
                    addCardToDeck(deps.getDraggedCard(), deckType);
                    deps.setDraggedCard(null);
                }
                // Handle card from deck (moving between deps.getDecks())
                else if (draggedDeckCard) {
                    await moveCardBetweenDecks(draggedDeckCard.card, draggedDeckCard.sourceDeckType, deckType);
                    draggedDeckCard = null;
                }
            });

            // Add touch event support for mobile
            dropZone.addEventListener('touchend', async (e) => {
                const touch = e.changedTouches[0];
                const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);

                // Check if touch ended on this drop zone
                if (dropZone.contains(elementAtPoint)) {
                    dropZone.classList.remove('drag-over');

                    // Handle card from gallery
                    if (deps.getDraggedCard()) {
                        addCardToDeck(deps.getDraggedCard(), deckType);
                        deps.setDraggedCard(null);
                    }
                    // Handle card from deck (moving between deps.getDecks())
                    else if (draggedDeckCard) {
                        await moveCardBetweenDecks(draggedDeckCard.card, draggedDeckCard.sourceDeckType, deckType);
                        draggedDeckCard = null;
                    }
                }
            }, { passive: true });

            dropZone.addEventListener('touchmove', (e) => {
                const touch = e.touches[0];
                const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);

                // Add/remove drag-over class based on touch position
                if (dropZone.contains(elementAtPoint)) {
                    dropZone.classList.add('drag-over');
                } else {
                    dropZone.classList.remove('drag-over');
                }
            }, { passive: true });
        };

        setupDropZone('mainDeckDropZone', 'main');
        setupDropZone('extraDeckDropZone', 'extra');
        setupDropZone('sideDeckDropZone', 'side');

        // Setup drop on panel outside (for card removal)
        const deckBuilderPanel = document.getElementById('deckBuilderPanel');
        if (deckBuilderPanel) {
            deckBuilderPanel.addEventListener('dragover', (e) => {
                // Only allow dropping deck cards outside drop zones
                if (draggedDeckCard && !e.target.closest('.deck-drop-zone')) {
                    e.preventDefault();
                }
            });

            deckBuilderPanel.addEventListener('drop', async (e) => {
                // If dropped outside drop zones, remove card
                if (draggedDeckCard && !e.target.closest('.deck-drop-zone')) {
                    e.preventDefault();
                    await removeCardFromDeck(draggedDeckCard.card, draggedDeckCard.sourceDeckType);
                    draggedDeckCard = null;
                }
            });
        }
    };

    // Event listeners for deck system
    document.getElementById('deck-manager-btn').addEventListener('click', async () => {
        await loadDecks();
        renderDeckList();
        openDeckList();
    });

    document.getElementById('create-new-deck-btn').addEventListener('click', () => {
        closeDeckList();
        openDeckBuilder();
    });

    document.getElementById('closeDeckListBtn').addEventListener('click', closeDeckList);

    document.getElementById('closeDeckBuilderBtn').addEventListener('click', closeDeckBuilder);

    // Toggle card details (code and rarity) visibility
    document.getElementById('toggleCardDetailsBtn').addEventListener('click', () => {
        const deckBuilderPanel = document.getElementById('deckBuilderPanel');
        const btn = document.getElementById('toggleCardDetailsBtn');
        const isHidden = deckBuilderPanel.classList.toggle('hide-card-details');

        // Update button appearance
        if (isHidden) {
            btn.classList.remove('btn-outline-secondary');
            btn.classList.add('btn-secondary');
        } else {
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-outline-secondary');
        }

        // Save preference
        localStorage.setItem('deckBuilderHideCardDetails', isHidden.toString());
        console.log('Card details visibility toggled:', isHidden ? 'hidden' : 'visible');
    });

    document.getElementById('saveDeckBtn').addEventListener('click', saveDeck);
    document.getElementById('deleteDeckBtn').addEventListener('click', deleteDeck);

    // Initialize drag and drop
    setupDragAndDrop();

    const { setupContextMenu } = deps.createBookmarksSystem({
        api,
        getCurrentUser: () => deps.getCurrentUser(),
        getBookmarkCards: deps.getBookmarkCards,
        setBookmarkCards: deps.setBookmarkCards,
        getCurrentListType: deps.getCurrentListType,
        setAllCards: deps.setAllCards,
        getCurrentPage: deps.getCurrentPage,
        getItemsPerPage: deps.getItemsPerPage,
        getFilteredCards: deps.getFilteredCards,
        saveGalleryToCache: (...args) => deps.saveGalleryToCache(...args),
        updateGalleryMetadata: (...args) => deps.updateGalleryMetadata(...args),
        applyFilters: deps.applyFilters,
        renderCards: (...args) => deps.renderCards(...args),
        updateStats: deps.updateStats
    });

    // Initialize context menu
    setupContextMenu();


    return { getCardUsageInDecks, loadDecks, getCurrentDeck: () => currentDeck };
};

// ==================== END DECK SYSTEM ====================
