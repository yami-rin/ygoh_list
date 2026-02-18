/**
 * CardManagerAPI - REST API client for Cloudflare Workers + D1 backend.
 * Replaces all direct Firebase Firestore SDK calls.
 * Firebase Auth is kept for authentication; tokens are forwarded to the API.
 */
class CardManagerAPI {
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.token = null;
    }

    /** Set auth token from Firebase user. Call after onAuthStateChanged. */
    async setAuth(firebaseUser) {
        if (firebaseUser) {
            this.token = await firebaseUser.getIdToken();
        } else {
            this.token = null;
        }
    }

    /** Refresh token (call periodically or before long operations) */
    async refreshToken(firebaseUser) {
        if (firebaseUser) {
            this.token = await firebaseUser.getIdToken(true);
        }
    }

    async _fetch(path, options = {}) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const err = new Error(errorData.error || `API error: ${response.status}`);
            err.status = response.status;
            throw err;
        }
        return response.json();
    }

    // ========== Cards (collection + wishlist) ==========

    /** Get all cards for a list type */
    async getCards(listType = 'collection') {
        const data = await this._fetch(`/api/cards?list_type=${encodeURIComponent(listType)}`);
        return data.cards;
    }

    /** Get cards updated since a timestamp (delta sync) */
    async getCardsSince(listType, since) {
        const data = await this._fetch(`/api/cards?list_type=${encodeURIComponent(listType)}&since=${since}`);
        return data.cards;
    }

    /** Add a card (server-side dedup: merges if duplicate found) */
    async addCard(listType, cardData) {
        const body = {
            listType,
            '名前': cardData['名前'],
            '型番': cardData['型番'] || '',
            'レアリティ': cardData['レアリティ'] || '',
            '枚数': cardData['枚数'] || 1,
            tags: cardData.tags || [],
            selectedCiid: cardData.selectedCiid || null,
            linkedDetails: cardData.linkedDetails || null,
        };
        const data = await this._fetch('/api/cards', {
            method: 'POST',
            body: JSON.stringify(body),
        });
        return data; // { card, merged }
    }

    /** Update a card */
    async updateCard(cardId, updates) {
        const data = await this._fetch(`/api/cards/${cardId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
        return data.card;
    }

    /** Delete a card */
    async deleteCard(cardId) {
        return this._fetch(`/api/cards/${cardId}`, { method: 'DELETE' });
    }

    /** Atomic increment of card quantity */
    async incrementQuantity(cardId, amount = 1) {
        const data = await this._fetch(`/api/cards/${cardId}/increment`, {
            method: 'PUT',
            body: JSON.stringify({ amount }),
        });
        return data.card;
    }

    /** Batch import cards with server-side dedup */
    async batchImportCards(listType, cards) {
        const data = await this._fetch('/api/cards/batch-import', {
            method: 'POST',
            body: JSON.stringify({ listType, cards }),
        });
        return data; // { added, merged, total }
    }

    // ========== Sync ==========

    /** Get sync metadata (updatedAt, deletedIds) */
    async getSyncMetadata() {
        return this._fetch('/api/sync/metadata');
    }

    /** Unified delta sync: fetch all changes since cachedAt in one request */
    async deltaSync(cachedAt) {
        return this._fetch('/api/sync/delta', {
            method: 'POST',
            body: JSON.stringify({ cachedAt }),
        });
    }

    // ========== Bookmarks ==========

    async getBookmarks() {
        const data = await this._fetch('/api/bookmarks');
        return data.bookmarks;
    }

    async getBookmarksSince(since) {
        const data = await this._fetch(`/api/bookmarks?since=${since}`);
        return data.bookmarks;
    }

    async addBookmark(cardData) {
        const body = {
            '名前': cardData['名前'],
            '型番': cardData['型番'] || '',
            'レアリティ': cardData['レアリティ'] || '',
            '枚数': cardData['枚数'] || 1,
            tags: cardData.tags || [],
            selectedCiid: cardData.selectedCiid || null,
        };
        const data = await this._fetch('/api/bookmarks', {
            method: 'POST',
            body: JSON.stringify(body),
        });
        return data.bookmark;
    }

    async updateBookmark(bookmarkId, updates) {
        const data = await this._fetch(`/api/bookmarks/${bookmarkId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
        return data.bookmark;
    }

    async deleteBookmark(bookmarkId) {
        return this._fetch(`/api/bookmarks/${bookmarkId}`, { method: 'DELETE' });
    }

    // ========== Decks ==========

    async getDecks() {
        const data = await this._fetch('/api/decks');
        return data.decks;
    }

    async createDeck(deckData) {
        const data = await this._fetch('/api/decks', {
            method: 'POST',
            body: JSON.stringify(deckData),
        });
        return data.deck;
    }

    async updateDeck(deckId, deckData) {
        const data = await this._fetch(`/api/decks/${deckId}`, {
            method: 'PUT',
            body: JSON.stringify(deckData),
        });
        return data.deck;
    }

    async deleteDeck(deckId) {
        return this._fetch(`/api/decks/${deckId}`, { method: 'DELETE' });
    }

    // ========== Tags ==========

    async getTags() {
        const data = await this._fetch('/api/tags');
        return data.tags;
    }

    async createTag(name, order) {
        const body = { name };
        if (order !== undefined) body.order = order;
        const data = await this._fetch('/api/tags', {
            method: 'POST',
            body: JSON.stringify(body),
        });
        return data.tag;
    }

    async updateTag(tagId, updates) {
        return this._fetch(`/api/tags/${tagId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }

    async deleteTag(tagId) {
        return this._fetch(`/api/tags/${tagId}`, { method: 'DELETE' });
    }

    async reorderTags(order) {
        return this._fetch('/api/tags/reorder', {
            method: 'PUT',
            body: JSON.stringify({ order }),
        });
    }

    // ========== Aliases ==========

    async getAliases() {
        const data = await this._fetch('/api/aliases');
        return data.aliases;
    }

    async createAlias(alias, cardName) {
        const data = await this._fetch('/api/aliases', {
            method: 'POST',
            body: JSON.stringify({ alias, cardName }),
        });
        return data.alias;
    }

    async deleteAlias(aliasId) {
        return this._fetch(`/api/aliases/${aliasId}`, { method: 'DELETE' });
    }

    // ========== Gamification ==========

    async getGamification() {
        const data = await this._fetch('/api/gamification');
        return data.data;
    }

    async saveGamification(data) {
        const result = await this._fetch('/api/gamification', {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        return result.data;
    }

    // ========== Rankings ==========

    async getRankings() {
        const data = await this._fetch('/api/rankings');
        return data.rankings;
    }

    async updateRanking(rankingData) {
        return this._fetch('/api/rankings', {
            method: 'PUT',
            body: JSON.stringify(rankingData),
        });
    }

    // ========== Profiles ==========

    async getPublicProfiles() {
        const data = await this._fetch('/api/profiles/public');
        return data.profiles;
    }

    async getProfile(userId) {
        const data = await this._fetch(`/api/profiles/${userId}`);
        return data.profile;
    }

    async updateProfile(profileData) {
        return this._fetch('/api/profiles', {
            method: 'PUT',
            body: JSON.stringify(profileData),
        });
    }

    // ========== Community ==========

    async getCommunityCards(userId) {
        const data = await this._fetch(`/api/community/${userId}/cards`);
        return data.cards;
    }

    async getCommunityDecks(userId) {
        const data = await this._fetch(`/api/community/${userId}/decks`);
        return data.decks;
    }

    // ========== Account ==========

    async deleteAccount() {
        return this._fetch('/api/account', { method: 'DELETE' });
    }
}

// Singleton instance — configure base URL here
const API_BASE_URL = 'https://card-manager-api.y4m1r1n.workers.dev';
const api = new CardManagerAPI(API_BASE_URL);

export { CardManagerAPI, api };
