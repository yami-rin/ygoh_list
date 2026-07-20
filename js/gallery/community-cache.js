// ==================== COMMUNITY LOCAL CACHE (TTL-based) ====================

export const COMMUNITY_TTL = {
    PUBLIC_PROFILES: 5 * 60 * 1000,
    PROFILE: 10 * 60 * 1000,
    VIEW_USER_DATA: 3 * 60 * 1000
};

export const createCommunityCacheSystem = (deps) => {
    const readTtlEntry = (key, ttlMs) => {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const entry = JSON.parse(raw);
            if (!entry || typeof entry.cachedAt !== 'number') return null;
            if (Date.now() - entry.cachedAt >= ttlMs) return null;
            return entry.data;
        } catch (e) {
            console.error('Failed to read community cache:', key, e);
            return null;
        }
    };
    const writeTtlEntry = (key, data) => {
        try {
            localStorage.setItem(key, JSON.stringify({ data, cachedAt: Date.now() }));
        } catch (e) {
            console.error('Failed to write community cache:', key, e);
            if (e.name === 'QuotaExceededError') localStorage.removeItem(key);
        }
    };

    const PUBLIC_PROFILES_KEY = 'communityCache_publicProfiles';
    const getCachedPublicProfiles = (ttlMs) => readTtlEntry(PUBLIC_PROFILES_KEY, ttlMs);
    const setCachedPublicProfiles = (profiles) => writeTtlEntry(PUBLIC_PROFILES_KEY, profiles);
    const patchCachedPublicProfile = (userId, patch) => {
        try {
            const raw = localStorage.getItem(PUBLIC_PROFILES_KEY);
            if (!raw) return;
            const entry = JSON.parse(raw);
            if (!Array.isArray(entry?.data)) return;
            const idx = entry.data.findIndex((u) => u.userId === userId || u.id === userId);
            if (idx === -1) {
                // 新規公開時は一覧キャッシュに未登録。自分のエントリを追加して即座に一覧へ反映
                entry.data.push({ userId, ...patch });
            } else {
                entry.data[idx] = { ...entry.data[idx], ...patch };
            }
            localStorage.setItem(PUBLIC_PROFILES_KEY, JSON.stringify(entry));
        } catch (e) {
            console.error('Failed to patch community cache:', e);
        }
    };

    const profileKey = (uid) => `communityCache_profile_${uid}`;
    const getCachedProfile = (uid, ttlMs) => uid ? readTtlEntry(profileKey(uid), ttlMs) : null;
    const setCachedProfile = (uid, profile) => { if (uid) writeTtlEntry(profileKey(uid), profile); };

    const cardsKey = (uid) => `communityCache_viewUser_${uid}_cards`;
    const getCachedCommunityCards = (uid, ttlMs) => uid ? readTtlEntry(cardsKey(uid), ttlMs) : null;
    const setCachedCommunityCards = (uid, cards) => { if (uid) writeTtlEntry(cardsKey(uid), cards); };

    const decksKey = (uid) => `communityCache_viewUser_${uid}_decks`;
    const getCachedCommunityDecks = (uid, ttlMs) => uid ? readTtlEntry(decksKey(uid), ttlMs) : null;
    const setCachedCommunityDecks = (uid, decks) => { if (uid) writeTtlEntry(decksKey(uid), decks); };

    return {
        getCachedPublicProfiles, setCachedPublicProfiles, patchCachedPublicProfile,
        getCachedProfile, setCachedProfile,
        getCachedCommunityCards, setCachedCommunityCards,
        getCachedCommunityDecks, setCachedCommunityDecks
    };
};

// ==================== END COMMUNITY LOCAL CACHE ====================
