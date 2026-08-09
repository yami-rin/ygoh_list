const VALID_THEMES = new Set(['light', 'dark']);

function normalizeTheme(theme) {
    return VALID_THEMES.has(theme) ? theme : 'light';
}

function defaultRoot() {
    return globalThis.document?.documentElement || null;
}

function defaultStorage() {
    try {
        return globalThis.localStorage || null;
    } catch {
        return null;
    }
}

function readStoredTheme(storage) {
    try {
        const value = storage?.getItem('theme');
        return VALID_THEMES.has(value) ? value : null;
    } catch {
        return null;
    }
}

export function getTheme({ root = defaultRoot(), storage = defaultStorage() } = {}) {
    const stored = readStoredTheme(storage);
    if (stored) return stored;
    const current = root?.dataset?.bsTheme;
    return normalizeTheme(current);
}

export function applyTheme(theme, {
    root = defaultRoot(),
    storage = defaultStorage(),
    persist = true,
    emit = true,
} = {}) {
    if (!root) throw new Error('applyTheme requires a document root');
    const nextTheme = normalizeTheme(theme);
    const previousTheme = root.dataset.bsTheme || null;
    root.dataset.bsTheme = nextTheme;
    if (persist) {
        try {
            storage?.setItem('theme', nextTheme);
        } catch {}
    }
    if (emit) {
        const EventConstructor = root.ownerDocument?.defaultView?.CustomEvent || globalThis.CustomEvent;
        if (EventConstructor) {
            root.dispatchEvent(new EventConstructor('themechange', {
                bubbles: true,
                detail: { theme: nextTheme, previousTheme },
            }));
        }
    }
    return nextTheme;
}

export function toggleTheme(options = {}) {
    const current = getTheme(options);
    return applyTheme(current === 'dark' ? 'light' : 'dark', options);
}

export function watchTheme(callback, {
    root = defaultRoot(),
    storage = defaultStorage(),
    immediate = false,
} = {}) {
    if (!root || typeof callback !== 'function') throw new TypeError('watchTheme requires root and callback');
    const view = root.ownerDocument?.defaultView;
    const onThemeChange = (event) => callback(event.detail.theme, event);
    const onStorage = (event) => {
        if (event.key !== 'theme' || !VALID_THEMES.has(event.newValue)) return;
        applyTheme(event.newValue, { root, storage, persist: false });
    };
    root.addEventListener('themechange', onThemeChange);
    view?.addEventListener('storage', onStorage);
    if (immediate) callback(getTheme({ root, storage }), null);
    return () => {
        root.removeEventListener('themechange', onThemeChange);
        view?.removeEventListener('storage', onStorage);
    };
}
