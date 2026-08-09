import fs from 'node:fs';
import path from 'node:path';
import { serve, firefox, collectErrors, DOCROOT } from './helpers.mjs';

process.env.MOZ_DISABLE_CONTENT_SANDBOX = '1';

const cssFiles = ['css/theme.css', 'css/components.css', 'css/page-shell.css'];
const productionHtml = fs.readdirSync(DOCROOT).filter((name) => name.endsWith('.html'));
const forbiddenReferences = /css\/(?:theme|components|page-shell)\.css|js\/shared\/(?:theme|ui|firebase-client|auth)\.js/;
let failed = false;
const ok = (message) => console.log(`✓ ${message}`);
const fail = (message) => { failed = true; console.error(`✗ ${message}`); };

for (const relativePath of cssFiles) {
    const css = fs.readFileSync(path.join(DOCROOT, relativePath), 'utf8');
    const importantCount = (css.match(/!important/g) || []).length;
    const expectedImportantCount = relativePath === 'css/theme.css' ? 4 : 0;
    if (importantCount !== expectedImportantCount) {
        fail(`${relativePath}: !important ${importantCount}件（期待=${expectedImportantCount}）`);
    } else if (importantCount) {
        ok(`${relativePath}: reduced-motion限定 !important ${importantCount}件`);
    } else {
        ok(`${relativePath}: !important 0件`);
    }
    const idSelectors = css.match(/^[ \t]*[^@\n][^{\n]*#[A-Za-z_][\w-]*[^{\n]*\{/gm) || [];
    if (idSelectors.length) fail(`${relativePath}: page固有ID selector ${idSelectors.join(', ')}`);
    else ok(`${relativePath}: ID selector 0件`);
}

for (const name of productionHtml) {
    const html = fs.readFileSync(path.join(DOCROOT, name), 'utf8');
    if (forbiddenReferences.test(html)) fail(`${name}: Phase 2基盤を参照している`);
}
if (!failed) ok(`既存HTML ${productionHtml.length}件からPhase 2基盤への参照0件`);

const PORT = 5622;
const { server, baseUrl } = serve(PORT);
const browser = await firefox.launch({ headless: true });

try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = collectErrors(page);
    await page.goto(`${baseUrl}/tests/fixtures/shared-foundation.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__foundationReady === true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reducedMotionDuration = await page.locator('.ygo-btn').first().evaluate((element) => getComputedStyle(element).transitionDuration);
    if (reducedMotionDuration === '0.00001s') ok('prefers-reduced-motion computed transition 0.01ms');
    else fail(`prefers-reduced-motion未適用: ${reducedMotionDuration}`);

    const uiResult = await page.evaluate(async () => {
        const theme = await import('/js/shared/theme.js');
        const ui = await import('/js/shared/ui.js');
        const themeEvents = [];
        const stopWatching = theme.watchTheme((nextTheme) => themeEvents.push(nextTheme));
        theme.applyTheme('dark');
        const toggled = theme.toggleTheme();
        stopWatching();
        theme.applyTheme('dark');

        const loading = document.getElementById('fixture-loading');
        ui.setLoading(loading, true, { text: 'ロード中' });
        const loadingShown = !loading.hidden && loading.textContent === 'ロード中';
        ui.setLoading(loading, false);
        const loadingHidden = loading.hidden;

        const empty = document.getElementById('fixture-empty');
        ui.showEmpty(empty, true, { title: '空です', description: '条件を変更してください' });
        const emptyShown = !empty.hidden
            && empty.querySelector('.ygo-empty__title').textContent === '空です'
            && empty.querySelector('.ygo-empty__description').textContent === '条件を変更してください';

        const toastRegion = document.getElementById('fixture-toasts');
        const toast = ui.showToast(toastRegion, '<script>alert(1)</script>', { duration: 0 });

        const modalCalls = [];
        const modalElement = document.getElementById('fixture-modal');
        const modal = ui.getModal(modalElement, {
            bootstrap: { Modal: { getOrCreateInstance: (element) => ({
                show: () => modalCalls.push(`show:${element.id}`),
                hide: () => modalCalls.push(`hide:${element.id}`),
            }) } },
        });
        modal.show();
        modal.hide();

        return {
            currentTheme: theme.getTheme(),
            toggled,
            themeEvents,
            loadingShown,
            loadingHidden,
            emptyShown,
            toastText: toast.querySelector('.toast-body').textContent,
            toastHtml: toast.querySelector('.toast-body').innerHTML,
            toastAriaLive: toastRegion.getAttribute('aria-live'),
            escaped: ui.escapeHtml(`<script data-x="1">'&</script>`),
            modalCalls,
        };
    });

    if (uiResult.currentTheme === 'dark' && uiResult.toggled === 'light') ok('theme apply/get/toggle');
    else fail(`theme状態不一致: ${JSON.stringify(uiResult)}`);
    if (JSON.stringify(uiResult.themeEvents) === JSON.stringify(['dark', 'light'])) ok('themechange CustomEventとunsubscribe');
    else fail(`themechange callback不一致: ${JSON.stringify(uiResult.themeEvents)}`);
    if (uiResult.loadingShown && uiResult.loadingHidden) ok('loading hidden切替');
    else fail('loading hidden切替失敗');
    if (uiResult.emptyShown) ok('empty state表示');
    else fail('empty state表示失敗');
    if (uiResult.toastText === '<script>alert(1)</script>'
        && !uiResult.toastHtml.includes('<script>')
        && uiResult.toastAriaLive === 'polite') ok('toast aria-liveと安全なtext描画');
    else fail(`toast不一致: ${JSON.stringify(uiResult)}`);
    if (uiResult.escaped === '&lt;script data-x=&quot;1&quot;&gt;&#39;&amp;&lt;/script&gt;') ok('HTML escape');
    else fail(`HTML escape不一致: ${uiResult.escaped}`);
    if (JSON.stringify(uiResult.modalCalls) === JSON.stringify(['show:fixture-modal', 'hide:fixture-modal'])) ok('Bootstrap modal共存');
    else fail(`modal wrapper不一致: ${JSON.stringify(uiResult.modalCalls)}`);

    const authResult = await page.evaluate(async () => {
        const firebase = await import('/js/shared/firebase-client.js?foundation-test');
        const authModule = await import('/js/shared/auth.js?foundation-test');
        let initializeCount = 0;
        let authCallback = null;
        let unsubscribeCount = 0;
        const order = [];
        const mockAuth = { id: 'auth' };
        const mockDb = { id: 'db' };
        const sdk = {
            getApps: () => [],
            initializeApp: (config) => { initializeCount += 1; return { config }; },
            getAuth: () => mockAuth,
            getFirestore: () => mockDb,
            browserLocalPersistence: 'LOCAL',
            setPersistence: async () => { order.push('persistence'); },
            onAuthStateChanged: (_auth, callback) => {
                authCallback = callback;
                return () => { unsubscribeCount += 1; };
            },
        };
        let loaderCount = 0;
        const sdkLoader = async () => { loaderCount += 1; return sdk; };
        const first = await firebase.getFirebaseClient({ sdkLoader });
        const second = await firebase.getFirebaseClient({ sdkLoader });

        const states = [];
        const unsubscribe = await authModule.subscribeAuth((state) => {
            order.push(`state:${state.status}`);
            states.push(state);
        }, {
            getClient: async () => first,
            api: { setAuth: async (user) => order.push(`api:${user?.uid || 'null'}`) },
        });
        authCallback({ uid: 'user-1' });
        await new Promise((resolve) => setTimeout(resolve, 0));
        authCallback(null);
        await new Promise((resolve) => setTimeout(resolve, 0));
        unsubscribe();
        authCallback({ uid: 'ignored' });
        await new Promise((resolve) => setTimeout(resolve, 0));

        const localStates = [];
        const localOrder = [];
        const stopLocal = await authModule.subscribeAuth((state) => {
            localOrder.push(`state:${state.status}`);
            localStates.push(state);
        }, {
            localMode: true,
            localUser: { uid: 'local_user', email: 'local' },
            api: { setAuth: async (user) => localOrder.push(`api:${user.uid}`) },
        });
        stopLocal();

        return {
            initializeCount,
            loaderCount,
            sameClient: first === second,
            authId: first.auth.id,
            dbId: first.db.id,
            states: states.map(({ status, user, isLocal }) => ({ status, uid: user?.uid || null, isLocal })),
            order,
            unsubscribeCount,
            localStates: localStates.map(({ status, user, isLocal }) => ({ status, uid: user?.uid || null, isLocal })),
            localOrder,
        };
    });

    if (authResult.initializeCount === 1 && authResult.loaderCount === 1 && authResult.sameClient
        && authResult.authId === 'auth' && authResult.dbId === 'db') ok('Firebase app/Auth/Firestore singleton');
    else fail(`Firebase singleton不一致: ${JSON.stringify(authResult)}`);
    if (JSON.stringify(authResult.states) === JSON.stringify([
        { status: 'authenticated', uid: 'user-1', isLocal: false },
        { status: 'unauthenticated', uid: null, isLocal: false },
    ])) ok('認証/未認証状態とcallback count');
    else fail(`auth state不一致: ${JSON.stringify(authResult.states)}`);
    if (JSON.stringify(authResult.order) === JSON.stringify([
        'persistence', 'api:user-1', 'state:authenticated', 'api:null', 'state:unauthenticated',
    ])) ok('setPersistenceとAPI auth後callbackの順序');
    else fail(`auth順序不一致: ${JSON.stringify(authResult.order)}`);
    if (authResult.unsubscribeCount === 1) ok('Firebase auth unsubscribe');
    else fail(`unsubscribe count=${authResult.unsubscribeCount}`);
    if (JSON.stringify(authResult.localStates) === JSON.stringify([
        { status: 'local', uid: 'local_user', isLocal: true },
    ]) && JSON.stringify(authResult.localOrder) === JSON.stringify(['api:local_user', 'state:local'])) ok('local auth状態とAPI順序');
    else fail(`local auth不一致: ${JSON.stringify(authResult)}`);

    if (errors.length) errors.forEach((error) => fail(error));
    else ok('fixture console/page error 0件');
    await page.close().catch(() => {});
} catch (error) {
    fail(error.stack || error.message);
} finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
}

process.exit(failed ? 1 : 0);
