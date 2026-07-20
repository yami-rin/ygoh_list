// ==================== LOCAL CACHE SYSTEM ====================

export const createCacheSystem = (deps) => {
    const getGalleryCacheKey = (type) => `galleryCache_${deps.getCurrentUser()?.uid}_${type}`;
    const saveGalleryToCache = () => {
        if (!deps.getCurrentUser()) return;
        try {
            const collectionCards = deps.getCollectionCards();
            const wishlistCards = deps.getWishlistCards();
            const bookmarkCards = deps.getBookmarkCards();
            const decks = deps.getDecks();
            const cacheData = { collection: collectionCards, wishlist: wishlistCards, bookmarks: bookmarkCards, decks: decks, cachedAt: Date.now() };
            localStorage.setItem(getGalleryCacheKey('data'), JSON.stringify(cacheData));
            console.log('💾 Gallery cache saved:', collectionCards.length, 'collection,', wishlistCards.length, 'wishlist,', bookmarkCards.length, 'bookmarks,', decks.length, 'decks');
        } catch (e) {
            console.error('Failed to save gallery cache:', e);
            if (e.name === 'QuotaExceededError') localStorage.removeItem(getGalleryCacheKey('data'));
        }
    };
    const loadGalleryFromCache = () => {
        if (!deps.getCurrentUser()) return null;
        try {
            const cached = localStorage.getItem(getGalleryCacheKey('data'));
            if (cached) { const data = JSON.parse(cached); console.log('📂 Gallery loaded from cache'); return data; }
        } catch (e) { console.error('Failed to load gallery cache:', e); }
        return null;
    };
    const isGalleryRemoteNewer = async (cachedAt) => {
        if (!deps.getCurrentUser()) return true;
        // ローカルテストモードではAPIを呼ばず常にキャッシュを使う
        if (deps.getCurrentUser().uid === 'local_user') return false;
        try {
            const meta = await deps.api.getSyncMetadata();
            const remoteUpdatedAt = meta.updatedAt || 0;
            const isNewer = remoteUpdatedAt > cachedAt;
            console.log(`Gallery cache check: cached=${new Date(cachedAt).toLocaleString()}, remote=${new Date(remoteUpdatedAt).toLocaleString()}, needsSync=${isNewer}`);
            return isNewer;
        } catch (e) { console.error('Failed to check metadata:', e); return true; }
    };
    const updateGalleryMetadata = async () => {};
    const trackDeletedId = async (cardId, colName) => {};
    const forceGallerySync = async () => {
        if (!deps.getCurrentUser()) return;
        deps.showLoading(true);
        console.log('Force syncing gallery from API...');
        try {
            const [cards, wishlist, bms, dks] = await Promise.all([deps.api.getCards('collection'), deps.api.getCards('wishlist'), deps.api.getBookmarks(), deps.api.getDecks()]);
            deps.setCollectionCards(cards.map(c => ({ id: c.id, data: c })));
            deps.setWishlistCards(wishlist.map(c => ({ id: c.id, data: c })));
            deps.setBookmarkCards(bms.map(b => ({ id: b.id, data: b })));
            deps.setDecks(dks.map(d => ({ id: d.id, ...d })));
            saveGalleryToCache();
            deps.switchListType(deps.getCurrentListType());
            console.log('✅ Gallery sync complete');
        } catch (error) { console.error('Gallery sync failed:', error); alert('同期に失敗しました。'); }
        finally { deps.showLoading(false); }
    };
    window.forceGallerySync = forceGallerySync;
    return { saveGalleryToCache, loadGalleryFromCache, isGalleryRemoteNewer, updateGalleryMetadata, trackDeletedId };
};

// ==================== END LOCAL CACHE SYSTEM ====================
