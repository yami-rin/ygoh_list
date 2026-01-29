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

        // Extract card name from the title or header
        const nameMatch = html.match(/<title>遊戯王OCGカードデータベース \| (.*?)《/) || html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        const cardName = nameMatch ? nameMatch[1].trim() : 'Unknown Card';

        const reprints = [];
        const reprintBlockPattern = /<div class="card_number">([\s\S]*?)<\/div>[\s\S]*?<div class="rarity">[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*?<\/div>/g;
        
        let match;
        while ((match = reprintBlockPattern.exec(html)) !== null) {
            const setCode = match[1].trim();
            const rarity = match[2].replace(/<[^>]*>/g, '').trim();
            if (setCode && rarity) {
                reprints.push({ setCode, rarity });
            }
        }
        
        if (reprints.length === 0) {
            // Parsing failed, return raw HTML for debugging
            return res.json({
                cardId,
                cardName,
                reprints: [],
                error: 'Parsing failed on server',
                html: html 
            });
        }

        res.json({
            cardId,
            cardName,
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

        // Parse card list from HTML
        const cards = [];

        // Rarity code mapping
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

        // Split HTML by card entries (using link_value as delimiter)
        // Each card block contains: card_name, rarities, and link_value (cid)
        const cardBlockPattern = /<input[^>]*class="link_value"[^>]*value="\/yugiohdb\/card_search\.action\?ope=2&(?:amp;)?cid=(\d+)"[^>]*>/g;

        let lastIndex = 0;
        let match;
        const cardBlocks = [];

        while ((match = cardBlockPattern.exec(html)) !== null) {
            const cardId = match[1];
            const blockEnd = match.index;
            const blockHtml = html.substring(lastIndex, blockEnd + match[0].length);
            cardBlocks.push({ id: cardId, html: blockHtml });
            lastIndex = blockEnd;
        }

        console.log(`Found ${cardBlocks.length} card blocks`);

        // Parse each card block
        cardBlocks.forEach((block, index) => {
            // Extract card name
            const nameMatch = block.html.match(/<span\s+class="card_name"[^>]*>([^<]+)<\/span>/);
            const cardName = nameMatch ? nameMatch[1].trim() : `Card ${block.id}`;

            // Extract ALL rarities for this card
            // Look for <div class="lr_icon rid rid_X"> ... <p>SR</p>
            const rarityPattern = /<div\s+class="lr_icon\s+rid\s+rid_\d+"[^>]*>[\s\S]*?<p>([^<]+)<\/p>/gi;
            const cardRarities = [];
            let rarityMatch;

            while ((rarityMatch = rarityPattern.exec(block.html)) !== null) {
                let rarityCode = rarityMatch[1].trim();

                if (rarityCode && !cardRarities.includes(rarityCode)) {
                    cardRarities.push(rarityCode);
                }
            }

            // Fallback: if no lr_icon found, try the old pack_ method
            if (cardRarities.length === 0) {
                const packPattern = /<div\s+class="icon\s+rarity\s+pack_([a-z0-9]+)"[^>]*>/gi;
                let packMatch;
                while ((packMatch = packPattern.exec(block.html)) !== null) {
                    const rarityCode = packMatch[1].toLowerCase();
                    const mappedRarity = rarityMap[rarityCode] || 'その他';
                    if (!cardRarities.includes(mappedRarity)) {
                        cardRarities.push(mappedRarity);
                    }
                }
            }

            console.log(`Card ${index}: ${cardName} (ID: ${block.id}), Rarities: [${cardRarities.join(', ')}]`);

            cardBlocks[index].name = cardName;
            cardBlocks[index].rarities = cardRarities;
        });

        console.log(`Parsed ${cardBlocks.length} cards with rarities`);

        // Extract release date from search results page
        let releaseDate = '';
        const releaseDateMatch = html.match(/<p\s+id="previewed"[^>]*>[\s\S]*?公開日\s*:\s*(\d{4})年(\d{2})月(\d{2})日[\s\S]*?<\/p>/);
        if (releaseDateMatch) {
            const year = releaseDateMatch[1];
            const month = releaseDateMatch[2];
            const day = releaseDateMatch[3];
            releaseDate = `${year}-${month}-${day}`;
            console.log(`Release date from search results: ${releaseDate}`);
        } else {
            console.log('No release date found in search results');
        }

        // Get card number (型番) from the first card's detail page
        let baseCardNumber = '';
        if (cardBlocks.length > 0) {
            try {
                const firstCardId = cardBlocks[0].id;
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

                // If release date is available, find card_number matching that date
                if (releaseDate) {
                    console.log(`Looking for card_number with matching release date: ${releaseDate}`);

                    // Find all card_number and time pairs
                    // Pattern: <div class="time">YYYY-MM-DD</div> ... <div class="card_number">XXX</div>
                    const timePattern = /<div\s+class="time">\s*([0-9-]+)\s*<\/div>[\s\S]*?<div\s+class="card_number">\s*([^\s<]+)\s*<\/div>/g;
                    let match;

                    while ((match = timePattern.exec(detailHtml)) !== null) {
                        const timeValue = match[1].trim();
                        const cardNumber = match[2].trim();

                        console.log(`Found card_number: ${cardNumber}, time: ${timeValue}`);

                        if (timeValue === releaseDate) {
                            baseCardNumber = cardNumber;
                            console.log(`Matched! Using card number: ${baseCardNumber}`);
                            break;
                        }
                    }

                    // If no match found, fall back to first card_number
                    if (!baseCardNumber) {
                        console.log('No matching date found, falling back to first card_number');
                        const cardNumberMatch = detailHtml.match(/<div\s+class="card_number">([^<]+)<\/div>/);
                        if (cardNumberMatch) {
                            baseCardNumber = cardNumberMatch[1].trim();
                            console.log(`Fallback card number: ${baseCardNumber}`);
                        }
                    }
                } else {
                    // No release date available, use first card_number
                    const cardNumberMatch = detailHtml.match(/<div\s+class="card_number">([^<]+)<\/div>/);
                    if (cardNumberMatch) {
                        baseCardNumber = cardNumberMatch[1].trim();
                        console.log(`Base card number: ${baseCardNumber}`);
                    }
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

        // Build final card list with all rarities
        cardBlocks.forEach((block, index) => {
            cards.push({
                id: block.id,
                name: block.name,
                number: generateCardNumber(baseCardNumber, index),
                rarities: block.rarities // Array of all rarities for this card
            });
        });

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
