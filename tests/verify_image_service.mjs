import { serve, firefox } from './helpers.mjs';

const PORT = 5625;
const { server, baseUrl } = serve(PORT);
const browser = await firefox.launch();
const context = await browser.newContext();
const page = await context.newPage();
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const detailCount = new Map();
let activeRequests = 0;
let maxActiveRequests = 0;
let offline = true;

const count = (map, key) => map.set(key, (map.get(key) || 0) + 1);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fulfillImageRequest = async (route, kind) => {
    activeRequests++;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    try {
        const url = new URL(route.request().url());
        const cid = kind === 'detail'
            ? url.searchParams.get('cid')
            : url.pathname.split('/').pop().replace(/\.png$/, '');
        await wait(cid === 'abort' ? 180 : 40);
        if (kind === 'detail') {
            count(detailCount, cid);
            if (cid === '404') {
                await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
                return;
            }
            if (cid === 'offline' && offline) {
                await route.abort('failed');
                return;
            }
            const imageUrl = `http://localhost:3000/mock-service-image/${cid}.png`;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ imageUrl, illustrations: [{ ciid: '1', imageUrl }] })
            });
        } else {
            await route.fulfill({ status: 200, contentType: 'image/png', body: png });
        }
    } catch (error) {
        if (!/aborted|closed|intercept/i.test(error.message)) throw error;
    } finally {
        activeRequests--;
    }
};

try {
    await page.route('**/card-detail?**', (route) => fulfillImageRequest(route, 'detail'));
    await page.route('**/mock-service-image/**', (route) => fulfillImageRequest(route, 'image'));
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' });
    await page.addScriptTag({ url: `${baseUrl}/image_cache_manager.js` });
    await page.evaluate(async () => {
        await window.imageCacheManager.init();
        await window.imageCacheManager.clearAllCache();
        const module = await import('./js/shared/image-service.js');
        window.__imageServiceModule = module;
        window.__testImageService = module.createImageService({
            imageCacheManager: window.imageCacheManager,
            maxConcurrent: 6
        });
    });

    const apiShape = await page.evaluate(() => ({
        getCardImage: typeof window.__imageServiceModule.getCardImage,
        prefetchVisible: typeof window.__imageServiceModule.prefetchVisible,
        clearCardImage: typeof window.__imageServiceModule.clearCardImage
    }));
    if (Object.values(apiShape).some((type) => type !== 'function')) {
        throw new Error(`named export不足: ${JSON.stringify(apiShape)}`);
    }

    const shared = await page.evaluate(async () => {
        const service = window.__testImageService;
        const values = await Promise.all(Array.from({ length: 3 }, () => service.getCardImage({ cardId: 'shared' })));
        return { sameValue: values.every((value) => value === values[0]), diagnostics: service.getDiagnostics() };
    });
    if (!shared.sameValue || detailCount.get('shared') !== 1 || shared.diagnostics.sharedRequests !== 2) {
        throw new Error(`同一key Promise共有違反: ${JSON.stringify(shared)}, requests=${detailCount.get('shared')}`);
    }

    const beforeCacheHit = detailCount.get('shared');
    await page.evaluate(() => window.__testImageService.getCardImage({ cardId: 'shared' }));
    if (detailCount.get('shared') !== beforeCacheHit) throw new Error('cache hitでnetwork再取得が発生しました');

    const locale = await page.evaluate(async () => {
        const service = window.__testImageService;
        await service.getCardImage({ cardId: 'locale', ciid: '2', locale: 'ko' });
        return Boolean(await window.imageCacheManager.getImage('locale_2_ko'));
    });
    if (!locale) throw new Error('非jaの既存cache key形式が維持されていません');

    await page.evaluate(async () => {
        const service = window.__testImageService;
        await service.clearCardImage({ cardId: 'locale', ciid: '2', locale: 'ko' });
        if (await window.imageCacheManager.getImage('locale_2_ko')) throw new Error('clearCardImage失敗');
    });

    const notFound = await page.evaluate(async () => {
        try {
            await window.__testImageService.getCardImage({ cardId: '404' });
            return { rejected: false };
        } catch (error) {
            return {
                rejected: true,
                status: error.status,
                cached: Boolean(await window.imageCacheManager.getImage('404_1'))
            };
        }
    });
    if (!notFound.rejected || notFound.status !== 404 || notFound.cached) {
        throw new Error(`404 placeholder contract違反: ${JSON.stringify(notFound)}`);
    }

    const offlineFailure = await page.evaluate(async () => {
        try {
            await window.__testImageService.getCardImage({ cardId: 'offline' });
            return false;
        } catch { return true; }
    });
    if (!offlineFailure) throw new Error('offline失敗が呼出元へ通知されません');
    offline = false;
    const offlineRetry = await page.evaluate(() => window.__testImageService.getCardImage({ cardId: 'offline' }));
    if (!offlineRetry?.startsWith('data:image/')) throw new Error('offline後のretryがbroken stateです');

    const abortResult = await page.evaluate(async () => {
        const controller = new AbortController();
        const request = window.__testImageService.getCardImage({ cardId: 'abort', signal: controller.signal });
        setTimeout(() => controller.abort(), 20);
        try {
            await request;
            return 'resolved';
        } catch (error) {
            return error.name;
        }
    });
    if (abortResult !== 'AbortError') throw new Error(`AbortController contract違反: ${abortResult}`);
    const abortRetry = await page.evaluate(() => window.__testImageService.getCardImage({ cardId: 'abort' }));
    if (!abortRetry?.startsWith('data:image/')) throw new Error('abort後のretryがbroken stateです');

    maxActiveRequests = 0;
    await page.evaluate(() => Promise.all(Array.from({ length: 12 }, (_, index) =>
        window.__testImageService.getCardImage({ cardId: `batch-${index}` }))));
    const finalDiagnostics = await page.evaluate(() => window.__testImageService.getDiagnostics());
    if (maxActiveRequests > 6 || finalDiagnostics.maxActive > 6) {
        throw new Error(`最大6並列を超過: route=${maxActiveRequests}, service=${finalDiagnostics.maxActive}`);
    }

    console.log('✓ named exports: getCardImage / prefetchVisible / clearCardImage');
    console.log('✓ 同一key 3並列: detail/image fetch各1回・Promise共有2件');
    console.log('✓ cache hit再取得0・locale/ciid key・clearCardImage');
    console.log('✓ 404は未cacheのままplaceholder用errorを返す');
    console.log('✓ offline/abort後のretry成功・broken stateなし');
    console.log(`✓ 最大同時画像取得: route=${maxActiveRequests}, service=${finalDiagnostics.maxActive}/6`);
} finally {
    await context.close().catch(() => {});
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
}
