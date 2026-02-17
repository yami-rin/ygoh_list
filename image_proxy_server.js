/**
 * h
 */

const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Data directory for user data storage
const DATA_DIR = path.join(__dirname, 'user_data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// JSON body parser
app.use(express.json({ limit: '50mb' }));

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Image proxy endpoint
app.get('/image', async (req, res) => {
    const cardId = req.query.cid;
    const encToken = req.query.enc;
    const ciid = req.query.ciid || '1'; // Default to ciid=1 if not specified

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
            imageUrl = `https://www.db.yugioh-card.com/yugiohdb/get_image.action?type=2&cid=${cardId}&ciid=${ciid}&enc=${encToken}`;
        } else {
            imageUrl = `https://www.db.yugioh-card.com/yugiohdb/card_image.action?cid=${cardId}&request_locale=ja`;
        }

        console.log(`Fetching image for card ${cardId} (ciid=${ciid}) from: ${imageUrl}`);

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
        const detailUrl = `https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=2&cid=${cardId}&request_locale=ja`;

        const response = await fetch(detailUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.db.yugioh-card.com/',
                'Accept': 'text/html',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch from yugioh-card.com: ${response.status}`);
        }

        const html = await response.text();

        const nameMatch = html.match(/<meta name="title" content="(.*?)\s*\|\s*カード詳細/);
        const cardName = nameMatch ? nameMatch[1].trim() : 'Unknown Card';

        // Extract all card images with different illustrations (ciid)
        // Pattern: get_image.action?type=2&cid=XXXX&ciid=Y&enc=ZZZZ
        const imagePattern = /get_image\.action\?type=2&cid=\d+&ciid=(\d+)&enc=([a-zA-Z0-9_-]+)/g;
        const illustrations = [];
        let match;

        while ((match = imagePattern.exec(html)) !== null) {
            const ciid = match[1];
            const encToken = match[2];

            // Avoid duplicates
            if (!illustrations.find(ill => ill.ciid === ciid)) {
                illustrations.push({
                    ciid: ciid,
                    encToken: encToken
                });
            }
        }

        console.log(`Found ${illustrations.length} illustration(s) for card ${cardId}`);

        // Build base URL from request
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host || req.hostname;
        const baseUrl = `${protocol}://${host}`;

        // Default to first illustration if none found
        const defaultIllustration = illustrations.length > 0 ? illustrations[0] : { ciid: '1', encToken: null };

        // Extract reprints
        const reprints = [];
        const reprintPattern = /<div class="t_row\s*">[\s\S]*?<div class="card_number">([\s\S]*?)<\/div>[\s\S]*?<div class="icon rarity">[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*?<\/div>/g;

        let reprintMatch;
        while ((reprintMatch = reprintPattern.exec(html)) !== null) {
            const setCode = reprintMatch[1].replace(/\s/g, '');
            const rarity = reprintMatch[2].replace(/\s/g, '');
            if (setCode && rarity) {
                reprints.push({ setCode, rarity });
            }
        }

        res.json({
            cardId,
            cardName,
            encToken: defaultIllustration.encToken,
            illustrations: illustrations.map(ill => ({
                ciid: ill.ciid,
                encToken: ill.encToken,
                imageUrl: `${baseUrl}/image?cid=${cardId}&ciid=${ill.ciid}&enc=${ill.encToken}`
            })),
            imageUrl: defaultIllustration.encToken ?
                `${baseUrl}/image?cid=${cardId}&ciid=${defaultIllustration.ciid}&enc=${defaultIllustration.encToken}` :
                `${baseUrl}/image?cid=${cardId}`,
            reprints
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

        // Build rarity ID to name mapping from icon_sort section
        // Format: <div id="1" class="t_rid_1 r_none" ...><p ...><span>N</span></p><span>ノーマル仕様</span></div>
        const rarityMap = {};
        const rarityPattern = /class="t_rid_(\d+)\s+r_none"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g;
        let rarityMatch;
        while ((rarityMatch = rarityPattern.exec(html)) !== null) {
            if (!rarityMap[rarityMatch[1]]) {
                rarityMap[rarityMatch[1]] = rarityMatch[2].trim();
            }
        }
        console.log('Rarity map:', rarityMap);

        const cards = [];
        // Match t_row divs allowing additional classes (t_rid_X) after "open"
        const cardPattern = /<div class="t_row c_normal open([^"]*)">([\s\S]*?)<input type="hidden" class="link_value" value="\/yugiohdb\/card_search\.action\?ope=2&cid=(\d+)">/g;

        let match;
        while ((match = cardPattern.exec(html)) !== null) {
            const extraClasses = match[1];
            const cardContent = match[2];
            const cardId = match[3];

            // Extract card name
            const nameMatch = cardContent.match(/<span class="card_name">([\s\S]*?)<\/span>/);
            if (!cardId || !nameMatch) continue;

            const rawName = nameMatch[1].replace(/<span class="card_ruby">[\s\S]*?<\/span>/g, '').trim();
            if (!rawName) continue;

            // Extract rarities from t_rid_X classes
            const ridPattern = /t_rid_(\d+)/g;
            const rarities = [];
            let ridMatch;
            while ((ridMatch = ridPattern.exec(extraClasses)) !== null) {
                const rarityName = rarityMap[ridMatch[1]] || ridMatch[1];
                if (!rarities.includes(rarityName)) {
                    rarities.push(rarityName);
                }
            }

            cards.push({
                id: cardId,
                name: rawName,
                rarities: rarities
            });
        }

        console.log(`Successfully parsed ${cards.length} cards from search results`);

        res.json({
            success: true,
            count: cards.length,
            cards: cards
        });

    } catch (error) {
        console.error('Error fetching card list:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// User Data Storage API
// ==========================================

// Get user data
app.get('/data/:userId', (req, res) => {
    const userId = req.params.userId;

    // Validate userId format (UUID)
    if (!userId || !/^[a-f0-9-]{36}$/i.test(userId)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const filePath = path.join(DATA_DIR, `${userId}.json`);

    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            console.log(`📖 Loaded data for user: ${userId}`);
            res.json(JSON.parse(data));
        } else {
            console.log(`📭 No data found for user: ${userId}`);
            res.json({ cardCollection: [], wishlistCollection: [], recentCardsHistory: [] });
        }
    } catch (error) {
        console.error(`Error reading data for user ${userId}:`, error);
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// Save user data
app.post('/data/:userId', (req, res) => {
    const userId = req.params.userId;

    // Validate userId format (UUID)
    if (!userId || !/^[a-f0-9-]{36}$/i.test(userId)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const filePath = path.join(DATA_DIR, `${userId}.json`);

    try {
        const data = {
            cardCollection: req.body.cardCollection || [],
            wishlistCollection: req.body.wishlistCollection || [],
            recentCardsHistory: req.body.recentCardsHistory || [],
            tagsOrder: req.body.tagsOrder || [],
            updatedAt: new Date().toISOString()
        };

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`💾 Saved data for user: ${userId} (collection: ${data.cardCollection.length}, wishlist: ${data.wishlistCollection.length})`);
        res.json({ success: true, message: 'Data saved successfully' });
    } catch (error) {
        console.error(`Error saving data for user ${userId}:`, error);
        res.status(500).json({ error: 'Failed to save data' });
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
    console.log(`🔗 データAPI: http://localhost:${PORT}/data/:userId`);
    console.log(`🔗 ヘルスチェック: http://localhost:${PORT}/health`);
});
