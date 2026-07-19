        import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
        import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
        import { api } from '../../api-client.js';
        import { loadMasterData } from '../shared/master-data.js';

        // Firebase configuration
        const firebaseConfig = {
            apiKey: "AIzaSyAOYKalLUb2hbghrjQUS8AWzxpLExBT7aU",
            authDomain: "ygoh-9bcf6.firebaseapp.com",
            projectId: "ygoh-9bcf6",
            storageBucket: "ygoh-9bcf6.firebasestorage.app",
            messagingSenderId: "515041224138",
            appId: "1:515041224138:web:8de47b38ed9cc1bb8afd37",
            measurementId: "G-ZGSRE8MHZ2"
        };

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);


        // Admin UIDs (can view all users regardless of public setting)
        const ADMIN_UIDS = ['tMyC2ohYVAgoDzmBs5Zx2VT8t6m1'];

        // Community state
        let isAdmin = false;
        let publicUsers = [];
        let viewingUserId = null;
        let viewingUserData = {
            collection: [],
            wishlist: [],
            decks: [],
            profile: null,
            wishlistLoaded: false,
            decksLoaded: false
        };
        let viewingCurrentType = 'collection';
        let viewingFilteredCards = [];
        let viewingCurrentPage = 1;
        const viewingItemsPerPage = 30;

        // State
        let collectionCards = [];
        let wishlistCards = [];
        let bookmarkCards = [];
        let allCards = [];
        let filteredCards = [];
        let cardDetailsMap = new Map();
        let cardReadingMap = new Map(); // Map for hiragana -> card names
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
        let currentUser = null;
        let currentPage = 1;
        let itemsPerPage = 50;
        let currentGridSize = 'medium';
        let currentSort = 'quantity-desc';
        let currentListType = 'collection'; // 'collection', 'wishlist', or 'bookmark'
        let currentEditingCard = null;
        let currentRenderingId = 0; // To prevent duplicate images when rapidly changing pages

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
        let currentDeck = null; // Currently editing deck
        const deckListPanel = document.getElementById('deckListPanel');
        let draggedCard = null; // Card being dragged from gallery
        let draggedDeckCard = null; // Deck card being dragged (for moving between decks or removing)

        // Load card reading data
        // \u5171\u901A\u30DE\u30B9\u30BF\u30FC\u30C7\u30FC\u30BF\u57FA\u76E4\uFF08js/shared/master-data.js\uFF09\u3092\u4F7F\u7528\u3002
        // CSV\u30D1\u30FC\u30B9\u306F Web Worker\u3001\u30D1\u30FC\u30B9\u6E08\u307F\u30C7\u30FC\u30BF\u306F IndexedDB \u306B\u30AD\u30E3\u30C3\u30B7\u30E5\u3055\u308C\u3001
        // \u518D\u8A2A\u6642\u306F HEAD \u30EA\u30AF\u30A8\u30B9\u30C8\u3067\u66F4\u65B0\u78BA\u8A8D\u306E\u307F\uFF08\u672A\u5909\u66F4\u306A\u3089\u518DDL\u30FB\u518D\u30D1\u30FC\u30B9\u306A\u3057\uFF09\u3002
        // \u5F15\u7528\u7B26\u5185\u30AB\u30F3\u30DE\u3082\u6B63\u3057\u304F\u30D1\u30FC\u30B9\u3059\u308B\uFF08\u65E7 split(',') \u65B9\u5F0F\u306E\u30D0\u30B0\u3092\u89E3\u6D88\uFF09\u3002
        const loadCardData = async () => {
            try {
                const master = await loadMasterData();
                // \u65E2\u5B58\u306E module \u30B9\u30B3\u30FC\u30D7\u5909\u6570\u3092\u5DEE\u3057\u66FF\u3048\u308B\uFF08\u5168\u30AF\u30ED\u30FC\u30B8\u30E3\u304C\u540C\u3058\u675F\u7E1B\u3092\u53C2\u7167\uFF09
                cardDetailsMap = master.cardDetailsMap;
                cardReadingMap = master.cardReadingMap;

                console.log(`Loaded ${cardReadingMap.size} card readings and ${cardDetailsMap.size} card details (${master.fromCache ? 'IndexedDB\u30AD\u30E3\u30C3\u30B7\u30E5' : '\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF'})`);

                // Expose cardDetailsMap on window (tests and legacy consumers rely on it)
                window.cardDetailsMap = cardDetailsMap;
            } catch (error) {
                console.error('Error loading card data:', error);
            }
        };

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
                    console.log(`Using cached image for: ${cardName} (ID: ${cardId}, ciid: ${ciid}, locale: ${locale})`);
                    return cachedImage;
                }

                // Cache miss - fetch from proxy and cache it
                console.log(`Fetching image for: ${cardName} (ID: ${cardId}, ciid: ${ciid}, locale: ${locale})`);
                const imageData = await imageCacheManager.fetchAndCache(cacheKey, cardId, ciid, locale);
                return imageData;
            } catch (error) {
                console.error(`Error loading image for ${cardName}:`, error);
                return `${PROXY_URL}/image?cid=${cardId}&ciid=${ciid}&locale=${locale}`;
            }
        };

        // ==================== LOCAL CACHE SYSTEM ====================

        // Get cache key for current user
        const getGalleryCacheKey = (type) => `galleryCache_${currentUser?.uid}_${type}`;

        // Save all data to localStorage cache
        const saveGalleryToCache = () => {
            if (!currentUser) return;

            try {
                const cacheData = {
                    collection: collectionCards,
                    wishlist: wishlistCards,
                    bookmarks: bookmarkCards,
                    decks: decks,
                    cachedAt: Date.now()
                };
                localStorage.setItem(getGalleryCacheKey('data'), JSON.stringify(cacheData));
                console.log('💾 Gallery cache saved:', collectionCards.length, 'collection,', wishlistCards.length, 'wishlist,', bookmarkCards.length, 'bookmarks,', decks.length, 'decks');
            } catch (e) {
                console.error('Failed to save gallery cache:', e);
                if (e.name === 'QuotaExceededError') {
                    localStorage.removeItem(getGalleryCacheKey('data'));
                }
            }
        };

        // Load data from localStorage cache
        const loadGalleryFromCache = () => {
            if (!currentUser) return null;

            try {
                const cached = localStorage.getItem(getGalleryCacheKey('data'));
                if (cached) {
                    const data = JSON.parse(cached);
                    console.log('📂 Gallery loaded from cache');
                    return data;
                }
            } catch (e) {
                console.error('Failed to load gallery cache:', e);
            }
            return null;
        };

        // Check if remote data is newer than cache
        const isGalleryRemoteNewer = async (cachedAt) => {
            if (!currentUser) return true;

            try {
                const meta = await api.getSyncMetadata();
                const remoteUpdatedAt = meta.updatedAt || 0;
                const isNewer = remoteUpdatedAt > cachedAt;
                console.log(`Gallery cache check: cached=${new Date(cachedAt).toLocaleString()}, remote=${new Date(remoteUpdatedAt).toLocaleString()}, needsSync=${isNewer}`);
                return isNewer;
            } catch (e) {
                console.error('Failed to check metadata:', e);
                return true;
            }
        };

        // Metadata updates handled server-side
        const updateGalleryMetadata = async () => {
            // No-op: D1 API handles metadata updates
        };

        // Deletion tracking handled server-side
        const trackDeletedId = async (cardId, colName) => {
            // No-op: D1 API handles deletion tracking
        };

        // Force sync from API (manual refresh)
        const forceGallerySync = async () => {
            if (!currentUser) return;

            showLoading(true);
            console.log('Force syncing gallery from API...');

            try {
                const [cards, wishlist, bms, dks] = await Promise.all([
                    api.getCards('collection'),
                    api.getCards('wishlist'),
                    api.getBookmarks(),
                    api.getDecks(),
                ]);
                collectionCards = cards.map(c => ({ id: c.id, data: c }));
                wishlistCards = wishlist.map(c => ({ id: c.id, data: c }));
                bookmarkCards = bms.map(b => ({ id: b.id, data: b }));
                decks = dks.map(d => ({ id: d.id, ...d }));

                saveGalleryToCache();
                switchListType(currentListType);

                console.log('✅ Gallery sync complete');
            } catch (error) {
                console.error('Gallery sync failed:', error);
                alert('同期に失敗しました。');
            } finally {
                showLoading(false);
            }
        };

        // Expose for manual sync
        window.forceGallerySync = forceGallerySync;

        // ==================== END LOCAL CACHE SYSTEM ====================

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
                await loadDecks();

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
        window.handleDragStart = (event, index) => {
            const startIndex = (currentPage - 1) * getActualItemsPerPage();
            const cardIndex = startIndex + index;
            draggedCard = filteredCards[cardIndex];
            event.dataTransfer.effectAllowed = 'copy';
            event.target.classList.add('dragging');
        };

        // Render cards (with async image loading)
        const renderCards = async () => {
            // Increment rendering ID to invalidate previous async operations
            currentRenderingId++;
            const thisRenderingId = currentRenderingId;

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
                            const { totalUsed } = getCardUsageInDecks(card.id);
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
                            <div class="card-image-container" id="card-img-container-${index}" data-rendering-id="${thisRenderingId}">
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

                // Then load images asynchronously
                pageCards.forEach(async (card, index) => {
                    const loadCardImage = async () => {
                        const container = document.getElementById(`card-img-container-${index}`);
                        if (!container) return;

                        try {
                            // Decode HTML entities in card name before fetching image
                            const decodedCardName = decodeHtmlEntities(card.data['名前']);
                            const ciid = card.data.selectedCiid || '1';  // Use saved ciid if available
                            const imageUrl = await getCardImageUrl(decodedCardName, ciid, card.data.customCardId || null, card.data.cardLang || 'ja');

                            // Check if this rendering is still valid (page hasn't changed)
                            if (parseInt(container.dataset.renderingId) !== thisRenderingId) {
                                return; // Skip adding image if page has changed
                            }

                            if (imageUrl) {
                                // Create image element
                                const img = document.createElement('img');
                                img.src = imageUrl;
                                img.alt = decodedCardName;
                                img.loading = 'lazy';

                                // Handle image error
                                img.onerror = function() {
                                    // Save parent reference before clearing
                                    const parent = this.parentElement;
                                    if (!parent) return;

                                    // Keep stock badge and show placeholder with reload button
                                    const stockBadge = parent.querySelector('.stock-badge');
                                    const unownedBadge = parent.querySelector('.unowned-badge');
                                    parent.innerHTML = '';
                                    if (stockBadge) {
                                        parent.appendChild(stockBadge);
                                    }
                                    if (unownedBadge) {
                                        parent.appendChild(unownedBadge);
                                    }
                                    const placeholder = document.createElement('i');
                                    placeholder.className = 'bi bi-card-image card-image-placeholder';
                                    parent.appendChild(placeholder);

                                    // Add reload button
                                    const reloadBtn = document.createElement('button');
                                    reloadBtn.className = 'card-image-reload';
                                    reloadBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>再読み込み';
                                    reloadBtn.onclick = (e) => {
                                        e.stopPropagation();
                                        reloadBtn.remove();
                                        loadCardImage();
                                    };
                                    parent.appendChild(reloadBtn);
                                };

                                // Clear placeholder and add image (keep stock badge)
                                const stockBadge = container.querySelector('.stock-badge');
                                const unownedBadge = container.querySelector('.unowned-badge');
                                const placeholder = container.querySelector('.card-image-placeholder');
                                const reloadBtn = container.querySelector('.card-image-reload');
                                if (placeholder) {
                                    placeholder.remove();
                                }
                                if (reloadBtn) {
                                    reloadBtn.remove();
                                }
                                container.appendChild(img);
                            } else {
                                // No image URL - show reload button
                                const existingReloadBtn = container.querySelector('.card-image-reload');
                                if (!existingReloadBtn) {
                                    const reloadBtn = document.createElement('button');
                                    reloadBtn.className = 'card-image-reload';
                                    reloadBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>再読み込み';
                                    reloadBtn.onclick = (e) => {
                                        e.stopPropagation();
                                        reloadBtn.remove();
                                        loadCardImage();
                                    };
                                    container.appendChild(reloadBtn);
                                }
                            }
                        } catch (error) {
                            console.error(`Failed to load image for ${card.data['名前']}:`, error);

                            // Show reload button on error
                            const container = document.getElementById(`card-img-container-${index}`);
                            if (container && parseInt(container.dataset.renderingId) === thisRenderingId) {
                                const existingReloadBtn = container.querySelector('.card-image-reload');
                                if (!existingReloadBtn) {
                                    const reloadBtn = document.createElement('button');
                                    reloadBtn.className = 'card-image-reload';
                                    reloadBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>再読み込み';
                                    reloadBtn.onclick = (e) => {
                                        e.stopPropagation();
                                        reloadBtn.remove();
                                        loadCardImage();
                                    };
                                    container.appendChild(reloadBtn);
                                }
                            }
                        }
                    };

                    loadCardImage();
                });
            }

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
        window.changePage = (page) => {
            currentPage = page;
            renderCards();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        window.openCardEditModal = async (cardId) => {
            // Don't open edit modal if deck builder is active
            if (currentDeck) return;

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
            const { usageMap, totalUsed } = getCardUsageInDecks(cardId);
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
            getCardImageUrl(decodedName, currentCiid, customCardId, cardLang).then(imageUrl => {
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
                                if (currentUser) {
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

        // ==================== BOOKMARK FUNCTIONS ====================

        /**
         * Add card to bookmarks
         */
        const addToBookmarks = async (cardData) => {
            if (!currentUser) return;

            try {
                const bookmarkData = {
                    名前: cardData.data['名前'],
                    型番: cardData.data['型番'],
                    レアリティ: cardData.data['レアリティ'],
                    枚数: cardData.data['枚数'] || 1,
                    tags: cardData.data.tags || [],
                    selectedCiid: cardData.data.selectedCiid,
                    addedAt: new Date().toISOString(),
                    updatedAt: Date.now()
                };

                const savedBookmark = await api.addBookmark(bookmarkData);

                console.log('Added to bookmarks:', savedBookmark.id);

                // Update local data directly
                bookmarkCards.push({ id: savedBookmark.id, data: savedBookmark });

                // Update cache and metadata
                saveGalleryToCache();
                await updateGalleryMetadata();

                // Re-render if on bookmarks tab
                if (currentListType === 'bookmark') {
                    allCards = bookmarkCards;
                    applyFilters();
                    renderCards();
                    updateStats();
                }

                alert('ブックマークに追加しました');
            } catch (error) {
                console.error('Error adding to bookmarks:', error);
                alert('ブックマークの追加に失敗しました');
            }
        };

        /**
         * Remove card from bookmarks
         */
        const removeFromBookmarks = async (cardId) => {
            if (!currentUser) return;

            try {
                await api.deleteBookmark(cardId);
            } catch (error) {
                if (!error.status || error.status !== 404) {
                    console.error('Error removing from bookmarks:', error);
                    alert('ブックマークの削除に失敗しました');
                    return;
                }
                console.warn('Bookmark not found on server, removing from local cache:', cardId);
            }

            console.log('Removed from bookmarks:', cardId);

            // Update local data directly (no Firebase re-read)
            bookmarkCards = bookmarkCards.filter(c => c.id !== cardId);

            // Update cache and metadata
            saveGalleryToCache();
            await updateGalleryMetadata();

            // Re-render if on bookmarks tab
            if (currentListType === 'bookmark') {
                allCards = bookmarkCards;
                applyFilters();
                renderCards();
                updateStats();
            }

            alert('ブックマークから削除しました');
        };

        /**
         * Check if card is bookmarked
         */
        const isBookmarked = (cardId) => {
            return bookmarkCards.some(c => c.id === cardId);
        };

        /**
         * Setup context menu for cards
         */
        const setupContextMenu = () => {
            const contextMenu = document.getElementById('contextMenu');
            const cardGrid = document.getElementById('card-grid');

            // Show context menu
            const showContextMenu = (x, y, items) => {
                contextMenu.innerHTML = items.map(item =>
                    `<div class="context-menu-item" data-action="${item.action}">
                        <i class="bi ${item.icon}"></i>${item.label}
                    </div>`
                ).join('');

                contextMenu.style.left = x + 'px';
                contextMenu.style.top = y + 'px';
                contextMenu.style.display = 'block';

                // Attach handlers
                contextMenu.querySelectorAll('.context-menu-item').forEach(el => {
                    el.addEventListener('click', () => {
                        const action = el.dataset.action;
                        const handler = items.find(i => i.action === action)?.handler;
                        if (handler) handler();
                        hideContextMenu();
                    });
                });

                // Keep within viewport
                const rect = contextMenu.getBoundingClientRect();
                if (rect.right > window.innerWidth) {
                    contextMenu.style.left = (window.innerWidth - rect.width - 10) + 'px';
                }
                if (rect.bottom > window.innerHeight) {
                    contextMenu.style.top = (window.innerHeight - rect.height - 10) + 'px';
                }
            };

            // Hide context menu
            const hideContextMenu = () => {
                contextMenu.style.display = 'none';
                contextMenu.innerHTML = '';
            };

            // Card grid right-click
            cardGrid.addEventListener('contextmenu', (e) => {
                const cardItem = e.target.closest('.card-item');
                if (!cardItem) return;

                e.preventDefault();
                e.stopPropagation();

                const cardIndex = parseInt(cardItem.dataset.cardIndex);
                const startIndex = (currentPage - 1) * itemsPerPage;
                const card = filteredCards[startIndex + cardIndex];

                if (!card) return;

                const menuItems = [];

                // Bookmark option
                if (isBookmarked(card.id)) {
                    menuItems.push({
                        label: 'ブックマークから削除',
                        icon: 'bi-bookmark-dash',
                        action: 'remove-bookmark',
                        handler: () => removeFromBookmarks(card.id)
                    });
                } else {
                    menuItems.push({
                        label: 'ブックマークに追加',
                        icon: 'bi-bookmark-plus',
                        action: 'add-bookmark',
                        handler: () => addToBookmarks(card)
                    });
                }

                showContextMenu(e.pageX, e.pageY, menuItems);
            });

            // Hide when clicking anywhere
            document.addEventListener('click', (e) => {
                if (!contextMenu.contains(e.target)) {
                    hideContextMenu();
                }
            });
        };

        // ==================== END BOOKMARK FUNCTIONS ====================

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
            if (!currentEditingCard || !currentUser) return;

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
            if (!currentEditingCard || !currentUser) return;

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

        // ==================== DECK SYSTEM ====================

        // Count card usage across all decks
        const getCardUsageInDecks = (cardId) => {
            const usageMap = {}; // { deckName: count }
            let totalUsed = 0;

            decks.forEach(deck => {
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

        // Load all decks from API
        const loadDecks = async () => {
            if (!currentUser) return;
            try {
                const result = await api.getDecks();
                decks = result.map(d => ({ id: d.id, ...d }));
                console.log(`Loaded ${decks.length} decks`);
            } catch (error) {
                console.error('Error loading decks:', error);
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
            if (!currentUser || !currentDeck) return;

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
                    const isInCollection = collectionCards.some(c => c.id === deckCard.cardId);
                    console.log('  In collection:', isInCollection);

                    if (!isInCollection) {
                        // Check if already in wishlist
                        const isInWishlist = wishlistCards.some(c => c.id === deckCard.cardId);
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
                        wishlistCards.push({ id: card.cardId, data: wishlistData });
                    }
                }

                // Update local deck data
                if (currentDeck.id) {
                    const existingDeckIndex = decks.findIndex(d => d.id === currentDeck.id);
                    if (existingDeckIndex >= 0) {
                        decks[existingDeckIndex] = { id: currentDeck.id, ...deckData };
                    }
                } else {
                    decks.push({ id: currentDeck.id, ...deckData });
                }

                // Update cache and metadata
                saveGalleryToCache();
                await updateGalleryMetadata();

                renderDeckList();
                renderCards(); // Re-render cards to update stock badges
            } catch (error) {
                console.error('Error saving deck:', error);
                alert('デッキの保存に失敗しました');
            }
        };

        // Delete deck
        const deleteDeck = async () => {
            if (!currentUser || !currentDeck || !currentDeck.id) return;

            if (!confirm('このデッキを削除しますか？')) return;

            try {
                await api.deleteDeck(currentDeck.id);

                // Remove from local data
                decks = decks.filter(d => d.id !== currentDeck.id);

                // Update cache and metadata
                saveGalleryToCache();
                await updateGalleryMetadata();

                alert('デッキを削除しました');
                closeDeckBuilder();
                renderDeckList();
                renderCards(); // Re-render cards to update stock badges
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

            // Hide delete button for new decks
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

            if (decks.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-4">
                        <i class="bi bi-inbox" style="font-size: 3rem; color: #ccc;"></i>
                        <p class="text-muted mt-2">デッキがありません</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = decks.map(deck => {
                const mainCount = deck.mainDeck ? deck.mainDeck.reduce((sum, c) => sum + c.quantity, 0) : 0;
                const extraCount = deck.extraDeck ? deck.extraDeck.reduce((sum, c) => sum + c.quantity, 0) : 0;
                const sideCount = deck.sideDeck ? deck.sideDeck.reduce((sum, c) => sum + c.quantity, 0) : 0;
                const cardCount = mainCount + extraCount + sideCount;
                const cardTypes = (deck.mainDeck?.length || 0) + (deck.extraDeck?.length || 0) + (deck.sideDeck?.length || 0);

                return `
                    <div class="deck-list-item" onclick="viewDeck('${deck.id}')">
                        <div class="deck-list-item-header">
                            <div class="deck-list-item-name">${escapeHtml(deck.name || '無題')}</div>
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
                        ${deck.memo ? `<div class="deck-list-item-memo">${escapeHtml(deck.memo)}</div>` : ''}
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
            const deck = decks.find(d => d.id === deckId);
            if (deck) {
                closeDeckList();
                openDeckBuilder(deck);
            }
        };

        // Delete deck from list
        window.deleteDeckFromList = async (deckId) => {
            const deck = decks.find(d => d.id === deckId);
            if (!deck) return;

            if (!confirm(`「${deck.name || '無題'}」を削除してもよろしいですか？`)) {
                return;
            }

            try {
                if (!currentUser) return;

                await api.deleteDeck(deckId);

                // Remove from local array
                decks = decks.filter(d => d.id !== deckId);

                // Update cache and metadata
                saveGalleryToCache();
                await updateGalleryMetadata();

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
            const deck = decks.find(d => d.id === deckId);
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
            const modal = new bootstrap.Modal(document.getElementById('deckViewModal'));
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
                        <div class="deck-view-card" data-card-name="${escapeHtml(card.name)}">
                            <div class="deck-view-card-placeholder">
                                <i class="bi bi-card-image"></i>
                            </div>
                            ${card.rarity ? `<div class="deck-view-card-rarity">${escapeHtml(card.rarity)}</div>` : ''}
                            ${card.code ? `<div class="deck-view-card-code">${escapeHtml(card.code)}</div>` : ''}
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
                    <h3>${escapeHtml(deck.name || '無題のデッキ')}</h3>
                    ${deck.memo ? `<p style="color: #6c757d;">${escapeHtml(deck.memo)}</p>` : ''}
                </div>
            `;

            html += await renderSection('メインデッキ', deck.mainDeck, 'view-main-deck');
            html += await renderSection('エクストラデッキ', deck.extraDeck, 'view-extra-deck');
            html += await renderSection('サイドデッキ', deck.sideDeck, 'view-side-deck');

            container.innerHTML = html;

            // Load images asynchronously
            const loadSectionImages = async (cards, sectionId) => {
                if (!cards || cards.length === 0) return;

                const expandedCards = cards.flatMap(card =>
                    Array(card.quantity).fill(card)
                );

                const cardElements = document.querySelectorAll(`#${sectionId} .deck-view-card`);

                for (let i = 0; i < expandedCards.length; i++) {
                    const card = expandedCards[i];
                    const cardElement = cardElements[i];

                    if (!cardElement) continue;

                    try {
                        // Decode HTML entities in card name before fetching image
                        const decodedCardName = decodeHtmlEntities(card.name);
                        // Use selectedCiid if available, otherwise default to '1'
                        const ciid = card.selectedCiid || '1';
                        const imageUrl = await getCardImageUrl(decodedCardName, ciid);
                        if (imageUrl) {
                            // Replace placeholder with image, keeping code and rarity elements
                            const placeholder = cardElement.querySelector('.deck-view-card-placeholder');
                            if (placeholder) {
                                placeholder.outerHTML = `<img src="${imageUrl}" alt="${escapeHtml(decodedCardName)}">`;
                            }
                        }
                    } catch (error) {
                        console.error(`Failed to load image for ${card.name}:`, error);
                    }
                }
            };

            // Load images for all sections
            await Promise.all([
                loadSectionImages(deck.mainDeck, 'view-main-deck'),
                loadSectionImages(deck.extraDeck, 'view-extra-deck'),
                loadSectionImages(deck.sideDeck, 'view-side-deck')
            ]);
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

                const canvas = await html2canvas(content, {
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
                const canvas = await html2canvas(grid, {
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
                    return;
                }

                if (placeholder) placeholder.style.display = 'none';

                // First render placeholder cards in grid (repeat each card by its quantity)
                container.innerHTML = `<div class="deck-cards-grid">` + cards.flatMap((deckCard, index) => {
                    const decodedCardName = decodeHtmlEntities(deckCard.name);
                    // Check if card is unowned
                    const isUnowned = !collectionCards.some(c => c.id === deckCard.cardId);
                    const unownedClass = isUnowned ? ' unowned' : '';
                    return Array(deckCard.quantity).fill(null).map((_, copyIndex) => {
                        return `
                        <div class="deck-card-item${unownedClass}" data-card-index="${index}" data-copy-index="${copyIndex}" data-deck-type="${deckType}" data-card-id="${deckCard.cardId}" draggable="true">
                            <div class="deck-card-image-container">
                                <img data-card-name="${escapeHtml(decodedCardName)}" alt="${escapeHtml(decodedCardName)}" style="display:none;">
                                <div class="deck-card-image-placeholder">
                                    <i class="bi bi-card-image"></i>
                                </div>
                                <div class="deck-card-rarity">${escapeHtml(deckCard.rarity || '')}</div>
                                <div class="deck-card-code">${escapeHtml(deckCard.code || '')}</div>
                            </div>
                        </div>
                    `;
                    });
                }).join('') + `</div>`;

                // Then load images asynchronously
                const grid = container.querySelector('.deck-cards-grid');
                if (grid) {
                    for (let i = 0; i < cards.length; i++) {
                        const card = cards[i];
                        const cardItems = grid.querySelectorAll(`[data-card-index="${i}"]`);

                        try {
                            // Decode HTML entities in card name before fetching image
                            const decodedCardName = decodeHtmlEntities(card.name);
                            // Use selectedCiid if available, otherwise default to '1'
                            const ciid = card.selectedCiid || '1';
                            const imageUrl = await getCardImageUrl(decodedCardName, ciid);
                            if (imageUrl) {
                                // Apply the same image to all copies of this card
                                cardItems.forEach(cardItem => {
                                    const img = cardItem.querySelector('img');
                                    const placeholder = cardItem.querySelector('.deck-card-image-placeholder');
                                    img.src = imageUrl;
                                    img.style.display = 'block';
                                    placeholder.style.display = 'none';
                                });
                            }
                        } catch (error) {
                            console.error(`Failed to load image for ${card.name}:`, error);
                        }
                    }

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
                    if (draggedCard) {
                        addCardToDeck(draggedCard, deckType);
                        draggedCard = null;
                    }
                    // Handle card from deck (moving between decks)
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
                        if (draggedCard) {
                            addCardToDeck(draggedCard, deckType);
                            draggedCard = null;
                        }
                        // Handle card from deck (moving between decks)
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

        // Initialize context menu
        setupContextMenu();

        // ==================== END DECK SYSTEM ====================

        // ==================== COMMUNITY SYSTEM ====================

        // Load user's public profile settings
        const loadPublicProfile = async () => {
            if (!currentUser) return;

            try {
                const profile = await api.getProfile(currentUser.uid).catch(() => null);

                if (profile) {
                    document.getElementById('public-profile-toggle').checked = profile.isPublic || false;
                    document.getElementById('display-name-input').value = profile.displayName || '';

                    if (profile.isPublic && profile.shareToken) {
                        const shareUrl = `${window.location.origin}${window.location.pathname}?view=${currentUser.uid}`;
                        document.getElementById('share-link-input').value = shareUrl;
                    }
                } else {
                    // Initialize profile for new users
                    const defaultDisplayName = currentUser.email?.split('@')[0] || 'Anonymous';
                    await api.updateProfile({
                        isPublic: false,
                        displayName: defaultDisplayName,
                        shareToken: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
                    });
                    document.getElementById('display-name-input').value = defaultDisplayName;
                    console.log('Initialized public profile for new user (private by default)');
                }
            } catch (error) {
                console.error('Error loading public profile:', error);
            }
        };

        // Save public profile settings
        const savePublicProfile = async () => {
            if (!currentUser) return;

            const isPublic = document.getElementById('public-profile-toggle').checked;
            const displayName = document.getElementById('display-name-input').value.trim();

            try {
                const shareToken = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);

                await api.updateProfile({
                    isPublic,
                    displayName: displayName || currentUser.email?.split('@')[0] || 'Anonymous',
                    shareToken,
                });

                if (isPublic) {
                    const shareUrl = `${window.location.origin}${window.location.pathname}?view=${currentUser.uid}`;
                    document.getElementById('share-link-input').value = shareUrl;
                } else {
                    document.getElementById('share-link-input').value = '';
                }

                alert('公開設定を保存しました');
            } catch (error) {
                console.error('Error saving public profile:', error);
                alert('保存に失敗しました');
            }
        };

        // Load public users list (limited to 50 users to save reads)
        const loadPublicUsers = async () => {
            const userList = document.getElementById('user-list');
            userList.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm" role="status"></div> 読み込み中...</div>';

            try {
                const profiles = await api.getPublicProfiles();

                publicUsers = [];
                for (const data of profiles) {
                    if (isAdmin || data.isPublic) {
                        publicUsers.push({
                            id: data.userId,
                            ...data
                        });
                    }
                }

                renderUserList();
            } catch (error) {
                console.error('Error loading public users:', error);
                userList.innerHTML = '<div class="text-danger text-center py-3"><i class="bi bi-exclamation-circle"></i> 読み込みに失敗しました</div>';
            }
        };

        // Render user list
        const renderUserList = () => {
            const userList = document.getElementById('user-list');
            const searchQuery = document.getElementById('user-search-input').value.toLowerCase();

            const filtered = publicUsers.filter(user => {
                if (!searchQuery) return true;
                const name = (user.displayName || '').toLowerCase();
                return name.includes(searchQuery);
            });

            if (filtered.length === 0) {
                if (publicUsers.length === 0) {
                    // No public profiles exist yet
                    userList.innerHTML = `
                        <div class="text-muted text-center py-3">
                            <i class="bi bi-people" style="font-size: 2rem;"></i>
                            <p class="mt-2 mb-1">公開プロファイルがありません</p>
                            <small>自分のプロファイルを公開するには、上の設定で「プロファイルを公開」をオンにしてください。</small>
                        </div>`;
                } else {
                    // Search returned no results
                    userList.innerHTML = '<div class="text-muted text-center py-3">検索条件に一致するユーザーがいません</div>';
                }
                return;
            }

            userList.innerHTML = filtered.map(user => `
                <div class="user-item d-flex align-items-center p-2 border-bottom" style="cursor: pointer;" data-user-id="${user.id}">
                    <div class="me-2">
                        <i class="bi bi-person-circle" style="font-size: 1.5rem;"></i>
                    </div>
                    <div class="flex-grow-1">
                        <div class="fw-bold">${escapeHtml(user.displayName || 'Anonymous')}</div>
                        <small class="text-muted">
                            ${user.isPublic ? '<span class="badge bg-success">公開</span>' : '<span class="badge bg-secondary">非公開</span>'}
                            ${user.id === currentUser?.uid ? '<span class="badge bg-primary">自分</span>' : ''}
                        </small>
                    </div>
                    <i class="bi bi-chevron-right"></i>
                </div>
            `).join('');

            // Add click handlers
            userList.querySelectorAll('.user-item').forEach(item => {
                item.addEventListener('click', () => {
                    const userId = item.dataset.userId;
                    loadUserCollection(userId);
                });
            });
        };

        // Load a specific user's collection (lazy loading - only loads collection initially)
        const loadUserCollection = async (userId) => {
            if (!userId) return;

            viewingUserId = userId;
            // Reset data for new user
            viewingUserData = {
                collection: [],
                wishlist: [],
                decks: [],
                profile: null,
                wishlistLoaded: false,
                decksLoaded: false
            };

            const viewingGrid = document.getElementById('viewing-card-grid');
            viewingGrid.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border" role="status"></div><p class="mt-2">読み込み中...</p></div>';

            try {
                // Load user's profile
                viewingUserData.profile = await api.getProfile(userId).catch(() => null);

                // Check access permission
                if (!isAdmin && (!viewingUserData.profile || !viewingUserData.profile.isPublic)) {
                    viewingGrid.innerHTML = '<div class="col-12 text-center py-5 text-danger"><i class="bi bi-lock" style="font-size: 3rem;"></i><p class="mt-2">このユーザーのコレクションは非公開です</p></div>';
                    return;
                }

                // Load only collection initially
                const communityCards = await api.getCommunityCards(userId);
                viewingUserData.collection = communityCards.map(c => ({ id: c.id, data: c }));

                // Update header and show UI
                const userName = viewingUserData.profile?.displayName || 'Anonymous';
                document.getElementById('viewing-user-header').innerHTML = `<i class="bi bi-collection"></i> ${escapeHtml(userName)} のコレクション`;
                document.getElementById('back-to-my-collection-btn').style.display = 'inline-block';
                document.getElementById('viewing-user-tabs').style.display = 'flex';
                document.getElementById('viewing-filters').style.display = 'flex';

                // Update counts (wishlist/decks show "?" until loaded)
                document.getElementById('view-collection-count').textContent = viewingUserData.collection.length;
                document.getElementById('view-wishlist-count').textContent = '?';
                document.getElementById('view-decks-count').textContent = '?';

                // Reset tab state
                document.querySelectorAll('#viewing-user-tabs .nav-link').forEach(t => t.classList.remove('active'));
                document.querySelector('#viewing-user-tabs .nav-link[data-view-type="collection"]').classList.add('active');

                // Populate rarity filter
                populateViewingRarityFilter();

                // Render cards
                viewingCurrentType = 'collection';
                viewingCurrentPage = 1;
                applyViewingFilters();
                renderViewingCards();

            } catch (error) {
                console.error('Error loading user collection:', error);
                viewingGrid.innerHTML = '<div class="col-12 text-center py-5 text-danger"><i class="bi bi-exclamation-circle" style="font-size: 3rem;"></i><p class="mt-2">読み込みに失敗しました</p></div>';
            }
        };

        // Lazy load wishlist for viewing user
        const loadViewingWishlist = async () => {
            if (!viewingUserId || viewingUserData.wishlistLoaded) return;

            try {
                const wishlistData = await api.getCommunityCards(viewingUserId);
                viewingUserData.wishlist = wishlistData.map(c => ({ id: c.id, data: c }));
                viewingUserData.wishlistLoaded = true;
                document.getElementById('view-wishlist-count').textContent = viewingUserData.wishlist.length;
                populateViewingRarityFilter(); // Update filter with wishlist rarities
            } catch (error) {
                console.error('Error loading wishlist:', error);
            }
        };

        // Lazy load decks for viewing user
        const loadViewingDecks = async () => {
            if (!viewingUserId || viewingUserData.decksLoaded) return;

            try {
                const communityDecks = await api.getCommunityDecks(viewingUserId);
                viewingUserData.decks = communityDecks.map(d => ({ id: d.id, data: d }));
                viewingUserData.decksLoaded = true;
                document.getElementById('view-decks-count').textContent = viewingUserData.decks.length;
            } catch (error) {
                console.error('Error loading decks:', error);
            }
        };

        // Populate rarity filter for viewing
        const populateViewingRarityFilter = () => {
            const filter = document.getElementById('viewing-rarity-filter');
            const rarities = new Set();

            viewingUserData.collection.forEach(card => {
                if (card.data['レアリティ']) rarities.add(card.data['レアリティ']);
            });
            viewingUserData.wishlist.forEach(card => {
                if (card.data['レアリティ']) rarities.add(card.data['レアリティ']);
            });

            filter.innerHTML = '<option value="">全レアリティ</option>' +
                Array.from(rarities).sort().map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
        };

        // Apply filters for viewing
        const applyViewingFilters = () => {
            const searchQuery = document.getElementById('viewing-search-input')?.value.toLowerCase() || '';
            const rarityFilter = document.getElementById('viewing-rarity-filter')?.value || '';
            const sortBy = document.getElementById('viewing-sort')?.value || 'name';

            let cards = viewingCurrentType === 'collection' ? viewingUserData.collection :
                        viewingCurrentType === 'wishlist' ? viewingUserData.wishlist : [];

            // Filter
            viewingFilteredCards = cards.filter(card => {
                const name = (card.data['名前'] || '').toLowerCase();
                const rarity = card.data['レアリティ'] || '';

                if (searchQuery && !name.includes(searchQuery)) return false;
                if (rarityFilter && rarity !== rarityFilter) return false;
                return true;
            });

            // Sort
            viewingFilteredCards.sort((a, b) => {
                if (sortBy === 'name') {
                    return getReadingForSort(a.data['名前']).localeCompare(getReadingForSort(b.data['名前']), 'ja');
                } else if (sortBy === 'quantity-desc') {
                    return (b.data['枚数'] || 0) - (a.data['枚数'] || 0);
                } else if (sortBy === 'rarity') {
                    return (a.data['レアリティ'] || '').localeCompare(b.data['レアリティ'] || '');
                }
                return 0;
            });
        };

        // Render viewing cards
        const renderViewingCards = () => {
            const grid = document.getElementById('viewing-card-grid');

            if (viewingCurrentType === 'decks') {
                // Render decks list
                if (viewingUserData.decks.length === 0) {
                    grid.innerHTML = '<div class="col-12 text-center text-muted py-5">デッキがありません</div>';
                    return;
                }

                grid.innerHTML = viewingUserData.decks.map(deck => `
                    <div class="col-md-6 col-lg-4">
                        <div class="card">
                            <div class="card-body">
                                <h5 class="card-title"><i class="bi bi-box"></i> ${escapeHtml(deck.data.name || '無題のデッキ')}</h5>
                                <p class="card-text small text-muted">
                                    メイン: ${(deck.data.mainDeck || []).length}枚 /
                                    EX: ${(deck.data.extraDeck || []).length}枚 /
                                    サイド: ${(deck.data.sideDeck || []).length}枚
                                </p>
                                ${deck.data.memo ? `<p class="card-text small">${escapeHtml(deck.data.memo)}</p>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('');
                return;
            }

            // Render cards
            const start = (viewingCurrentPage - 1) * viewingItemsPerPage;
            const pageCards = viewingFilteredCards.slice(start, start + viewingItemsPerPage);

            if (pageCards.length === 0) {
                grid.innerHTML = '<div class="col-12 text-center text-muted py-5">カードがありません</div>';
                document.getElementById('viewing-pagination').style.display = 'none';
                return;
            }

            grid.innerHTML = pageCards.map(card => {
                const cardId = cardDetailsMap.get(card.data['名前'])?.cardId || '';
                return `
                    <div class="col-6 col-md-4 col-lg-3">
                        <div class="card h-100">
                            <div class="card-img-wrapper" style="position: relative; padding-top: 145%; background: #f0f0f0;">
                                <img src="" data-card-id="${cardId}" data-ciid="${card.data.ciid || '1'}"
                                     class="view-card-img" alt="${escapeHtml(decodeHtmlEntities(card.data['名前'] || ''))}"
                                     style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;"
                                     loading="lazy">
                            </div>
                            <div class="card-body p-2">
                                <p class="card-title small mb-1 text-truncate" title="${escapeHtml(decodeHtmlEntities(card.data['名前'] || ''))}">
                                    ${escapeHtml(decodeHtmlEntities(card.data['名前'] || '不明'))}
                                </p>
                                <small class="text-muted">
                                    ${escapeHtml(card.data['型番'] || '')} |
                                    ${escapeHtml(card.data['レアリティ'] || '')} |
                                    ×${card.data['枚数'] || 1}
                                </small>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Load images
            grid.querySelectorAll('.view-card-img').forEach(async img => {
                const cardId = img.dataset.cardId;
                const ciid = img.dataset.ciid || '1';
                if (cardId) {
                    try {
                        const cacheKey = `${cardId}_${ciid}`;
                        const cachedImage = await imageCacheManager.getImage(cacheKey);
                        if (cachedImage) {
                            img.src = cachedImage;
                        } else {
                            img.src = `${PROXY_URL}/image?cid=${cardId}&ciid=${ciid}`;
                        }
                    } catch (e) {
                        img.src = `${PROXY_URL}/image?cid=${cardId}`;
                    }
                }
            });

            // Render pagination
            renderViewingPagination();
        };

        // Render viewing pagination
        const renderViewingPagination = () => {
            const totalPages = Math.ceil(viewingFilteredCards.length / viewingItemsPerPage);
            const paginationEl = document.getElementById('viewing-pagination');

            if (totalPages <= 1) {
                paginationEl.style.display = 'none';
                return;
            }

            paginationEl.style.display = 'flex';
            paginationEl.innerHTML = `
                <nav>
                    <ul class="pagination pagination-sm mb-0">
                        <li class="page-item ${viewingCurrentPage === 1 ? 'disabled' : ''}">
                            <a class="page-link" href="#" data-page="${viewingCurrentPage - 1}">前へ</a>
                        </li>
                        <li class="page-item disabled">
                            <span class="page-link">${viewingCurrentPage} / ${totalPages}</span>
                        </li>
                        <li class="page-item ${viewingCurrentPage === totalPages ? 'disabled' : ''}">
                            <a class="page-link" href="#" data-page="${viewingCurrentPage + 1}">次へ</a>
                        </li>
                    </ul>
                </nav>
            `;

            paginationEl.querySelectorAll('.page-link[data-page]').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const page = parseInt(link.dataset.page);
                    if (page >= 1 && page <= totalPages) {
                        viewingCurrentPage = page;
                        renderViewingCards();
                    }
                });
            });
        };

        // Initialize community event handlers
        const initializeCommunity = () => {
            // Refresh users button
            document.getElementById('refresh-users-btn').addEventListener('click', loadPublicUsers);

            // User search
            document.getElementById('user-search-input').addEventListener('input', renderUserList);

            // Save profile settings
            document.getElementById('save-profile-settings-btn').addEventListener('click', savePublicProfile);

            // Copy share link
            document.getElementById('copy-share-link-btn').addEventListener('click', () => {
                const input = document.getElementById('share-link-input');
                if (input.value) {
                    navigator.clipboard.writeText(input.value).then(() => {
                        alert('リンクをコピーしました');
                    });
                }
            });

            // Back to my collection
            document.getElementById('back-to-my-collection-btn').addEventListener('click', () => {
                viewingUserId = null;
                document.getElementById('viewing-user-header').innerHTML = '<i class="bi bi-collection"></i> ユーザーを選択してください';
                document.getElementById('back-to-my-collection-btn').style.display = 'none';
                document.getElementById('viewing-user-tabs').style.display = 'none';
                document.getElementById('viewing-filters').style.display = 'none';
                document.getElementById('viewing-card-grid').innerHTML = `
                    <div class="col-12 text-center text-muted py-5">
                        <i class="bi bi-person-circle" style="font-size: 3rem;"></i>
                        <p class="mt-2">左のユーザー一覧からユーザーを選択すると<br>そのユーザーのコレクションが表示されます</p>
                    </div>
                `;
                document.getElementById('viewing-pagination').style.display = 'none';
            });

            // Viewing user tabs (with lazy loading)
            document.querySelectorAll('#viewing-user-tabs .nav-link').forEach(tab => {
                tab.addEventListener('click', async () => {
                    document.querySelectorAll('#viewing-user-tabs .nav-link').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    viewingCurrentType = tab.dataset.viewType;
                    viewingCurrentPage = 1;

                    // Lazy load data if needed
                    if (viewingCurrentType === 'wishlist' && !viewingUserData.wishlistLoaded) {
                        const grid = document.getElementById('viewing-card-grid');
                        grid.innerHTML = '<div class="col-12 text-center py-3"><div class="spinner-border spinner-border-sm"></div> 読み込み中...</div>';
                        await loadViewingWishlist();
                    } else if (viewingCurrentType === 'decks' && !viewingUserData.decksLoaded) {
                        const grid = document.getElementById('viewing-card-grid');
                        grid.innerHTML = '<div class="col-12 text-center py-3"><div class="spinner-border spinner-border-sm"></div> 読み込み中...</div>';
                        await loadViewingDecks();
                    }

                    applyViewingFilters();
                    renderViewingCards();
                });
            });

            // Viewing filters
            document.getElementById('viewing-search-input')?.addEventListener('input', () => {
                viewingCurrentPage = 1;
                applyViewingFilters();
                renderViewingCards();
            });
            document.getElementById('viewing-rarity-filter')?.addEventListener('change', () => {
                viewingCurrentPage = 1;
                applyViewingFilters();
                renderViewingCards();
            });
            document.getElementById('viewing-sort')?.addEventListener('change', () => {
                viewingCurrentPage = 1;
                applyViewingFilters();
                renderViewingCards();
            });

            // Community tab click
            document.getElementById('community-tab').addEventListener('click', () => {
                switchToCommunity();
            });

            // Playmat tab click
            document.getElementById('playmat-tab').addEventListener('click', () => {
                switchToPlaymat();
            });
            document.getElementById('pm-search').addEventListener('input', applyPlaymatFilter);
            document.getElementById('pm-sort').addEventListener('change', applyPlaymatFilter);
            document.getElementById('pm-sealed-filter').addEventListener('change', applyPlaymatFilter);
            document.getElementById('pm-clear-filters').addEventListener('click', () => {
                document.getElementById('pm-search').value = '';
                document.getElementById('pm-sort').value = 'date-desc';
                document.getElementById('pm-sealed-filter').value = 'all';
                document.querySelectorAll('#pm-tag-filter-buttons .tag-filter-btn.active').forEach(b => b.classList.remove('active'));
                applyPlaymatFilter();
            });

            // Check URL for direct view parameter
            const urlParams = new URLSearchParams(window.location.search);
            const viewUserId = urlParams.get('view');
            if (viewUserId) {
                // Auto-switch to community and load the user
                setTimeout(() => {
                    switchToCommunity();
                    loadUserCollection(viewUserId);
                }, 500);
            }

            // Admin: Add direct user ID input feature
            if (isAdmin) {
                const userSearchInput = document.getElementById('user-search-input');
                const adminInputDiv = document.createElement('div');
                adminInputDiv.className = 'mb-3 p-2 border border-warning rounded bg-warning bg-opacity-10';
                adminInputDiv.innerHTML = `
                    <label class="form-label small text-warning fw-bold"><i class="bi bi-shield-check"></i> Admin: ユーザーID直接入力</label>
                    <div class="input-group input-group-sm">
                        <input type="text" class="form-control" id="admin-uid-input" placeholder="ユーザーID (uid)">
                        <button class="btn btn-warning" type="button" id="admin-uid-load-btn">
                            <i class="bi bi-arrow-right-circle"></i> 表示
                        </button>
                    </div>
                    <small class="text-muted">publicProfilesに登録されていないユーザーも表示可能</small>
                `;
                userSearchInput.parentNode.insertBefore(adminInputDiv, userSearchInput);

                document.getElementById('admin-uid-load-btn').addEventListener('click', () => {
                    const uid = document.getElementById('admin-uid-input').value.trim();
                    if (uid) {
                        loadUserCollection(uid);
                    }
                });

                document.getElementById('admin-uid-input').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        const uid = e.target.value.trim();
                        if (uid) {
                            loadUserCollection(uid);
                        }
                    }
                });
            }
        };

        // Switch to community view
        const switchToCommunity = () => {
            // Hide other containers
            document.getElementById('gallery-content').style.display = 'none';
            document.getElementById('playmat-container').style.display = 'none';

            // Show community container
            document.getElementById('community-container').style.display = 'block';

            // Update tab active state (only main tabs, not other nav elements)
            document.querySelectorAll('.nav-tabs > .nav-item > .nav-link').forEach(tab => tab.classList.remove('active'));
            document.getElementById('community-tab').classList.add('active');

            // Load users if not loaded
            if (publicUsers.length === 0) {
                loadPublicUsers();
            }
        };

        // ==================== END COMMUNITY SYSTEM ====================

        // ==================== PLAYMAT SYSTEM ====================

        let allPlaymats = [];

        const switchToPlaymat = async () => {
            document.getElementById('community-container').style.display = 'none';
            document.getElementById('gallery-content').style.display = 'none';
            document.getElementById('playmat-container').style.display = 'block';
            document.querySelectorAll('.nav-tabs > .nav-item > .nav-link').forEach(t => t.classList.remove('active'));
            document.getElementById('playmat-tab').classList.add('active');
            await renderPlaymats();
        };

        async function renderPlaymats() {
            allPlaymats = currentUser ? await api.getSupplies() : [];
            document.getElementById('playmat-count-badge').textContent = allPlaymats.length;
            renderPlaymatTagFilters();
            applyPlaymatFilter();
        }

        function renderPlaymatTagFilters() {
            const tags = JSON.parse(localStorage.getItem('supplyTags') || '[]');
            const section = document.getElementById('pm-tag-filter-section');
            const container = document.getElementById('pm-tag-filter-buttons');
            if (!tags.length) { section.style.display = 'none'; return; }
            section.style.display = '';
            container.innerHTML = tags
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map(t => `<button class="tag-filter-btn" data-pm-tag="${escapeHtml(t.name)}" onclick="togglePmTag(this)">${escapeHtml(t.name)}</button>`)
                .join('');
        }

        window.togglePmTag = (btn) => {
            btn.classList.toggle('active');
            applyPlaymatFilter();
        };

        function applyPlaymatFilter() {
            const grid    = document.getElementById('playmat-grid');
            const empty   = document.getElementById('playmat-empty');
            const query   = (document.getElementById('pm-search')?.value || '').trim().toLowerCase();
            const sort    = document.getElementById('pm-sort')?.value || 'date-desc';
            const sealed  = document.getElementById('pm-sealed-filter')?.value || 'all';

            let list = [...allPlaymats];

            // filter by name
            if (query) list = list.filter(pm => pm.name.toLowerCase().includes(query));

            // filter by sealed
            if (sealed === 'sealed')  list = list.filter(pm => pm.sealed);
            if (sealed === 'opened')  list = list.filter(pm => !pm.sealed);

            // filter by tags (OR: いずれかのタグを持つ)
            const activeTags = [...document.querySelectorAll('#pm-tag-filter-buttons .tag-filter-btn.active')].map(b => b.dataset.pmTag);
            if (activeTags.length) list = list.filter(pm => activeTags.some(t => pm.tags && pm.tags.includes(t)));

            // sort
            if (sort === 'date-desc') list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            if (sort === 'date-asc')  list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            if (sort === 'name-asc')  list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
            if (sort === 'name-desc') list.sort((a, b) => b.name.localeCompare(a.name, 'ja'));

            if (list.length === 0) {
                grid.innerHTML = '';
                empty.style.display = '';
                return;
            }
            empty.style.display = 'none';
            grid.innerHTML = list.map((pm, i) => `
                <div class="col-6 col-md-4 col-lg-3 col-xl-2">
                    <div class="playmat-gallery-card" onclick="showPlaymatDetail(${allPlaymats.indexOf(pm)})" role="button">
                        <div class="playmat-gallery-thumb">
                            ${pm.imageData
                                ? `<img src="${pm.imageData}" alt="${escapeHtml(pm.name)}">`
                                : `<i class="bi bi-image" style="font-size:2.5rem;color:#adb5bd;"></i>`}
                        </div>
                        <div class="playmat-gallery-body">
                            <div class="mb-1">
                                <span class="badge ${pm.sealed ? 'bg-success' : 'bg-warning text-dark'}" style="font-size:.62rem;">
                                    ${pm.sealed ? '未開封' : '開封済み'}
                                </span>
                            </div>
                            <div class="playmat-gallery-name">${escapeHtml(pm.name)}</div>
                            ${pm.description ? `<div class="playmat-gallery-desc">${escapeHtml(pm.description)}</div>` : ''}
                            ${pm.tags && pm.tags.length ? `<div class="playmat-gallery-tags">${pm.tags.map(t => `<span class="badge bg-secondary" style="font-size:.6rem;">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        }

        function showPlaymatDetail(index) {
            const pm = allPlaymats[index];
            if (!pm) return;
            document.getElementById('pm-detail-name').textContent = pm.name;
            const img   = document.getElementById('pm-detail-img');
            const noImg = document.getElementById('pm-detail-no-img');
            if (pm.imageData) {
                img.src = pm.imageData;
                img.style.display = '';
                noImg.style.display = 'none';
            } else {
                img.style.display = 'none';
                noImg.style.display = '';
            }
            const badge = document.getElementById('pm-detail-badge');
            badge.textContent = pm.sealed ? '未開封' : '開封済み';
            badge.className   = `badge ${pm.sealed ? 'bg-success' : 'bg-warning text-dark'}`;
            document.getElementById('pm-detail-desc').textContent = pm.description || '';
            const tagsEl = document.getElementById('pm-detail-tags');
            tagsEl.innerHTML = pm.tags && pm.tags.length
                ? pm.tags.map(t => `<span class="badge bg-secondary">${escapeHtml(t)}</span>`).join('')
                : '';
            new bootstrap.Modal(document.getElementById('playmatDetailModal')).show();
        }
        // ==================== END PLAYMAT SYSTEM ====================

        // ==================== PACK OPENING SYSTEM ====================

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
            for (const card of collectionCards) {
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
            if (collectionCards.length === 0) {
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
                            <div class="pack-card-rarity-badge rarity-${tier}">${escapeHtml(card.rarity || '?')}</div>
                            <div class="pack-card-name-label">${escapeHtml(decodeHtmlEntities(card.name))}</div>
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
                const decodedName = decodeHtmlEntities(card.name);
                const ciid = card.selectedCiid || '1';
                const imageUrl = await getCardImageUrl(decodedName, ciid);
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

        // ==================== END PACK OPENING SYSTEM ====================

        // Initialize
        const init = async () => {
            showLoading(true);

            // Initialize image cache manager
            try {
                await imageCacheManager.init();
                console.log('Image cache manager initialized');
            } catch (error) {
                console.error('Failed to initialize image cache manager:', error);
            }

            await loadCardData();

            onAuthStateChanged(auth, (user) => {
                if (user) {
                    // Check if user is VIP member
                    const vipData = localStorage.getItem('vip_membership');
                    let isVipMember = false;

                    if (vipData) {
                        try {
                            const parsed = JSON.parse(vipData);
                            if (parsed.active && parsed.verified) {
                                isVipMember = true;
                            }
                        } catch (e) {
                            console.error('Error parsing VIP data:', e);
                        }
                    }

                    // Redirect non-VIP users
                    if (!isVipMember) {
                        alert('このページはVIPメンバー専用です。\n\nカードリストページに戻ります。');
                        window.location.href = 'card_list.html';
                        return;
                    }

                    // User is VIP, proceed with loading
                    currentUser = user;
                    isAdmin = ADMIN_UIDS.includes(user.uid);
                    console.log('Admin status:', isAdmin);

                    // Set API auth token
                    api.setAuth(user).then(() => {
                        loadAllData(user.uid);
                        loadAllAliases();
                    });
                    loadPublicProfile(); // Load user's public settings
                    initializeCommunity(); // Initialize community features

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
                } else {
                    // Redirect to login page
                    alert('ログインが必要です。');
                    window.location.href = 'card_list.html';
                }
            });
        };

        init();

        // Navbar scroll effect (旧・第2インラインスクリプトから統合)
        window.addEventListener('scroll', function() {
            const navbar = document.querySelector('.navbar-custom');
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
