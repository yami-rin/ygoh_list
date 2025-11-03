/**
 * 遊戯王カード画像プロキシサーバー (Node.js)
 * CORS制限を回避するためのローカルプロキシサーバー
 *
 * 使用方法:
 * 1. Node.jsをインストール
 * 2. npm install express node-fetch
 * 3. node image_proxy_server.js
 * 4. http://localhost:3000/image?cid=7315 でアクセス
 */

const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Image proxy endpoint
app.get('/image', async (req, res) => {
    const cardId = req.query.cid;
    const encToken = req.query.enc;

    if (!cardId) {
        return res.status(400).json({ error: 'Card ID is required' });
    }

    try {
        // Build image URL
        let imageUrl;
        if (encToken) {
            imageUrl = `https://www.db.yugioh-card.com/yugiohdb/get_image.action?type=2&cid=${cardId}&ciid=1&enc=${encToken}`;
        } else {
            imageUrl = `https://www.db.yugioh-card.com/yugiohdb/card_image.action?cid=${cardId}&request_locale=ja`;
        }

        // Fetch image with proper headers
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.db.yugioh-card.com/',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({
                error: `Failed to fetch image: HTTP ${response.status}`
            });
        }

        // Get image buffer
        const imageBuffer = await response.buffer();
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        // Send image
        res.set('Content-Type', contentType);
        res.send(imageBuffer);

    } catch (error) {
        console.error('Error fetching image:', error);
        res.status(500).json({ error: error.message });
    }
});

// Card detail proxy endpoint
app.get('/card-detail', async (req, res) => {
    const cardId = req.query.cid;

    if (!cardId) {
        return res.status(400).json({ error: 'Card ID is required' });
    }

    try {
        const detailUrl = `https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=2&cid=${cardId}`;

        const response = await fetch(detailUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.db.yugioh-card.com/',
                'Accept': 'text/html',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
            }
        });

        const html = await response.text();

        // Extract enc token
        const encMatch = html.match(/get_image\.action\?type=2&cid=\d+&ciid=1&enc=([a-zA-Z0-9_-]+)/);
        const encToken = encMatch ? encMatch[1] : null;

        // Extract card name
        const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        const cardName = nameMatch ? nameMatch[1].trim() : null;

        res.json({
            cardId,
            cardName,
            encToken,
            imageUrl: encToken ?
                `http://localhost:${PORT}/image?cid=${cardId}&enc=${encToken}` :
                `http://localhost:${PORT}/image?cid=${cardId}`
        });

    } catch (error) {
        console.error('Error fetching card detail:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Image proxy server is running' });
});

app.listen(PORT, () => {
    console.log(`🎴 遊戯王画像プロキシサーバー起動`);
    console.log(`📡 ポート: ${PORT}`);
    console.log(`🔗 画像取得: http://localhost:${PORT}/image?cid=7315`);
    console.log(`🔗 カード詳細: http://localhost:${PORT}/card-detail?cid=7315`);
    console.log(`🔗 ヘルスチェック: http://localhost:${PORT}/health`);
});
