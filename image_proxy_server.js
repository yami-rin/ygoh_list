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

    // Always set CORS headers
    res.header('Access-Control-Allow-Origin', '*');

    if (!cardId) {
        // Return error as plain text, not JSON
        res.status(400).set('Content-Type', 'text/plain').send('Card ID is required');
        return;
    }

    try {
        // Build image URL
        let imageUrl;
        if (encToken) {
            imageUrl = `https://www.db.yugioh-card.com/yugiohdb/get_image.action?type=2&cid=${cardId}&ciid=1&enc=${encToken}`;
        } else {
            imageUrl = `https://www.db.yugioh-card.com/yugiohdb/card_image.action?cid=${cardId}&request_locale=ja`;
        }

        console.log(`Fetching image for card ${cardId} from: ${imageUrl}`);

        // Fetch image with proper headers
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.db.yugioh-card.com/',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
            }
        });

        console.log(`Response status for card ${cardId}: ${response.status}`);

        if (!response.ok) {
            console.error(`Failed to fetch image for card ${cardId}: HTTP ${response.status}`);
            // Return a placeholder SVG instead of JSON error
            const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="290"><rect width="200" height="290" fill="#ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999" font-size="14">Error ${response.status}</text></svg>`;
            res.status(200).set('Content-Type', 'image/svg+xml').send(placeholderSvg);
            return;
        }

        // Get image buffer
        const imageBuffer = await response.buffer();
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        console.log(`Successfully fetched image for card ${cardId}, content-type: ${contentType}`);

        // Send image with CORS headers
        res.set('Content-Type', contentType);
        res.set('Access-Control-Allow-Origin', '*');
        res.send(imageBuffer);

    } catch (error) {
        console.error(`Error fetching image for card ${cardId}:`, error);
        // Return a placeholder SVG instead of JSON error
        const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="290"><rect width="200" height="290" fill="#ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999" font-size="12">Server Error</text></svg>`;
        res.status(200).set('Content-Type', 'image/svg+xml').set('Access-Control-Allow-Origin', '*').send(placeholderSvg);
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

        // Parse card list from HTML
        const cards = [];

        // Extract all card blocks - each card has <span class="card_name">, rarity div, and hidden input
        const cardBlocks = [];

        // Find all <span class="card_name"> elements
        const cardNamePattern = /<span\s+class="card_name"[^>]*>([^<]+)<\/span>/g;
        const cardNames = [];
        let match;
        while ((match = cardNamePattern.exec(html)) !== null) {
            cardNames.push(match[1].trim());
        }

        // Find all <input type="hidden" class="link_value"> elements for card IDs
        const linkValuePattern = /<input[^>]*class="link_value"[^>]*value="\/yugiohdb\/card_search\.action\?ope=2&(?:amp;)?cid=(\d+)"[^>]*>/g;
        const cardIds = [];
        while ((match = linkValuePattern.exec(html)) !== null) {
            cardIds.push(match[1]);
        }

        // Find all rarity class elements
        // The pattern looks for: <div class="icon rarity pack_X">
        const rarityPattern = /<div\s+class="icon\s+rarity\s+pack_([a-z0-9]+)"[^>]*>/gi;
        const rarities = [];
        const rarityCodesFound = [];
        while ((match = rarityPattern.exec(html)) !== null) {
            const rarityCode = match[1].toLowerCase();
            rarityCodesFound.push(rarityCode);
            // Map rarity codes to Japanese rarity names
            const rarityMap = {
                'n': 'ノーマル',
                'r': 'レア',
                'sr': 'スーパーレア',
                'ur': 'ウルトラレア',
                'scr': 'シークレットレア',
                'hr': 'ホログラフィックレア',
                '20s': '20thシークレットレア',
                'pscr': 'プリズマティックシークレットレア',
                'mr': 'ミレニアムレア',
                'pr': 'パラレルレア',
                'npr': 'ノーマルパラレルレア',
                'spr': 'スーパーパラレルレア',
                'exs': 'エクストラシークレットレア',
                'kc': 'KCレア',
                'kcr': 'KCウルトラレア'
            };
            const mappedRarity = rarityMap[rarityCode] || 'その他';
            rarities.push(mappedRarity);
            console.log(`Rarity code: ${rarityCode} -> ${mappedRarity}`);
        }

        console.log(`Found ${cardNames.length} card names, ${cardIds.length} card IDs, ${rarities.length} rarities`);
        console.log(`Rarity codes found:`, rarityCodesFound);

        // Get card number (型番) from the first card's detail page
        let baseCardNumber = '';
        if (cardIds.length > 0) {
            try {
                const firstCardId = cardIds[0];
                const detailUrl = `https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=2&cid=${firstCardId}`;

                console.log(`Fetching first card details from: ${detailUrl}`);
                const detailResponse = await fetch(detailUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': 'https://www.db.yugioh-card.com/',
                        'Accept': 'text/html',
                        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
                    }
                });

                const detailHtml = await detailResponse.text();

                // Extract card number from <div class="card_number">
                const cardNumberMatch = detailHtml.match(/<div\s+class="card_number">([^<]+)<\/div>/);
                if (cardNumberMatch) {
                    baseCardNumber = cardNumberMatch[1].trim();
                    console.log(`Base card number: ${baseCardNumber}`);
                }
            } catch (error) {
                console.error('Failed to fetch first card details:', error);
            }
        }

        // Generate card numbers by incrementing the base number
        const generateCardNumber = (baseNumber, index) => {
            if (!baseNumber) return '';

            // Extract prefix and number from base (e.g., "LB-01" -> "LB-" and "01")
            const match = baseNumber.match(/^(.+?)(\d+)$/);
            if (!match) return baseNumber;

            const prefix = match[1];
            const startNum = parseInt(match[2], 10);
            const numLength = match[2].length; // Preserve leading zeros

            const newNum = (startNum + index).toString().padStart(numLength, '0');
            return prefix + newNum;
        };

        // Combine all data
        const minLength = Math.min(cardNames.length, cardIds.length, rarities.length);
        for (let i = 0; i < minLength; i++) {
            cards.push({
                id: cardIds[i],
                name: cardNames[i],
                number: generateCardNumber(baseCardNumber, i),
                rarity: rarities[i]
            });
        }

        console.log(`Successfully parsed ${cards.length} cards`);

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
