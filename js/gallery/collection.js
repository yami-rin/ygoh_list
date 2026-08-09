export const createCollectionSystem = (deps) => {
        const { api, imageCacheManager, PROXY_URL, cardDetailsMap, cardReadingMap, RARITY_ORDER, buildEffectHtml } = deps;

        // State
        let collectionCards = [];
        let wishlistCards = [];
        let bookmarkCards = [];
        let allCards = [];
        let filteredCards = [];
        const getReadingForSort = (name) => {
            // Try direct lookup first, then decode HTML entities and retry
            let details = cardDetailsMap.get(name);
            if (!details && name) {
                const ta = document.createElement('textarea');
                ta.innerHTML = name;
                const decoded = ta.value;
                if (decoded !== name) {
                    details = cardDetailsMap.get(decoded);
                }
            }
            const reading = (details?.reading) || name || '';
            return reading.replace(/^["\u201C\u201D\u300C\u300D\u300E\u300F]+/, '');
        };
        let allAliases = [];
        let userAliasMap = new Map(); // Map<alias, [cardName, ...]>
        let currentPage = 1;
        let itemsPerPage = 50;
        let currentGridSize = 'medium';
        let currentSort = 'quantity-desc';
        let currentListType = 'collection'; // 'collection', 'wishlist', or 'bookmark'
        let currentEditingCard = null;

        // Advanced filter state
        let selectedLevel = '';
        let selectedAttribute = '';
        let selectedRace = '';
        let selectedCardTypes = []; // Array for multiple card types
        let selectedNotCardTypes = []; // Array for NOT card types (exclusion)
        let cardTypeSearchMode = 'and'; // 'and' or 'or'
        let selectedExcludeTags = []; // Array for excluded tags
        let selectedFilterTags = []; // Array for included tags (multiple selection)
        let selectedFilterRarities = []; // Array for included rarities (multiple selection)
        let selectedExcludeRarities = []; // Array for excluded rarities
        let filterNoTagOnly = false; // Filter to show only cards without tags

        // Deck system state
        let decks = []; // All user's decks
        let draggedCard = null; // Card being dragged from gallery

        // Get card image URL (with cache support)
        const getCardImageUrl = async (cardName, ciid = '1', overrideCardId = null, locale = 'ja') => {
            const cardId = overrideCardId || cardDetailsMap.get(cardName)?.cardId;
            if (!cardId) {
                return null;
            }
            // ja は旧形式（後方互換）、非 ja はロケール付き形式
            const cacheKey = locale === 'ja' ? `${cardId}_${ciid}` : `${cardId}_${ciid}_${locale}`;

            try {
                // Check cache first
                const cachedImage = await imageCacheManager.getImage(cacheKey);
                if (cachedImage) {
                    deps.imageQueue.recordCacheHit();
                    console.log(`Using cached image for: ${cardName} (ID: ${cardId}, ciid: ${ciid}, locale: ${locale})`);
                    return cachedImage;
                }

                // Cache miss - fetch from proxy and cache it
                deps.imageQueue.recordCacheMiss();
                console.log(`Fetching image for: ${cardName} (ID: ${cardId}, ciid: ${ciid}, locale: ${locale})`);
                const imageData = await imageCacheManager.fetchAndCache(cacheKey, cardId, ciid, locale);
                return imageData;
            } catch (error) {
                console.error(`Error loading image for ${cardName}:`, error);
                return `${PROXY_URL}/image?cid=${cardId}&ciid=${ciid}&locale=${locale}`;
            }
        };


        const saveGalleryToCache = (...args) => deps.saveGalleryToCache(...args);
        const loadGalleryFromCache = (...args) => deps.loadGalleryFromCache(...args);
        const isGalleryRemoteNewer = (...args) => deps.isGalleryRemoteNewer(...args);
        const updateGalleryMetadata = (...args) => deps.updateGalleryMetadata(...args);

        // Delta sync: unified API call for all changes since last cache
        const deltaSyncGallery = async (cached) => {
            const cachedAt = cached.cachedAt;

            // Restore cached data
            collectionCards = cached.collection || [];
            wishlistCards = cached.wishlist || [];
            bookmarkCards = cached.bookmarks || [];
            decks = cached.decks || [];

            // Single API call for all changes
            const delta = await api.deltaSync(cachedAt);

            let deltaCount = 0;

            // Apply collection changes
            for (const card of (delta.changes.collection || [])) {
                const idx = collectionCards.findIndex(c => c.id === card.id);
                if (idx >= 0) {
                    collectionCards[idx] = { id: card.id, data: card };
                } else {
                    collectionCards.push({ id: card.id, data: card });
                }
                deltaCount++;
            }

            // Apply wishlist changes
            for (const card of (delta.changes.wishlist || [])) {
                const idx = wishlistCards.findIndex(c => c.id === card.id);
                if (idx >= 0) {
                    wishlistCards[idx] = { id: card.id, data: card };
                } else {
                    wishlistCards.push({ id: card.id, data: card });
                }
                deltaCount++;
            }

            // Apply bookmark changes
            for (const bm of (delta.changes.bookmarks || [])) {
                const idx = bookmarkCards.findIndex(c => c.id === bm.id);
                if (idx >= 0) {
                    bookmarkCards[idx] = { id: bm.id, data: bm };
                } else {
                    bookmarkCards.push({ id: bm.id, data: bm });
                }
                deltaCount++;
            }

            // Process deletions
            let deleteCount = 0;
            for (const del of (delta.deletions || [])) {
                if (del.col === 'cards') {
                    const before = collectionCards.length;
                    collectionCards = collectionCards.filter(c => c.id !== del.id);
                    if (collectionCards.length < before) deleteCount++;
                } else if (del.col === 'wishlist') {
                    const before = wishlistCards.length;
                    wishlistCards = wishlistCards.filter(c => c.id !== del.id);
                    if (wishlistCards.length < before) deleteCount++;
                } else if (del.col === 'bookmarks') {
                    const before = bookmarkCards.length;
                    bookmarkCards = bookmarkCards.filter(c => c.id !== del.id);
                    if (bookmarkCards.length < before) deleteCount++;
                }
            }

            console.log(`Delta sync: ${deltaCount} updated, ${deleteCount} deleted`);
            saveGalleryToCache();
        };

        // ========== Alias Support ==========

        const buildUserAliasMap = () => {
            userAliasMap = new Map();
            for (const a of allAliases) {
                const key = a.alias.toLowerCase();
                if (!userAliasMap.has(key)) {
                    userAliasMap.set(key, []);
                }
                userAliasMap.get(key).push(a.cardName);
            }
        };

        const loadAllAliases = async () => {
            try {
                allAliases = await api.getAliases();
            } catch (e) {
                console.warn('Failed to load aliases:', e);
                allAliases = [];
            }
            buildUserAliasMap();
        };

        // Load user's card collection and wishlist
        const loadAllData = async (userId) => {
            showLoading(true);
            try {
                // Try to load from cache first
                const cached = loadGalleryFromCache();

                if (cached && cached.cachedAt) {
                    // Check if remote data is newer (only 1 Firebase read instead of 4)
                    const needsSync = await isGalleryRemoteNewer(cached.cachedAt);

                    if (!needsSync) {
                        // Use cached data
                        collectionCards = cached.collection || [];
                        wishlistCards = cached.wishlist || [];
                        bookmarkCards = cached.bookmarks || [];
                        decks = cached.decks || [];
                        console.log('✅ Using cached gallery data');
                        switchListType(currentListType);
                        return;
                    }

                    // Delta sync: fetch only changes since last cache
                    console.log('⚡ Delta sync from Firebase...');
                    await deltaSyncGallery(cached);
                    switchListType(currentListType);
                    return;
                }

                // No cache - full fetch from API
                console.log('Full fetch from API (no cache)...');

                const [cards, wishlist, bms] = await Promise.all([
                    api.getCards('collection'),
                    api.getCards('wishlist'),
                    api.getBookmarks(),
                ]);
                collectionCards = cards.map(c => ({ id: c.id, data: c }));
                wishlistCards = wishlist.map(c => ({ id: c.id, data: c }));
                bookmarkCards = bms.map(b => ({ id: b.id, data: b }));

                // Load decks to calculate card usage
                await deps.loadDecks();

                // Save to cache for next time
                saveGalleryToCache();

                // Set initial data based on current list type
                switchListType(currentListType);
            } catch (error) {
                console.error('Error loading data:', error);
                alert('カードの読み込みに失敗しました。');
            } finally {
                showLoading(false);
            }
        };

        // Switch between collection, wishlist, and bookmark
        const switchListType = (listType) => {
            // Hide community and playmat, show card gallery
            document.getElementById('community-container').style.display = 'none';
            document.getElementById('playmat-container').style.display = 'none';
            document.getElementById('gallery-content').style.display = 'block';

            currentListType = listType;
            allCards = listType === 'collection' ? collectionCards :
                       listType === 'wishlist' ? wishlistCards :
                       bookmarkCards;

            // Save to localStorage
            localStorage.setItem('galleryListType', listType);

            // Update tab active state (only main tabs, not other nav elements)
            document.querySelectorAll('.nav-tabs > .nav-item > .nav-link').forEach(tab => {
                tab.classList.remove('active');
            });
            document.getElementById(`${listType}-tab`).classList.add('active');

            // Reset to page 1 when switching
            currentPage = 1;

            applyFilters();
            updateStats();
            renderCards();
            populateFilterOptions();
        };

        // Show/hide loading overlay
        const showLoading = (show) => {
            const overlay = document.getElementById('loading-overlay');
            if (show) {
                overlay.classList.remove('hidden');
            } else {
                overlay.classList.add('hidden');
            }
        };

        // Normalize text for search (convert katakana to hiragana, lowercase)
        const normalizeForSearch = (text) => {
            if (!text) return '';

            // Convert to lowercase
            text = text.toLowerCase();

            // Convert katakana to hiragana
            text = text.replace(/[ァ-ヶ]/g, (match) => {
                const code = match.charCodeAt(0) - 0x60;
                return String.fromCharCode(code);
            });

            // Remove middle dots (・) for more flexible search
            text = text.replace(/・/g, '');

            return text;
        };
        // Update the active filter count badge on the tag/rarity toggle button
        const updateTagRarityBadge = () => {
            const count = selectedFilterTags.length + selectedExcludeTags.length + selectedFilterRarities.length + selectedExcludeRarities.length + (filterNoTagOnly ? 1 : 0);
            const badge = document.getElementById('tag-rarity-filter-count');
            if (badge) {
                if (count > 0) {
                    badge.textContent = count;
                    badge.style.display = 'inline';
                } else {
                    badge.style.display = 'none';
                }
            }
        };

        // Apply filters
        const applyFilters = () => {
            updateTagRarityBadge();
            const searchTerm = document.getElementById('search-input').value.toLowerCase();
            const codeSearchTerm = document.getElementById('code-search-input').value.toLowerCase();
            const showUnowned = document.getElementById('show-unowned-cards').checked;

            // Advanced filters
            const levelFilter = selectedLevel;
            const attributeFilter = selectedAttribute;
            const cardTypeFilters = selectedCardTypes; // Array of selected card types
            const notCardTypeFilters = selectedNotCardTypes; // Array of NOT card types
            const raceFilter = selectedRace;
            const attackFilter = document.getElementById('attack-filter') ? document.getElementById('attack-filter').value.trim() : '';
            const defenseFilter = document.getElementById('defense-filter') ? document.getElementById('defense-filter').value.trim() : '';

            // Debug logging
            console.log('Filter values:', {
                searchTerm,
                selectedFilterRarities,
                selectedExcludeRarities,
                selectedFilterTags,
                selectedExcludeTags,
                filterNoTagOnly,
                levelFilter,
                attributeFilter,
                cardTypeFilters,
                raceFilter,
                attackFilter,
                defenseFilter,
                allCardsCount: allCards.length
            });

            // Debug: Show first card's data structure
            if (allCards.length > 0) {
                console.log('First card data sample:', allCards[0].data);
                console.log('Available fields:', Object.keys(allCards[0].data));
                if (allCards[0].data.linkedDetails) {
                    console.log('LinkedDetails:', allCards[0].data.linkedDetails);
                }
            }

            // Get possible card names from hiragana reading
            let possibleCardNames = [];
            if (searchTerm) {
                // Check if the search term matches any reading in our map
                if (cardReadingMap.has(searchTerm)) {
                    possibleCardNames = cardReadingMap.get(searchTerm);
                }

                // Also check for partial matches in readings
                for (const [reading, cards] of cardReadingMap) {
                    if (reading.includes(searchTerm)) {
                        possibleCardNames.push(...cards);
                    }
                }

                // Check user-defined aliases
                if (userAliasMap.has(searchTerm)) {
                    possibleCardNames.push(...userAliasMap.get(searchTerm));
                }
                for (const [alias, cards] of userAliasMap) {
                    if (alias.includes(searchTerm)) {
                        possibleCardNames.push(...cards);
                    }
                }
                possibleCardNames = [...new Set(possibleCardNames)];
            }

            // Normalize search term for card name matching
            const normalizedSearchTerm = normalizeForSearch(searchTerm);

            // Filter owned cards
            filteredCards = allCards.filter(card => {
                const cardName = card.data['名前'] || '';
                const cardCode = card.data['型番'] || '';

                // Check if matches name search
                let matchesNameSearch = !searchTerm;
                if (searchTerm) {
                    // Direct name match (normalized)
                    if (normalizeForSearch(cardName).includes(normalizedSearchTerm)) {
                        matchesNameSearch = true;
                    }
                    // Hiragana reading match
                    else if (possibleCardNames.includes(cardName)) {
                        matchesNameSearch = true;
                    }
                }

                // Check if matches code search
                let matchesCodeSearch = !codeSearchTerm;
                if (codeSearchTerm) {
                    if (cardCode.toLowerCase().includes(codeSearchTerm)) {
                        matchesCodeSearch = true;
                    }
                }

                // レアリティフィルター：複数選択対応
                let matchesRarity = true;
                if (selectedFilterRarities.length > 0) {
                    matchesRarity = selectedFilterRarities.includes(card.data['レアリティ']);
                }

                // レアリティ除外フィルター：選択したレアリティを持つカードを除外
                let matchesExcludeRarity = true;
                if (selectedExcludeRarities.length > 0) {
                    matchesExcludeRarity = !selectedExcludeRarities.includes(card.data['レアリティ']);
                }

                // タグフィルター：複数選択対応（タグ無しのみも含む）
                let matchesTag = true;
                if (filterNoTagOnly) {
                    matchesTag = !card.data.tags || card.data.tags.length === 0;
                } else if (selectedFilterTags.length > 0) {
                    // 選択したタグのいずれかを持つカードのみ表示
                    matchesTag = card.data.tags && selectedFilterTags.some(tag => card.data.tags.includes(tag));
                }

                // タグ除外フィルター：選択したタグを持つカードを除外
                let matchesExcludeTag = true;
                if (selectedExcludeTags.length > 0 && card.data.tags && card.data.tags.length > 0) {
                    // 除外タグのいずれかを持っているカードを除外
                    matchesExcludeTag = !selectedExcludeTags.some(tag => card.data.tags.includes(tag));
                }

                // Advanced filters - use cardDetailsMap for latest data (CSV may have been updated)
                const details = cardDetailsMap.get(cardName) || card.data.linkedDetails || {};
                const matchesLevel = !levelFilter || (details.level && details.level.toString() === levelFilter);
                const matchesAttribute = !attributeFilter || details.attribute === attributeFilter;

                // Card type filter with AND/OR logic
                let matchesCardType = true;
                if (cardTypeFilters.length > 0) {
                    const cardType = details.cardType || '';
                    const race = details.race || '';

                    const checkTypeMatch = (type) => {
                        // 「魔法」「罠」の場合はraceフィールドもチェック
                        if (type === '魔法') {
                            return race === '魔法' || cardType.includes('魔法');
                        } else if (type === '罠') {
                            return race === '罠' || cardType.includes('罠');
                        } else {
                            // その他のタイプはcardTypeでチェック
                            return cardType.includes(type);
                        }
                    };

                    if (cardTypeSearchMode === 'and') {
                        // AND: All selected types must be present
                        matchesCardType = cardTypeFilters.every(checkTypeMatch);
                    } else {
                        // OR: At least one selected type must be present
                        matchesCardType = cardTypeFilters.some(checkTypeMatch);
                    }
                }

                // NOT card type filter (exclusion)
                let matchesNotCardType = true;
                if (notCardTypeFilters.length > 0) {
                    const cardType = details.cardType || '';
                    const race = details.race || '';

                    const checkTypeMatch = (type) => {
                        if (type === 'EXモンスター') {
                            // EXモンスター = 融合、シンクロ、エクシーズ、リンク
                            return cardType.includes('融合') || cardType.includes('シンクロ') ||
                                   cardType.includes('エクシーズ') || cardType.includes('リンク');
                        } else if (type === '魔法') {
                            return race === '魔法' || cardType.includes('魔法');
                        } else if (type === '罠') {
                            return race === '罠' || cardType.includes('罠');
                        } else {
                            return cardType.includes(type);
                        }
                    };

                    // Exclude cards that have ANY of the NOT selected types
                    matchesNotCardType = !notCardTypeFilters.some(checkTypeMatch);
                }

                const matchesRace = !raceFilter || details.race === raceFilter;
                const matchesAttack = !attackFilter || (details.attack && details.attack.toString() === attackFilter);
                const matchesDefense = !defenseFilter || (details.defense && details.defense.toString() === defenseFilter);

                return matchesNameSearch && matchesCodeSearch && matchesRarity && matchesExcludeRarity && matchesTag && matchesExcludeTag && matchesLevel && matchesAttribute && matchesCardType && matchesNotCardType && matchesRace && matchesAttack && matchesDefense;
            });

            console.log('Filtered cards count:', filteredCards.length);

            // Add unowned cards if checkbox is checked
            if (showUnowned) {
                // Get owned card names
                const ownedCardNames = new Set(allCards.map(card => card.data['名前']));

                // Create unowned cards from cardDetailsMap
                const unownedCards = [];
                for (const [cardName, details] of cardDetailsMap) {
                    if (!ownedCardNames.has(cardName)) {
                        // Apply filters to unowned cards too
                        const cardCode = details.cardId || '';

                        // Check if matches name search
                        let matchesNameSearch = !searchTerm;
                        if (searchTerm) {
                            if (normalizeForSearch(cardName).includes(normalizedSearchTerm)) {
                                matchesNameSearch = true;
                            } else if (possibleCardNames.includes(cardName)) {
                                matchesNameSearch = true;
                            }
                        }

                        // Check if matches code search
                        let matchesCodeSearch = !codeSearchTerm;
                        if (codeSearchTerm) {
                            if (cardCode.toLowerCase().includes(codeSearchTerm)) {
                                matchesCodeSearch = true;
                            }
                        }

                        // Note: unowned cards don't have rarity or tags, so skip those filters
                        const hasRarityFilter = selectedFilterRarities.length > 0;
                        const hasTagFilter = selectedFilterTags.length > 0 || filterNoTagOnly;
                        if (matchesNameSearch && matchesCodeSearch && !hasRarityFilter && !hasTagFilter) {
                            unownedCards.push({
                                id: 'unowned-' + details.cardId,
                                data: {
                                    '名前': cardName,
                                    '型番': details.cardId || '',
                                    'レアリティ': '-',
                                    '枚数': 0,
                                    'tags': [],
                                    'unowned': true,
                                    'linkedDetails': details
                                },
                                unowned: true
                            });
                        }
                    }
                }

                // Add unowned cards to filtered results
                filteredCards = [...filteredCards, ...unownedCards];
            }

            sortCards();
            currentPage = 1;
        };

        // Sort cards
        const sortCards = () => {
            const [field, direction] = currentSort.split('-');

            filteredCards.sort((a, b) => {
                let valA, valB;

                switch (field) {
                    case 'name':
                        valA = getReadingForSort(a.data['名前']);
                        valB = getReadingForSort(b.data['名前']);
                        break;
                    case 'code':
                        valA = a.data['型番'] || '';
                        valB = b.data['型番'] || '';
                        break;
                    case 'quantity':
                        valA = parseInt(a.data['枚数']) || 0;
                        valB = parseInt(b.data['枚数']) || 0;
                        break;
                    case 'rarity': {
                        const order = JSON.parse(localStorage.getItem('customRarityOrder') || 'null') || RARITY_ORDER;
                        const idxA = order.indexOf(a.data['レアリティ'] || '');
                        const idxB = order.indexOf(b.data['レアリティ'] || '');
                        valA = idxA === -1 ? 9999 : idxA;
                        valB = idxB === -1 ? 9999 : idxB;
                        break;
                    }
                    default:
                        return 0;
                }

                let cmp = 0;
                if (typeof valA === 'string') {
                    cmp = valA.localeCompare(valB, 'ja');
                } else {
                    cmp = valA > valB ? 1 : valA < valB ? -1 : 0;
                }

                if (cmp !== 0) {
                    return direction === 'asc' ? cmp : -cmp;
                }

                // Tie-breaker: If values are equal, sort by rarity (highest first)
                if (field !== 'rarity') {
                    const order = JSON.parse(localStorage.getItem('customRarityOrder') || 'null') || RARITY_ORDER;
                    const idxA = order.indexOf(a.data['レアリティ'] || '');
                    const idxB = order.indexOf(b.data['レアリティ'] || '');
                    const rareValA = idxA === -1 ? 9999 : idxA;
                    const rareValB = idxB === -1 ? 9999 : idxB;
                    return rareValA - rareValB; // Ascending index means higher rarity first
                }

                return 0;
            });
        };

        // グリッドの実際の列数から itemsPerPage を列数の倍数に丸め上げるヘルパー
        const getActualItemsPerPage = () => {
            const grid = document.getElementById('card-grid');
            if (!grid) return itemsPerPage;
            // モバイル size-small は固定5列
            if (currentGridSize === 'small' && window.innerWidth <= 768) {
                return Math.ceil(itemsPerPage / 5) * 5;
            }
            // サイズ別の minmax 最小幅（モバイルオーバーライドも考慮）
            const isMobile = window.innerWidth <= 768;
            const minWidths = { small: 150, medium: isMobile ? 150 : 200, large: isMobile ? 200 : 280 };
            const minW = minWidths[currentGridSize] || 200;
            const gap = 16; // 1rem
            const cols = Math.max(1, Math.floor((grid.offsetWidth + gap) / (minW + gap)));
            return Math.ceil(itemsPerPage / cols) * cols;
        };

        // Handle drag start for cards
        const handleDragStart = (event, index) => {
            const startIndex = (currentPage - 1) * getActualItemsPerPage();
            const cardIndex = startIndex + index;
            draggedCard = filteredCards[cardIndex];
            event.dataTransfer.effectAllowed = 'copy';
            event.target.classList.add('dragging');
        };

        // Render cards (with async image loading)
        const renderCards = async () => {
            const grid = document.getElementById('card-grid');
            grid.className = `card-grid size-${currentGridSize}`;

            const startIndex = (currentPage - 1) * getActualItemsPerPage();
            const endIndex = startIndex + getActualItemsPerPage();
            const pageCards = filteredCards.slice(startIndex, endIndex);

            if (pageCards.length === 0) {
                grid.innerHTML = `
                    <div class="text-center py-5 w-100">
                        <i class="bi bi-inbox" style="font-size: 4rem; color: #ccc;"></i>
                        <p class="text-muted mt-3">該当するカードはありません。</p>
                    </div>
                `;
            } else {
                // First render with placeholders
                grid.innerHTML = pageCards.map((card, index) => {
                    const tags = (card.data.tags || []).map(tag =>
                        `<span class="badge bg-secondary">${escapeHtml(tag)}</span>`
                    ).join(' ');

                    const isUnowned = card.unowned || card.data.unowned;
                    const unownedClass = isUnowned ? ' unowned' : '';
                    const unownedBadge = isUnowned ? '<span class="unowned-badge">未所持</span>' : '';

                    // Calculate stock display with deck usage
                    let stockBadge = '';
                    if (!isUnowned) {
                        const totalStock = card.data['枚数'] || 0;

                        if (currentListType === 'wishlist') {
                            // For wishlist, show only "必要数" without deck usage
                            stockBadge = `<span class="stock-badge">必要数 ${totalStock}枚</span>`;
                        } else {
                            // For collection, show stock with deck usage
                            const { totalUsed } = deps.getCardUsageInDecks(card.id);
                            const availableStock = totalStock - totalUsed;

                            if (totalUsed > 0) {
                                stockBadge = `<span class="stock-badge">${availableStock}(${totalStock})枚</span>`;
                            } else {
                                stockBadge = `<span class="stock-badge">${totalStock}枚</span>`;
                            }
                        }
                    }

                    const decodedName = decodeHtmlEntities(card.data['名前']);
                    // Allow dragging for both owned and unowned cards, but only owned cards can open edit modal
                    const onclickAttr = isUnowned ? '' : `onclick="openCardEditModal('${card.id}')"`;
                    const draggableAttr = `draggable="true" ondragstart="handleDragStart(event, ${index})" class="draggable"`;

                    const { outerClasses, overlayHtml } = buildEffectHtml(card.data['レアリティ'] || '');

                    return `
                        <div class="card-item${unownedClass}" ${onclickAttr} ${draggableAttr} data-card-index="${index}" data-card-id="${card.id}">
                            <div class="card-image-container" id="card-img-container-${index}">
                                ${overlayHtml}
                                ${stockBadge}
                                ${unownedBadge}
                                <i class="bi bi-card-image card-image-placeholder"></i>
                            </div>
                            <div class="card-info">
                                <div class="card-name">${escapeHtml(decodedName)}</div>
                                <div class="d-flex align-items-center mb-1 gap-2">
                                    <div class="card-code mb-0">${escapeHtml(card.data['型番'])}</div>
                                    <div class="card-rarity mb-0">
                                        <span class="badge bg-info">${escapeHtml(card.data['レアリティ'])}</span>
                                    </div>
                                </div>
                                <div class="card-tags">
                                    ${tags || '<span class="text-muted" style="font-size: 0.7rem;">タグなし</span>'}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');

                const imageContainers = grid.querySelectorAll('.card-image-container');
                deps.imageQueue.observe('collection', imageContainers, (container, index) => {
                    const card = pageCards[index];
                    const decodedCardName = decodeHtmlEntities(card.data['名前']);
                    const ciid = card.data.selectedCiid || '1';
                    const locale = card.data.cardLang || 'ja';
                    const overrideCardId = card.data.customCardId || null;

                    const showReload = () => {
                        if (!container.isConnected || container.querySelector('.card-image-reload')) return;
                        if (!container.querySelector('.card-image-placeholder')) {
                            const placeholder = document.createElement('i');
                            placeholder.className = 'bi bi-card-image card-image-placeholder';
                            container.appendChild(placeholder);
                        }
                        const reloadBtn = document.createElement('button');
                        reloadBtn.className = 'card-image-reload';
                        reloadBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>再読み込み';
                        reloadBtn.onclick = (event) => {
                            event.stopPropagation();
                            reloadBtn.remove();
                            deps.imageQueue.enqueueCurrent('collection', createImageTask());
                        };
                        container.appendChild(reloadBtn);
                    };

                    const createImageTask = () => ({
                        element: container,
                        key: `${overrideCardId || cardDetailsMap.get(decodedCardName)?.cardId || ''}_${ciid}_${locale}`,
                        load: () => getCardImageUrl(decodedCardName, ciid, overrideCardId, locale),
                        apply: (imageUrl) => {
                            if (!imageUrl) {
                                showReload();
                                return;
                            }
                            const img = document.createElement('img');
                            img.src = imageUrl;
                            img.alt = decodedCardName;
                            img.loading = 'lazy';
                            img.onerror = () => {
                                img.remove();
                                showReload();
                            };
                            container.querySelector('.card-image-placeholder')?.remove();
                            container.querySelector('.card-image-reload')?.remove();
                            container.appendChild(img);
                        },
                        onError: (error) => {
                            console.error(`Failed to load image for ${card.data['名前']}:`, error);
                            showReload();
                        }
                    });

                    return createImageTask();
                });
            }

            if (pageCards.length === 0) deps.imageQueue.cancel('collection');

            updatePagination();
            updateStats();

            // Add touch event support for mobile drag-and-drop
            const cardItems = grid.querySelectorAll('.card-item.draggable');
            cardItems.forEach((item, index) => {
                let touchStartTime = 0;
                let touchMoved = false;

                item.addEventListener('touchstart', (e) => {
                    touchStartTime = Date.now();
                    touchMoved = false;

                    // Set dragged card
                    const startIndex = (currentPage - 1) * getActualItemsPerPage();
                    const cardIndex = startIndex + index;
                    draggedCard = filteredCards[cardIndex];
                }, { passive: true });

                item.addEventListener('touchmove', (e) => {
                    touchMoved = true;
                }, { passive: true });

                item.addEventListener('touchend', (e) => {
                    const touchDuration = Date.now() - touchStartTime;

                    // If it was a quick tap (not a drag), handle as click
                    if (!touchMoved && touchDuration < 300) {
                        // Simulate click for opening edit modal
                        const isUnowned = item.classList.contains('unowned');
                        if (!isUnowned) {
                            const cardId = item.dataset.cardId;
                            if (cardId) {
                                openCardEditModal(cardId);
                            }
                        }
                    }

                    // Reset
                    draggedCard = null;
                }, { passive: true });
            });
        };

        // Update pagination
        const updatePagination = () => {
            const totalPages = Math.ceil(filteredCards.length / getActualItemsPerPage());
            const paginationHtml = `
                <button class="btn btn-outline-primary btn-sm" ${currentPage <= 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">
                    <i class="bi bi-chevron-left"></i> 前へ
                </button>
                <span class="mx-3">
                    <strong>${currentPage}</strong> / ${totalPages} ページ
                </span>
                <button class="btn btn-outline-primary btn-sm" ${currentPage >= totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">
                    次へ <i class="bi bi-chevron-right"></i>
                </button>
            `;

            document.getElementById('pagination-top').innerHTML = paginationHtml;
            document.getElementById('pagination-bottom').innerHTML = paginationHtml;
        };

        // Update stats
        const updateStats = () => {
            const totalQuantity = allCards.reduce((sum, card) => sum + (parseInt(card.data['枚数']) || 0), 0);
            const uniqueCount = allCards.length;
            const filteredCount = filteredCards.length;
            const totalPages = Math.ceil(filteredCards.length / getActualItemsPerPage());

            document.getElementById('total-cards').textContent = totalQuantity;
            document.getElementById('unique-cards').textContent = uniqueCount;
            document.getElementById('filtered-cards').textContent = filteredCount;
            document.getElementById('current-page-info').textContent = `${currentPage}/${totalPages}`;
        };

        // Populate filter options
        const populateFilterOptions = () => {
            // Rarities
            const rarities = [...new Set(allCards.map(card => card.data['レアリティ']).filter(Boolean))].sort();

            // Tags
            const tags = [...new Set(allCards.flatMap(card => card.data.tags || []))].sort();

            // === Tag Filter buttons (inclusion) ===
            const tagFilterSection = document.getElementById('tag-filter-section');
            const tagFilterContainer = document.getElementById('tag-filter-buttons');
            if (tags.length > 0) {
                tagFilterSection.style.display = 'block';
                // "タグ無しのみ" special button + tag buttons
                const noTagActive = filterNoTagOnly ? ' active' : '';
                let buttonsHtml = `<button type="button" class="tag-filter-btn no-tag-btn${noTagActive}" data-tag="__no_tag__">
                    <i class="bi bi-tag"></i> タグ無し
                </button>`;
                buttonsHtml += tags.map(t => {
                    const isActive = selectedFilterTags.includes(t) ? ' active' : '';
                    return `<button type="button" class="tag-filter-btn${isActive}" data-tag="${escapeHtml(t)}">
                        <i class="bi bi-tag-fill"></i> ${escapeHtml(t)}
                    </button>`;
                }).join('');
                tagFilterContainer.innerHTML = buttonsHtml;

                // Attach event listeners to tag filter buttons
                tagFilterContainer.querySelectorAll('.tag-filter-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const tag = btn.dataset.tag;
                        if (tag === '__no_tag__') {
                            // Toggle "no tag" mode
                            filterNoTagOnly = !filterNoTagOnly;
                            btn.classList.toggle('active');
                            // Deselect all other tag filter buttons when "no tag" is active
                            if (filterNoTagOnly) {
                                selectedFilterTags = [];
                                tagFilterContainer.querySelectorAll('.tag-filter-btn:not(.no-tag-btn)').forEach(b => b.classList.remove('active'));
                            }
                        } else {
                            // When selecting a specific tag, deactivate "no tag" mode
                            if (filterNoTagOnly) {
                                filterNoTagOnly = false;
                                tagFilterContainer.querySelector('.no-tag-btn')?.classList.remove('active');
                            }
                            const index = selectedFilterTags.indexOf(tag);
                            if (index > -1) {
                                selectedFilterTags.splice(index, 1);
                                btn.classList.remove('active');
                            } else {
                                selectedFilterTags.push(tag);
                                btn.classList.add('active');
                            }
                        }
                        applyFilters();
                        renderCards();
                    });
                });
            } else {
                tagFilterSection.style.display = 'none';
                tagFilterContainer.innerHTML = '';
            }

            // === Tag Exclude buttons ===
            const tagExcludeSection = document.getElementById('tag-exclude-section');
            const tagExcludeContainer = document.getElementById('tag-exclude-buttons');
            if (tags.length > 0) {
                tagExcludeSection.style.display = 'block';
                tagExcludeContainer.innerHTML = tags.map(t => {
                    const isActive = selectedExcludeTags.includes(t) ? ' active' : '';
                    return `<button type="button" class="tag-exclude-btn${isActive}" data-tag="${escapeHtml(t)}">
                        <i class="bi bi-x-circle"></i> ${escapeHtml(t)}
                    </button>`;
                }).join('');

                // Attach event listeners to tag exclude buttons
                tagExcludeContainer.querySelectorAll('.tag-exclude-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const tag = btn.dataset.tag;
                        const index = selectedExcludeTags.indexOf(tag);
                        if (index > -1) {
                            selectedExcludeTags.splice(index, 1);
                            btn.classList.remove('active');
                        } else {
                            selectedExcludeTags.push(tag);
                            btn.classList.add('active');
                        }
                        applyFilters();
                        renderCards();
                    });
                });
            } else {
                tagExcludeSection.style.display = 'none';
                tagExcludeContainer.innerHTML = '';
            }

            // === Rarity Filter buttons (inclusion) ===
            const rarityFilterSection = document.getElementById('rarity-filter-section');
            const rarityFilterContainer = document.getElementById('rarity-filter-buttons');
            if (rarities.length > 0) {
                rarityFilterSection.style.display = 'block';
                rarityFilterContainer.innerHTML = rarities.map(r => {
                    const isActive = selectedFilterRarities.includes(r) ? ' active' : '';
                    return `<button type="button" class="rarity-filter-btn${isActive}" data-rarity="${escapeHtml(r)}">
                        <i class="bi bi-gem"></i> ${escapeHtml(r)}
                    </button>`;
                }).join('');

                // Attach event listeners to rarity filter buttons
                rarityFilterContainer.querySelectorAll('.rarity-filter-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const rarity = btn.dataset.rarity;
                        const index = selectedFilterRarities.indexOf(rarity);
                        if (index > -1) {
                            selectedFilterRarities.splice(index, 1);
                            btn.classList.remove('active');
                        } else {
                            selectedFilterRarities.push(rarity);
                            btn.classList.add('active');
                        }
                        applyFilters();
                        renderCards();
                    });
                });
            } else {
                rarityFilterSection.style.display = 'none';
                rarityFilterContainer.innerHTML = '';
            }

            // === Rarity Exclude buttons ===
            const rarityExcludeSection = document.getElementById('rarity-exclude-section');
            const rarityExcludeContainer = document.getElementById('rarity-exclude-buttons');
            if (rarities.length > 0) {
                rarityExcludeSection.style.display = 'block';
                rarityExcludeContainer.innerHTML = rarities.map(r => {
                    const isActive = selectedExcludeRarities.includes(r) ? ' active' : '';
                    return `<button type="button" class="rarity-exclude-btn${isActive}" data-rarity="${escapeHtml(r)}">
                        <i class="bi bi-x-circle"></i> ${escapeHtml(r)}
                    </button>`;
                }).join('');

                // Attach event listeners to rarity exclude buttons
                rarityExcludeContainer.querySelectorAll('.rarity-exclude-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const rarity = btn.dataset.rarity;
                        const index = selectedExcludeRarities.indexOf(rarity);
                        if (index > -1) {
                            selectedExcludeRarities.splice(index, 1);
                            btn.classList.remove('active');
                        } else {
                            selectedExcludeRarities.push(rarity);
                            btn.classList.add('active');
                        }
                        applyFilters();
                        renderCards();
                    });
                });
            } else {
                rarityExcludeSection.style.display = 'none';
                rarityExcludeContainer.innerHTML = '';
            }
        };

        // Utility functions
        const decodeHtmlEntities = (str) => {
            if (str == null) return '';
            const textarea = document.createElement('textarea');
            textarea.innerHTML = str;
            return textarea.value;
        };

        const escapeHtml = (str) => {
            if (str == null) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        // Global functions
        const changePage = (page) => {
            currentPage = page;
            renderCards();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        const openCardEditModal = async (cardId) => {
            // Don't open edit modal if deck builder is active
            if (deps.getCurrentDeck()) return;

            // Find the card in current list
            const card = allCards.find(c => c.id === cardId);
            if (!card) return;

            currentEditingCard = card;

            // Populate panel with card data immediately (synchronous)
            const decodedName = decodeHtmlEntities(card.data['名前']);
            document.getElementById('panelCardName').textContent = decodedName;
            document.getElementById('panelQuantity').value = card.data['枚数'] || 0;
            document.getElementById('panelTags').value = (card.data.tags || []).join(', ');
            document.getElementById('panelCustomCardId').value = card.data.customCardId || '';
            document.getElementById('panelCardLang').value = card.data.cardLang || 'ja';
            document.getElementById('panelCode').textContent = card.data['型番'] || '-';
            document.getElementById('panelRarity').textContent = card.data['レアリティ'] || '-';

            // Display deck usage
            const { usageMap, totalUsed } = deps.getCardUsageInDecks(cardId);
            const deckUsageSection = document.getElementById('deckUsageSection');
            const deckUsageList = document.getElementById('deckUsageList');

            if (totalUsed > 0) {
                let usageHTML = '';
                for (const [deckName, count] of Object.entries(usageMap)) {
                    usageHTML += `<div style="margin-bottom: 0.3rem;">・${deckName}: ${count}枚</div>`;
                }
                deckUsageList.innerHTML = usageHTML;
                deckUsageSection.style.display = 'block';
            } else {
                deckUsageSection.style.display = 'none';
            }

            // Open panel immediately
            document.getElementById('editPanelOverlay').classList.add('show');
            document.getElementById('editPanel').classList.add('show');

            // Hide illustration selector initially
            document.getElementById('illustrationSelector').style.display = 'none';

            // Load card image and illustrations asynchronously (don't block panel opening)
            const details = cardDetailsMap.get(decodedName);
            let currentCiid = card.data.selectedCiid || '1';  // Use saved ciid if available
            const customCardId = card.data.customCardId || null;
            const cardLang = card.data.cardLang || 'ja';

            // Load image first (fast)
            const panelImage = document.getElementById('panelCardImage');
            console.log(`Loading initial card image for: ${decodedName}, ciid: ${currentCiid}, locale: ${cardLang}`);
            deps.imageQueue.cancel('edit-panel-image');
            deps.imageQueue.enqueueCurrent('edit-panel-image', {
                element: panelImage,
                key: `${customCardId || details?.cardId || ''}_${currentCiid}_${cardLang}`,
                load: () => getCardImageUrl(decodedName, currentCiid, customCardId, cardLang),
                apply: (imageUrl) => {
                    console.log('Initial image URL:', imageUrl);
                    if (imageUrl) {
                        panelImage.src = imageUrl;
                        panelImage.style.display = 'block';
                        panelImage.dataset.currentCiid = currentCiid;
                        console.log('Panel image set to:', panelImage.src, 'with ciid:', currentCiid);
                    } else {
                        console.log('No image URL found, hiding panel image');
                        panelImage.style.display = 'none';
                    }
                },
                onError: (error) => {
                    console.error(`Failed to load panel image for ${decodedName}:`, error);
                    panelImage.style.display = 'none';
                }
            });

            // Fetch illustrations in background (slower)
            const effectiveCardId = customCardId || details?.cardId;
            if (effectiveCardId) {
                console.log(`Fetching illustrations for card: ${decodedName}, cardId: ${effectiveCardId}`);

                const proxyUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                    ? 'http://localhost:3000'
                    : 'https://ygoh-list.onrender.com';

                fetch(`${proxyUrl}/card-detail?cid=${effectiveCardId}`)
                    .then(response => response.json())
                    .then(cardDetail => {
                        console.log('Card detail response:', cardDetail);
                        console.log('Illustrations:', cardDetail.illustrations);

                        if (cardDetail.illustrations && cardDetail.illustrations.length > 1) {
                            const illustrations = cardDetail.illustrations;
                            console.log(`Found ${illustrations.length} illustrations, showing selector`);

                            // Show illustration selector
                            document.getElementById('illustrationSelector').style.display = 'block';

                            // Setup illustration selector
                            setupIllustrationSelector(illustrations, currentCiid, panelImage);
                        } else {
                            console.log('Single illustration card, keeping selector hidden');
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching card illustrations:', error);
                    });
            }
        };

        // Helper function to setup illustration selector
        const setupIllustrationSelector = (illustrations, currentCiid, panelImage) => {
            const changeBtn = document.getElementById('changeIllustrationBtn');
            const optionsDiv = document.getElementById('illustrationOptions');

            // Clear previous options
            optionsDiv.innerHTML = '';

            // Toggle illustration options
            changeBtn.onclick = () => {
                console.log('=== CHANGE ILLUSTRATION BUTTON CLICKED ===');
                const isVisible = optionsDiv.style.display !== 'none';
                console.log('Options currently visible:', isVisible);
                optionsDiv.style.display = isVisible ? 'none' : 'flex';

                // Load thumbnails if first time opening
                if (!isVisible && optionsDiv.children.length === 0) {
                    console.log('Loading illustration thumbnails...');
                    illustrations.forEach((ill, index) => {
                        const img = document.createElement('img');
                        img.src = ill.imageUrl;
                        img.className = 'illustration-option';
                        if (ill.ciid === currentCiid) {
                            img.classList.add('active');
                        }
                        img.title = `イラスト ${ill.ciid}`;
                        img.onclick = async () => {
                            console.log('=== ILLUSTRATION CHANGE CLICKED ===');
                            console.log('Selected illustration:', ill);
                            console.log('Previous ciid:', panelImage.dataset.currentCiid);
                            console.log('New ciid:', ill.ciid);
                            console.log('New imageUrl:', ill.imageUrl);

                            // Update main panel image
                            panelImage.src = ill.imageUrl;
                            panelImage.dataset.currentCiid = ill.ciid;
                            console.log('Panel image updated. Current src:', panelImage.src);

                            // Update gallery card image
                            if (currentEditingCard) {
                                const galleryCardItem = document.querySelector(`.card-item[data-card-id="${currentEditingCard.id}"]`);
                                const galleryCardImg = galleryCardItem?.querySelector('img');
                                if (galleryCardImg) {
                                    console.log('Updating gallery card image for card ID:', currentEditingCard.id);
                                    galleryCardImg.src = ill.imageUrl;
                                    console.log('Gallery card image updated to:', ill.imageUrl);
                                } else {
                                    console.warn('Gallery card image element not found for card ID:', currentEditingCard.id);
                                    console.warn('Gallery card item:', galleryCardItem);
                                }

                                // Store ciid in card data and save to Firestore
                                currentEditingCard.selectedCiid = ill.ciid;
                                currentEditingCard.data.selectedCiid = ill.ciid;
                                console.log('Stored ciid in card data:', ill.ciid);

                                // Save via API
                                if (deps.getCurrentUser()) {
                                    api.updateCard(currentEditingCard.id, {
                                        selectedCiid: ill.ciid,
                                    }).then(() => {
                                        console.log('Selected ciid saved via API');
                                        // Update cache and metadata
                                        saveGalleryToCache();
                                        updateGalleryMetadata();
                                    }).catch(error => {
                                        console.error('Error saving selectedCiid to Firestore:', error);
                                    });
                                }
                            }

                            // Update active state
                            optionsDiv.querySelectorAll('.illustration-option').forEach(opt => {
                                opt.classList.remove('active');
                            });
                            img.classList.add('active');

                            // Close options
                            optionsDiv.style.display = 'none';
                            console.log('Illustration options closed');
                        };
                        optionsDiv.appendChild(img);
                    });
                }
            };
        };

        // Close panel function
        const closeEditPanel = () => {
            document.getElementById('editPanelOverlay').classList.remove('show');
            document.getElementById('editPanel').classList.remove('show');

            // Clear illustration options
            const optionsDiv = document.getElementById('illustrationOptions');
            optionsDiv.innerHTML = '';
            optionsDiv.style.display = 'none';
            document.getElementById('illustrationSelector').style.display = 'none';
        };


        // Event listeners
        document.getElementById('items-per-page').addEventListener('change', (e) => {
            itemsPerPage = parseInt(e.target.value);
            currentPage = 1;
            renderCards();
        });

        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                e.target.closest('button').classList.add('active');
                currentGridSize = e.target.closest('button').dataset.size;
                localStorage.setItem('galleryGridSize', currentGridSize);
                renderCards();
            });
        });

        document.getElementById('sort-select').addEventListener('change', (e) => {
            currentSort = e.target.value;
            localStorage.setItem('gallerySortOrder', currentSort);
            applyFilters();
            renderCards();
        });

        // 演出トグル
        const fxToggleBtn = document.getElementById('fx-toggle-btn');
        const cardGrid = document.getElementById('card-grid');
        fxToggleBtn.addEventListener('click', () => {
            const isOn = cardGrid.classList.toggle('fx-disabled');
            fxToggleBtn.classList.toggle('active', !isOn);
            localStorage.setItem('galleryFxEnabled', (!isOn).toString());
        });

        document.getElementById('search-input').addEventListener('input', () => {
            applyFilters();
            renderCards();
        });

        document.getElementById('code-search-input').addEventListener('input', () => {
            applyFilters();
            renderCards();
        });

        document.getElementById('clear-filters').addEventListener('click', () => {
            document.getElementById('search-input').value = '';
            document.getElementById('code-search-input').value = '';
            if (document.getElementById('attack-filter')) document.getElementById('attack-filter').value = '';
            if (document.getElementById('defense-filter')) document.getElementById('defense-filter').value = '';

            // Clear level filter
            selectedLevel = '';
            document.querySelectorAll('.level-btn').forEach(btn => btn.classList.remove('active'));
            if (document.querySelector('.level-btn[data-level=""]')) {
                document.querySelector('.level-btn[data-level=""]').classList.add('active');
            }

            // Clear attribute filter
            selectedAttribute = '';
            document.querySelectorAll('.attribute-btn').forEach(btn => btn.classList.remove('active'));
            if (document.querySelector('.attribute-btn[data-attribute=""]')) {
                document.querySelector('.attribute-btn[data-attribute=""]').classList.add('active');
            }

            // Clear race filter
            selectedRace = '';
            document.querySelectorAll('.race-btn').forEach(btn => btn.classList.remove('active'));
            if (document.querySelector('.race-btn[data-race=""]')) {
                document.querySelector('.race-btn[data-race=""]').classList.add('active');
            }

            // Clear card type filter
            selectedCardTypes = [];
            document.querySelectorAll('.card-type-btn').forEach(btn => btn.classList.remove('active'));

            // Clear NOT card type filter
            selectedNotCardTypes = [];
            document.querySelectorAll('.card-type-not-btn').forEach(btn => btn.classList.remove('active'));

            // Clear tag filter (inclusion)
            selectedFilterTags = [];
            filterNoTagOnly = false;
            document.querySelectorAll('.tag-filter-btn').forEach(btn => btn.classList.remove('active'));

            // Clear tag exclude filter
            selectedExcludeTags = [];
            document.querySelectorAll('.tag-exclude-btn').forEach(btn => btn.classList.remove('active'));

            // Clear rarity filter (inclusion)
            selectedFilterRarities = [];
            document.querySelectorAll('.rarity-filter-btn').forEach(btn => btn.classList.remove('active'));

            // Clear rarity exclude filter
            selectedExcludeRarities = [];
            document.querySelectorAll('.rarity-exclude-btn').forEach(btn => btn.classList.remove('active'));

            // Reset card type mode to AND
            if (document.getElementById('card-type-and')) {
                document.getElementById('card-type-and').checked = true;
                cardTypeSearchMode = 'and';
            }

            applyFilters();
            renderCards();
        });

        // Level filter buttons
        document.querySelectorAll('.level-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedLevel = btn.dataset.level;
                document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                applyFilters();
                renderCards();
            });
        });

        // Attribute filter buttons
        document.querySelectorAll('.attribute-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedAttribute = btn.dataset.attribute;
                document.querySelectorAll('.attribute-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                applyFilters();
                renderCards();
            });
        });

        // Race filter buttons
        document.querySelectorAll('.race-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedRace = btn.dataset.race;
                document.querySelectorAll('.race-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                applyFilters();
                renderCards();
            });
        });

        // Card type filter buttons (multiple selection)
        document.querySelectorAll('.card-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                const index = selectedCardTypes.indexOf(type);

                if (index > -1) {
                    // Deselect
                    selectedCardTypes.splice(index, 1);
                    btn.classList.remove('active');
                } else {
                    // Select
                    selectedCardTypes.push(type);
                    btn.classList.add('active');
                }

                applyFilters();
                renderCards();
            });
        });

        // Card type search mode (AND/OR)
        document.querySelectorAll('input[name="card_type_mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                cardTypeSearchMode = e.target.value;
                if (selectedCardTypes.length > 0) {
                    applyFilters();
                    renderCards();
                }
            });
        });

        // Card type NOT filter buttons
        document.querySelectorAll('.card-type-not-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                const index = selectedNotCardTypes.indexOf(type);

                if (index > -1) {
                    // Deselect
                    selectedNotCardTypes.splice(index, 1);
                    btn.classList.remove('active');
                } else {
                    // Select
                    selectedNotCardTypes.push(type);
                    btn.classList.add('active');
                }

                applyFilters();
                renderCards();
            });
        });

        // Other advanced filters (attack and defense)
        if (document.getElementById('attack-filter')) {
            document.getElementById('attack-filter').addEventListener('input', () => {
                applyFilters();
                renderCards();
            });
        }

        if (document.getElementById('defense-filter')) {
            document.getElementById('defense-filter').addEventListener('input', () => {
                applyFilters();
                renderCards();
            });
        }

        document.getElementById('show-unowned-cards').addEventListener('change', () => {
            applyFilters();
            renderCards();
        });

        // Tab click event listeners
        document.getElementById('collection-tab').addEventListener('click', () => {
            switchListType('collection');
        });

        document.getElementById('wishlist-tab').addEventListener('click', () => {
            switchListType('wishlist');
        });

        document.getElementById('bookmark-tab').addEventListener('click', () => {
            switchListType('bookmark');
        });


        // Close panel button
        document.getElementById('closePanelBtn').addEventListener('click', closeEditPanel);
        document.getElementById('editPanelOverlay').addEventListener('click', closeEditPanel);

        // Panel save button
        document.getElementById('savePanelCardBtn').addEventListener('click', async () => {
            if (!currentEditingCard || !deps.getCurrentUser()) return;

            const newQuantity = parseInt(document.getElementById('panelQuantity').value) || 0;
            const tagsInput = document.getElementById('panelTags').value;
            const newTags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
            const customCardIdInput = document.getElementById('panelCustomCardId').value.trim();
            const newCustomCardId = customCardIdInput || null;
            const newCardLang = document.getElementById('panelCardLang').value || 'ja';

            try {
                // Determine collection path based on current list type
                await api.updateCard(currentEditingCard.id, {
                    '枚数': newQuantity,
                    tags: newTags,
                    customCardId: newCustomCardId,
                    cardLang: newCardLang,
                });

                // Update local data
                currentEditingCard.data['枚数'] = newQuantity;
                currentEditingCard.data.tags = newTags;
                currentEditingCard.data.customCardId = newCustomCardId;
                currentEditingCard.data.cardLang = newCardLang;

                // 言語が変わった場合、旧キャッシュを削除して次回再取得させる
                const cardId = newCustomCardId || cardDetailsMap.get(decodeHtmlEntities(currentEditingCard.data['名前']))?.cardId;
                if (cardId) {
                    const ciid = currentEditingCard.data.selectedCiid || '1';
                    // delete all locale variants for this card to force re-fetch
                    for (const lang of ['ja', 'ko', 'ae', 'cn']) {
                        await imageCacheManager.deleteImage(`${cardId}_${ciid}_${lang}`);
                    }
                }

                // Update cache and metadata
                saveGalleryToCache();
                await updateGalleryMetadata();

                // Close panel
                closeEditPanel();

                // Refresh display
                applyFilters();
                renderCards();

                alert('カード情報を更新しました。');
            } catch (error) {
                console.error('Error updating card:', error);
                alert('カード情報の更新に失敗しました。');
            }
        });

        // Panel delete button
        document.getElementById('deletePanelCardBtn').addEventListener('click', async () => {
            if (!currentEditingCard || !deps.getCurrentUser()) return;

            if (!confirm(`「${currentEditingCard.data['名前']}」を削除してもよろしいですか？`)) {
                return;
            }

            try {
                await api.deleteCard(currentEditingCard.id);
            } catch (error) {
                // 404 = already gone on server; still remove from local cache
                if (!error.status || error.status !== 404) {
                    console.error('Error deleting card:', error);
                    alert('カードの削除に失敗しました。');
                    return;
                }
                console.warn('Card not found on server, removing from local cache:', currentEditingCard.id);
            }

            // Remove from local data
            if (currentListType === 'collection') {
                collectionCards = collectionCards.filter(c => c.id !== currentEditingCard.id);
            } else {
                wishlistCards = wishlistCards.filter(c => c.id !== currentEditingCard.id);
            }
            allCards = currentListType === 'collection' ? collectionCards : wishlistCards;

            // Update cache and metadata
            saveGalleryToCache();
            await updateGalleryMetadata();

            // Close panel
            closeEditPanel();

            // Refresh display
            applyFilters();
            renderCards();
            populateFilterOptions();

            alert('カードを削除しました。');
        });

        const restorePreferences = () => {
            // 演出設定の復元
            if (localStorage.getItem('galleryFxEnabled') === 'false') {
                document.getElementById('card-grid').classList.add('fx-disabled');
                document.getElementById('fx-toggle-btn').classList.remove('active');
            }

            // Load saved grid size
            const savedSize = localStorage.getItem('galleryGridSize');
            if (savedSize) {
                currentGridSize = savedSize;
                document.querySelectorAll('.size-btn').forEach(btn => {
                    if (btn.dataset.size === savedSize) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }

            // Load saved list type
            const savedListType = localStorage.getItem('galleryListType');
            if (savedListType && (savedListType === 'collection' || savedListType === 'wishlist' || savedListType === 'bookmark')) {
                currentListType = savedListType;
            }

            // Load saved sort order
            const savedSortOrder = localStorage.getItem('gallerySortOrder');
            if (savedSortOrder) {
                currentSort = savedSortOrder;
                const sortSelect = document.getElementById('sort-select');
                if (sortSelect) {
                    sortSelect.value = savedSortOrder;
                }
            }

            // Load saved card details visibility preference
            const hideCardDetails = localStorage.getItem('deckBuilderHideCardDetails');
            if (hideCardDetails === 'true') {
                const deckBuilderPanel = document.getElementById('deckBuilderPanel');
                const btn = document.getElementById('toggleCardDetailsBtn');
                if (deckBuilderPanel && btn) {
                    deckBuilderPanel.classList.add('hide-card-details');
                    btn.classList.remove('btn-outline-secondary');
                    btn.classList.add('btn-secondary');
                }
            }
        };

        return {
            loadAllData,
            loadAllAliases,
            getReadingForSort,
            showLoading,
            switchListType,
            applyFilters,
            renderCards,
            updateStats,
            escapeHtml,
            decodeHtmlEntities,
            getCardImageUrl,
            changePage,
            openCardEditModal,
            handleDragStart,
            getCollectionCards: () => collectionCards,
            setCollectionCards: (value) => { collectionCards = value; },
            getWishlistCards: () => wishlistCards,
            setWishlistCards: (value) => { wishlistCards = value; },
            getBookmarkCards: () => bookmarkCards,
            setBookmarkCards: (value) => { bookmarkCards = value; },
            getDecks: () => decks,
            setDecks: (value) => { decks = value; },
            getDraggedCard: () => draggedCard,
            setDraggedCard: (value) => { draggedCard = value; },
            getCurrentListType: () => currentListType,
            setAllCards: (value) => { allCards = value; },
            getCurrentPage: () => currentPage,
            getItemsPerPage: () => itemsPerPage,
            getFilteredCards: () => filteredCards,
            restorePreferences
        };
};
