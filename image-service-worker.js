// Image Service Worker - CORS制限を回避
const CACHE_NAME = 'yugioh-images-v1';
const YUGIOH_DB_DOMAIN = 'www.db.yugioh-card.com';

// Install event
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(self.clients.claim());
});

// Fetch event - Intercept image requests
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Check if this is a Yu-Gi-Oh image request
    if (url.hostname === YUGIOH_DB_DOMAIN &&
        (url.pathname.includes('/get_image.action') || url.pathname.includes('/card_image.action'))) {

        console.log('[Service Worker] Intercepting image request:', url.href);

        event.respondWith(
            fetchImageWithBypass(event.request)
        );
    }
});

async function fetchImageWithBypass(request) {
    const url = new URL(request.url);

    try {
        // Try cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            console.log('[Service Worker] Serving from cache:', url.href);
            return cachedResponse;
        }

        // Method 1: Try direct fetch with modified headers
        console.log('[Service Worker] Attempting direct fetch...');
        const directResponse = await fetch(request.url, {
            method: 'GET',
            mode: 'cors',
            credentials: 'omit',
            headers: {
                'Referer': 'https://www.db.yugioh-card.com/',
                'User-Agent': navigator.userAgent,
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
            }
        });

        if (directResponse.ok) {
            console.log('[Service Worker] Direct fetch successful');
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, directResponse.clone());
            return directResponse;
        }

        // Method 2: Try via CORS proxy
        console.log('[Service Worker] Trying CORS proxy...');
        const proxyUrls = [
            `https://corsproxy.io/?${encodeURIComponent(url.href)}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(url.href)}`,
        ];

        for (const proxyUrl of proxyUrls) {
            try {
                const proxyResponse = await fetch(proxyUrl);
                if (proxyResponse.ok) {
                    console.log('[Service Worker] CORS proxy successful:', proxyUrl);
                    const blob = await proxyResponse.blob();
                    const response = new Response(blob, {
                        status: 200,
                        headers: {
                            'Content-Type': proxyResponse.headers.get('Content-Type') || 'image/jpeg',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(request, response.clone());
                    return response;
                }
            } catch (error) {
                console.log('[Service Worker] Proxy failed:', proxyUrl, error);
            }
        }

        // Fallback: Return placeholder image
        console.log('[Service Worker] All methods failed, returning placeholder');
        return createPlaceholderImage();

    } catch (error) {
        console.error('[Service Worker] Error:', error);
        return createPlaceholderImage();
    }
}

function createPlaceholderImage() {
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="421" height="614">
            <rect fill="#f0f0f0" width="421" height="614"/>
            <text x="50%" y="50%" text-anchor="middle" fill="#999" font-size="20">
                画像読み込み失敗
            </text>
        </svg>
    `;

    return new Response(svg, {
        status: 200,
        headers: {
            'Content-Type': 'image/svg+xml',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
