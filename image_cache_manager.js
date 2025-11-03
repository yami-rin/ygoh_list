/**
 * 遊戯王カード画像キャッシュマネージャー
 * IndexedDBを使用してカード画像をカードIDと紐づけて保存・取得
 */

class ImageCacheManager {
    constructor() {
        this.dbName = 'YugiohImageCache';
        this.dbVersion = 1;
        this.storeName = 'cardImages';
        this.db = null;
    }

    /**
     * データベースを初期化
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('IndexedDB open error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // カード画像ストアを作成
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { keyPath: 'cardId' });

                    // インデックスを作成
                    objectStore.createIndex('cardName', 'cardName', { unique: false });
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                    objectStore.createIndex('encToken', 'encToken', { unique: false });

                    console.log('Object store created');
                }
            };
        });
    }

    /**
     * 画像を保存
     * @param {string} cardId - カードID
     * @param {string} imageUrl - 画像URL（Blob URLまたはData URL）
     * @param {Object} metadata - メタデータ（カード名、encトークンなど）
     */
    async saveImage(cardId, imageUrl, metadata = {}) {
        if (!this.db) {
            await this.init();
        }

        // 画像データを取得
        const response = await fetch(imageUrl);
        const blob = await response.blob();

        // Blob を Base64 に変換
        const base64Data = await this.blobToBase64(blob);

        const imageData = {
            cardId: String(cardId),
            cardName: metadata.cardName || '',
            encToken: metadata.encToken || '',
            imageData: base64Data,
            imageType: blob.type,
            imageSize: blob.size,
            timestamp: Date.now(),
            lastAccessed: Date.now()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.put(imageData);

            request.onsuccess = () => {
                console.log(`Image saved for card ID: ${cardId}`);
                resolve(imageData);
            };

            request.onerror = () => {
                console.error('Error saving image:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 画像を取得
     * @param {string} cardId - カードID
     * @returns {Promise<string|null>} - Data URL形式の画像データ
     */
    async getImage(cardId) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.get(String(cardId));

            request.onsuccess = () => {
                if (request.result) {
                    // アクセス時刻を更新
                    const data = request.result;
                    data.lastAccessed = Date.now();
                    objectStore.put(data);

                    console.log(`Image retrieved for card ID: ${cardId}`);
                    resolve(request.result.imageData);
                } else {
                    console.log(`No image found for card ID: ${cardId}`);
                    resolve(null);
                }
            };

            request.onerror = () => {
                console.error('Error getting image:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * カード情報を取得（画像以外のメタデータ）
     */
    async getCardInfo(cardId) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.get(String(cardId));

            request.onsuccess = () => {
                if (request.result) {
                    const { imageData, ...info } = request.result;
                    resolve(info);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * 画像が存在するかチェック
     */
    async hasImage(cardId) {
        const image = await this.getImage(cardId);
        return image !== null;
    }

    /**
     * 画像を削除
     */
    async deleteImage(cardId) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.delete(String(cardId));

            request.onsuccess = () => {
                console.log(`Image deleted for card ID: ${cardId}`);
                resolve();
            };

            request.onerror = () => {
                console.error('Error deleting image:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * 全ての画像を取得
     */
    async getAllImages() {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * キャッシュサイズを取得
     */
    async getCacheSize() {
        const allImages = await this.getAllImages();
        const totalSize = allImages.reduce((sum, img) => sum + (img.imageSize || 0), 0);
        return {
            count: allImages.length,
            sizeBytes: totalSize,
            sizeMB: (totalSize / (1024 * 1024)).toFixed(2)
        };
    }

    /**
     * 古いキャッシュを削除（日数指定）
     */
    async clearOldCache(daysOld = 30) {
        if (!this.db) {
            await this.init();
        }

        const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
        const allImages = await this.getAllImages();
        let deletedCount = 0;

        for (const img of allImages) {
            if (img.lastAccessed < cutoffTime) {
                await this.deleteImage(img.cardId);
                deletedCount++;
            }
        }

        console.log(`Cleared ${deletedCount} old cached images`);
        return deletedCount;
    }

    /**
     * 全てのキャッシュをクリア
     */
    async clearAllCache() {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.clear();

            request.onsuccess = () => {
                console.log('All cache cleared');
                resolve();
            };

            request.onerror = () => {
                console.error('Error clearing cache:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Blob を Base64 に変換
     */
    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * 画像をプロキシ経由で取得してキャッシュに保存
     * @param {string} cardId - カードID
     * @param {string} proxyUrl - プロキシURL
     */
    async fetchAndCache(cardId, proxyUrl = null) {
        // デフォルトプロキシURL（環境に応じて自動切り替え）
        if (!proxyUrl) {
            proxyUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:3000'
                : 'https://ygoh-list.onrender.com'; // ここにデプロイしたURLを設定
        }
        try {
            // 既にキャッシュにあるかチェック
            const cachedImage = await this.getImage(cardId);
            if (cachedImage) {
                console.log(`Using cached image for card ID: ${cardId}`);
                return cachedImage;
            }

            console.log(`Fetching image for card ID: ${cardId}`);

            // カード詳細を取得
            const detailUrl = `${proxyUrl}/card-detail?cid=${cardId}`;
            const detailResponse = await fetch(detailUrl);
            const cardDetail = await detailResponse.json();

            if (!cardDetail.imageUrl) {
                throw new Error('Image URL not found');
            }

            // 画像を取得
            const imageResponse = await fetch(cardDetail.imageUrl);
            const blob = await imageResponse.blob();
            const objectUrl = URL.createObjectURL(blob);

            // キャッシュに保存
            await this.saveImage(cardId, objectUrl, {
                cardName: cardDetail.cardName,
                encToken: cardDetail.encToken
            });

            // ObjectURLをクリーンアップ
            URL.revokeObjectURL(objectUrl);

            // 保存された画像を返す
            return await this.getImage(cardId);
        } catch (error) {
            console.error(`Error fetching and caching image for card ID ${cardId}:`, error);
            throw error;
        }
    }

    /**
     * 複数の画像を一括取得してキャッシュ
     */
    async fetchAndCacheBatch(cardIds, proxyUrl = null, onProgress = null) {
        // デフォルトプロキシURL（環境に応じて自動切り替え）
        if (!proxyUrl) {
            proxyUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:3000'
                : 'https://ygoh-list.onrender.com'; // ここにデプロイしたURLを設定
        }
        const results = {
            success: [],
            failed: []
        };

        for (let i = 0; i < cardIds.length; i++) {
            const cardId = cardIds[i];

            try {
                await this.fetchAndCache(cardId, proxyUrl);
                results.success.push(cardId);
            } catch (error) {
                results.failed.push({ cardId, error: error.message });
            }

            // 進捗報告
            if (onProgress) {
                onProgress({
                    current: i + 1,
                    total: cardIds.length,
                    cardId,
                    success: results.success.length,
                    failed: results.failed.length
                });
            }

            // レート制限を避けるため少し待機
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return results;
    }

    /**
     * エクスポート（JSON形式）
     */
    async exportCache() {
        const allImages = await this.getAllImages();
        const exportData = {
            version: this.dbVersion,
            exportDate: new Date().toISOString(),
            totalImages: allImages.length,
            images: allImages
        };

        const jsonString = JSON.stringify(exportData);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // ダウンロードリンクを作成
        const a = document.createElement('a');
        a.href = url;
        a.download = `yugioh-image-cache-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return exportData;
    }

    /**
     * インポート（JSON形式）
     */
    async importCache(jsonData) {
        if (!this.db) {
            await this.init();
        }

        const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

        if (!data.images || !Array.isArray(data.images)) {
            throw new Error('Invalid import data format');
        }

        let importedCount = 0;
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const objectStore = transaction.objectStore(this.storeName);

        for (const imageData of data.images) {
            try {
                await new Promise((resolve, reject) => {
                    const request = objectStore.put(imageData);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
                importedCount++;
            } catch (error) {
                console.error(`Error importing image for card ID ${imageData.cardId}:`, error);
            }
        }

        console.log(`Imported ${importedCount} images`);
        return importedCount;
    }
}

// シングルトンインスタンスをエクスポート
const imageCacheManager = new ImageCacheManager();

// グローバルに公開（HTMLから使用できるように）
if (typeof window !== 'undefined') {
    window.ImageCacheManager = ImageCacheManager;
    window.imageCacheManager = imageCacheManager;
}

// ES6モジュールとしてもエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ImageCacheManager, imageCacheManager };
}
