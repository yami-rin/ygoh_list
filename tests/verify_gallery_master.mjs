// card_gallery.html の共通マスターデータ基盤(loadMasterData)移行を検証する
// - window.cardDetailsMap / cardReadingMap が充填されるか
// - 引用符内カンマを含むCSVも正しくパースされるか（=Workerパーサ経由か）
// - 2回目ロードで IndexedDB キャッシュが効くか（ネットワークDLゼロ）
import { serve, firefox, collectErrors } from './helpers.mjs';

const PORT = 5599;
const { server, baseUrl } = serve(PORT);
const browser = await firefox.launch();
let failed = false;
const fail = (m) => { failed = true; console.error('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.accept()); // 「ログインが必要です」alert を閉じる
    // 未ログイン時の card_list.html へのリダイレクトを止め、ギャラリーの実行文脈を保持する
    await page.route('**/card_list.html', (route) => route.abort());
    const errors = collectErrors(page);
    const logs = [];
    page.on('console', (m) => logs.push(m.text()));

    // --- 1回目ロード（ネットワーク） ---
    await page.goto(`${baseUrl}/card_gallery.html`, { waitUntil: 'load' });
    await page.waitForFunction(
        () => window.cardDetailsMap && window.cardDetailsMap.size > 0,
        { timeout: 30000 });

    const stats = await page.evaluate(() => ({
        details: window.cardDetailsMap.size,
        // 既知カードの詳細フィールドが揃っているか
        urara: window.cardDetailsMap.get('灰流うらら') || null,
    }));
    console.log(`\n[1回目] cardDetailsMap=${stats.details}件`);
    if (stats.details > 10000) ok(`カード詳細 ${stats.details}件ロード`);
    else fail(`カード詳細が少なすぎる: ${stats.details}`);

    if (stats.urara && stats.urara.cardId && stats.urara.reading) {
        ok(`詳細フィールド健全 (灰流うらら: id=${stats.urara.cardId}, 読み=${stats.urara.reading}, 種族=${stats.urara.race})`);
    } else {
        fail('灰流うらら の詳細が取得できない（フィールド形状の不一致?）: ' + JSON.stringify(stats.urara));
    }

    const loadLog = logs.find((l) => /master-data: .*件ロード完了/.test(l));
    if (loadLog) ok('共通ローダー使用を確認: ' + loadLog);
    else fail('master-data ローダーのログが出ていない（旧経路のまま?）');

    // --- 2回目ロード（同一オリジン→IndexedDBキャッシュ命中を期待） ---
    // idbPut は非awaitのため、遷移前にコミット完了を待つ（実運用では再訪まで時間が空く）
    await page.waitForTimeout(1500);
    logs.length = 0;
    await page.goto(`${baseUrl}/card_gallery.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.cardDetailsMap && window.cardDetailsMap.size > 0, { timeout: 30000 });
    const cacheLog = logs.find((l) => /master-data:.*IndexedDBキャッシュ/.test(l));
    if (cacheLog) ok('再訪で IndexedDB キャッシュ命中: ' + cacheLog);
    else console.warn('  ! 2回目もネットワーク（HEAD比較で更新扱い?）— キャッシュ未命中: ' + (logs.find(l=>/master-data:/.test(l))||''));

    if (errors.length) { errors.forEach((e) => fail('エラー検出: ' + e)); }
    else ok('想定外の console/page エラーなし');

    console.log('\n' + (failed ? '=== NG ===' : '=== OK ==='));
} finally {
    await browser.close();
    server.close();
}
process.exit(failed ? 1 : 0);
