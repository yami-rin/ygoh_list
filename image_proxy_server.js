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

        // Build base URL from request
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host || req.hostname;
        const baseUrl = `${protocol}://${host}`;

        res.json({
            cardId,
            cardName,
            encToken,
            imageUrl: encToken ?
                `${baseUrl}/image?cid=${cardId}&enc=${encToken}` :
                `${baseUrl}/image?cid=${cardId}`
        });

    } catch (error) {
        console.error('Error fetching card detail:', error);
        res.status(500).json({ error: error.message });
    }
});

// Card list proxy endpoint - fetch multiple cards from search results
app.get('/card-list', async (req, res) => {
    const searchUrl = req.query.url;

    if (!searchUrl) {
        return res.status(400).json({ error: 'Search URL is required' });
    }

    try {
        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.db.yugioh-card.com/',
                'Accept': 'text/html',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
            }
        });

        const html = await response.text();

        // Debug: Log samples of the HTML to understand structure
        console.log('=== Searching for all jQuery text() calls ===');
        const textPatterns = html.match(/\$\([^)]+\)\.text\([^)]+\)/g);
        if (textPatterns) {
            console.log('Found text() patterns:', textPatterns.slice(0, 20));
        }
        console.log('=== Searching for card_name, card_number patterns ===');
        const idPatterns = html.match(/id=["']card_(name|number)_\d+_\d+["']/g);
        if (idPatterns) {
            console.log('Found ID patterns:', idPatterns.slice(0, 10));
        }

        // Parse card list from HTML
        const cards = [];
        const cardMap = new Map(); // To avoid duplicates

        // Pattern 0: JavaScript card_image pattern (for gallery view)
        // Extract card IDs from: $('#card_image_X_Y').attr('src', '...cid=XXXXX...')
        const jsPattern = /\$\('#card_image_(\d+)_(\d+)'\)\.attr\('src',\s*'[^']*cid=(\d+)[^']*'\)/g;
        let match;
        const cardIndices = []; // Store card indices for later name and number matching
        while ((match = jsPattern.exec(html)) !== null) {
            const rowIndex = match[1];
            const colIndex = match[2];
            const cardId = match[3];
            cardIndices.push({ row: rowIndex, col: colIndex, id: cardId });
            console.log(`Found card at [${rowIndex}][${colIndex}] with ID ${cardId}`);
        }

        // Try to find card names and numbers by index
        cardIndices.forEach(({ row, col, id }) => {
            let cardName = null;
            let cardNumber = null;

            // Pattern 1: jQuery .text() calls for name and number
            const nameRegex1 = new RegExp(`\\$\\('#card_name_${row}_${col}'\\)\\.text\\(['"]([^'"]+)['"]\\)`, 'i');
            const nameRegex2 = new RegExp(`\\$\\("#card_name_${row}_${col}"\\)\\.text\\(['"]([^'"]+)['"]\\)`, 'i');
            const nameRegex3 = new RegExp(`\\$\\(["']#card_name_${row}_${col}["']\\)\\.text\\(["']([^"']+)["']\\)`, 'i');

            const numberRegex1 = new RegExp(`\\$\\('#card_number_${row}_${col}'\\)\\.text\\(['"]([^'"]+)['"]\\)`, 'i');
            const numberRegex2 = new RegExp(`\\$\\("#card_number_${row}_${col}"\\)\\.text\\(['"]([^'"]+)['"]\\)`, 'i');
            const numberRegex3 = new RegExp(`\\$\\(["']#card_number_${row}_${col}["']\\)\\.text\\(["']([^"']+)["']\\)`, 'i');

            // Try to match name
            let nameMatch = html.match(nameRegex1) || html.match(nameRegex2) || html.match(nameRegex3);
            if (nameMatch) {
                cardName = nameMatch[1].trim();
            }

            // Try to match number (card code)
            let numberMatch = html.match(numberRegex1) || html.match(numberRegex2) || html.match(numberRegex3);
            if (numberMatch) {
                cardNumber = numberMatch[1].trim();
            }

            if (cardName && !cardMap.has(id)) {
                cardMap.set(id, { name: cardName, number: cardNumber || '', id: id });
                console.log(`Matched card ${id}: ${cardName} [${cardNumber || 'no number'}]`);
            } else if (!cardMap.has(id)) {
                // Store with placeholder name if we can't find it
                cardMap.set(id, { name: `Card ${id}`, number: '', id: id });
                console.log(`Card ${id}: name not found, using placeholder`);
            }
        });

        // Pattern 1: Link with card ID in href (fallback for list view)
        const pattern1 = /card_search\.action\?ope=2(?:&amp;|&)cid=(\d+)(?:&amp;|&)request_locale=ja[^>]*>([^<]+)</g;
        while ((match = pattern1.exec(html)) !== null) {
            const cardId = match[1];
            const cardName = match[2].trim();
            if (cardId && cardName && !cardMap.has(cardId)) {
                cardMap.set(cardId, { name: cardName, number: '', id: cardId });
            }
        }

        // Pattern 2: Strong tag with card name and nearby link
        if (cardMap.size === 0) {
            const pattern2 = /<strong[^>]*class="card_name"[^>]*>(.*?)<\/strong>[\s\S]{0,200}?cid=(\d+)/g;
            while ((match = pattern2.exec(html)) !== null) {
                const cardName = match[1].replace(/<[^>]+>/g, '').trim();
                const cardId = match[2];
                if (cardId && cardName && !cardMap.has(cardId)) {
                    cardMap.set(cardId, { name: cardName, number: '', id: cardId });
                }
            }
        }

        // Pattern 3: Input with name="cid" and value
        if (cardMap.size === 0) {
            const pattern3 = /<input[^>]*name="cid"[^>]*value="(\d+)"[^>]*>/g;
            const cidMatches = [...html.matchAll(pattern3)];

            // Try to find corresponding card names
            const namePattern = /<(?:span|strong)[^>]*class="[^"]*card_name[^"]*"[^>]*>([^<]+)<\/(?:span|strong)>/g;
            const nameMatches = [...html.matchAll(namePattern)];

            cidMatches.forEach((cidMatch, index) => {
                const cardId = cidMatch[1];
                const cardName = nameMatches[index] ? nameMatches[index][1].trim() : null;
                if (cardId && cardName && !cardMap.has(cardId)) {
                    cardMap.set(cardId, { name: cardName, number: '', id: cardId });
                }
            });
        }

        // Pattern 4: More flexible - any link containing cid parameter
        if (cardMap.size === 0) {
            const pattern4 = /<a[^>]*href="[^"]*cid=(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
            while ((match = pattern4.exec(html)) !== null) {
                const cardId = match[1];
                const linkContent = match[2];
                // Extract text, removing HTML tags
                const cardName = linkContent.replace(/<[^>]+>/g, '').trim();
                if (cardId && cardName && cardName.length > 2 && !cardMap.has(cardId)) {
                    cardMap.set(cardId, { name: cardName, number: '', id: cardId });
                }
            }
        }

        // Convert map to array
        cardMap.forEach((cardData) => {
            cards.push(cardData);
        });

        console.log(`Found ${cards.length} cards from search results`);

        // Include HTML sample in response for debugging if no cards found
        const debugInfo = cards.length === 0 ? {
            htmlSample: html.substring(0, 3000),
            cardImagePatterns: html.match(/\$\('#card_image_\d+_\d+'\).*?;/g)?.slice(0, 5) || [],
            namePatterns: html.match(/.{0,100}(card_name|cardName).{0,100}/gi)?.slice(0, 10) || [],
            strongTags: html.match(/<strong[^>]*>.*?<\/strong>/g)?.slice(0, 10) || []
        } : undefined;

        res.json({
            success: true,
            count: cards.length,
            cards: cards,
            debug: debugInfo
        });

    } catch (error) {
        console.error('Error fetching card list:', error);
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
