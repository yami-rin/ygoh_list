const DEFAULT_CHANNEL = 'images';

const abortError = () => new DOMException('Image request was aborted', 'AbortError');

export const imageCacheKey = ({ cardId, ciid = '1', locale = 'ja' }) =>
    locale === 'ja' ? `${cardId}_${ciid}` : `${cardId}_${ciid}_${locale}`;

export function createImageService({
    imageCacheManager = window.imageCacheManager,
    maxConcurrent = 6
} = {}) {
    if (!imageCacheManager) throw new Error('imageCacheManager is required');

    const pending = [];
    const inFlight = new Map();
    const channels = new Map();
    let active = 0;
    let diagnostics = {
        enqueued: 0,
        started: 0,
        completed: 0,
        cancelledPending: 0,
        staleCompletions: 0,
        aborted: 0,
        cacheHits: 0,
        cacheMisses: 0,
        sharedRequests: 0,
        maxActive: 0
    };

    const pump = () => {
        while (active < maxConcurrent && pending.length > 0) {
            const entry = pending.shift();
            if (entry.controller.signal.aborted || entry.subscribers.size === 0) {
                diagnostics.cancelledPending++;
                entry.reject(abortError());
                if (inFlight.get(entry.key) === entry) inFlight.delete(entry.key);
                continue;
            }

            active++;
            entry.started = true;
            diagnostics.started++;
            diagnostics.maxActive = Math.max(diagnostics.maxActive, active);

            Promise.resolve()
                .then(() => imageCacheManager.getImage(entry.key))
                .then((cachedImage) => {
                    if (entry.controller.signal.aborted) throw abortError();
                    if (cachedImage) {
                        diagnostics.cacheHits++;
                        return cachedImage;
                    }
                    diagnostics.cacheMisses++;
                    return imageCacheManager.fetchAndCache(
                        entry.key,
                        entry.cardId,
                        entry.ciid,
                        entry.locale,
                        { signal: entry.controller.signal }
                    );
                })
                .then(entry.resolve, entry.reject)
                .finally(() => {
                    active--;
                    diagnostics.completed++;
                    if (inFlight.get(entry.key) === entry) inFlight.delete(entry.key);
                    pump();
                });
        }
    };

    const maybeAbortEntry = (entry) => {
        if (entry.subscribers.size === 0 && !entry.controller.signal.aborted) {
            entry.controller.abort();
            diagnostics.aborted++;
        }
    };

    const subscribe = (entry, signal) => new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(abortError());
            return;
        }

        const subscriber = {};
        let settled = false;
        entry.subscribers.add(subscriber);

        const finish = (callback, value) => {
            if (settled) return;
            settled = true;
            signal?.removeEventListener('abort', onAbort);
            entry.subscribers.delete(subscriber);
            callback(value);
        };
        const onAbort = () => {
            finish(reject, abortError());
            maybeAbortEntry(entry);
        };
        signal?.addEventListener('abort', onAbort, { once: true });

        entry.promise.then(
            (value) => finish(resolve, value),
            (error) => finish(reject, error)
        );
    });

    const getCardImage = ({ cardId, ciid = '1', locale = 'ja', signal } = {}) => {
        if (!cardId) return Promise.resolve(null);
        const normalized = {
            cardId: String(cardId),
            ciid: String(ciid || '1'),
            locale: locale || 'ja'
        };
        const key = imageCacheKey(normalized);
        let entry = inFlight.get(key);
        if (entry?.controller.signal.aborted) {
            if (inFlight.get(key) === entry) inFlight.delete(key);
            entry = null;
        }
        if (entry) {
            diagnostics.sharedRequests++;
            diagnostics.enqueued++;
            return subscribe(entry, signal);
        }

        const controller = new AbortController();
        let resolveEntry;
        let rejectEntry;
        const promise = new Promise((resolve, reject) => {
            resolveEntry = resolve;
            rejectEntry = reject;
        });
        entry = {
            key,
            ...normalized,
            controller,
            promise,
            resolve: resolveEntry,
            reject: rejectEntry,
            subscribers: new Set(),
            started: false
        };
        // All consumers attach rejection handlers through subscribe; this prevents an
        // abandoned queued entry from producing an unhandled rejection.
        promise.catch(() => {});
        inFlight.set(key, entry);
        pending.push(entry);
        diagnostics.enqueued++;
        const subscribed = subscribe(entry, signal);
        pump();
        return subscribed;
    };

    const beginChannel = (channel = DEFAULT_CHANNEL) => {
        const previous = channels.get(channel);
        if (previous) {
            diagnostics.cancelledPending += previous.targets.size;
            previous.observer?.disconnect();
            previous.controller.abort();
        }
        const state = {
            generation: (previous?.generation || 0) + 1,
            controller: new AbortController(),
            observer: null,
            targets: new Set()
        };
        channels.set(channel, state);
        return state;
    };

    const cancel = (channel = DEFAULT_CHANNEL) => {
        beginChannel(channel);
        pump();
    };

    const request = ({
        channel = DEFAULT_CHANNEL,
        element,
        cardId,
        ciid = '1',
        locale = 'ja',
        load,
        apply,
        onError
    }) => {
        const state = channels.get(channel) || beginChannel(channel);
        const generation = state.generation;
        const imagePromise = load
            ? Promise.resolve().then(() => load({ signal: state.controller.signal }))
            : getCardImage({ cardId, ciid, locale, signal: state.controller.signal });
        return imagePromise
            .then((value) => {
                const current = channels.get(channel);
                if (current?.generation === generation && element?.isConnected !== false) {
                    apply?.(value);
                } else {
                    diagnostics.staleCompletions++;
                }
                return value;
            })
            .catch((error) => {
                if (error?.name === 'AbortError') return null;
                const current = channels.get(channel);
                if (current?.generation === generation && element?.isConnected !== false) {
                    onError?.(error);
                } else {
                    diagnostics.staleCompletions++;
                }
                return null;
            });
    };

    const prefetchVisible = ({
        channel = DEFAULT_CHANNEL,
        elements,
        createRequest,
        root = null,
        rootMargin = '0px',
        threshold = 0.01
    }) => {
        const state = beginChannel(channel);
        const targets = Array.from(elements || []);
        targets.forEach((element) => state.targets.add(element));

        const queueTarget = (element, index) => {
            state.targets.delete(element);
            const spec = createRequest(element, index);
            if (spec) request({ channel, element, ...spec });
        };

        if (targets.length === 0) return state.generation;
        if (!('IntersectionObserver' in window)) {
            targets.forEach(queueTarget);
            return state.generation;
        }

        const indices = new Map(targets.map((element, index) => [element, index]));
        state.observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                state.observer.unobserve(entry.target);
                queueTarget(entry.target, indices.get(entry.target));
            }
        }, { root, rootMargin, threshold });
        targets.forEach((element) => state.observer.observe(element));
        return state.generation;
    };

    const clearCardImage = async ({ cardId, ciid = '1', locale = 'ja' } = {}) => {
        if (!cardId) return;
        const key = imageCacheKey({ cardId: String(cardId), ciid: String(ciid || '1'), locale: locale || 'ja' });
        inFlight.get(key)?.controller.abort();
        return imageCacheManager.deleteImage(key);
    };

    const getDiagnostics = () => ({
        ...diagnostics,
        active,
        pending: pending.filter((entry) => !entry.controller.signal.aborted).length,
        inFlight: inFlight.size,
        maxConcurrent
    });

    const resetDiagnostics = () => {
        diagnostics = {
            enqueued: 0,
            started: 0,
            completed: 0,
            cancelledPending: 0,
            staleCompletions: 0,
            aborted: 0,
            cacheHits: 0,
            cacheMisses: 0,
            sharedRequests: 0,
            maxActive: active
        };
    };

    return {
        getCardImage,
        prefetchVisible,
        clearCardImage,
        request,
        cancel,
        getDiagnostics,
        resetDiagnostics
    };
}

let defaultService;
const getDefaultService = () => {
    if (!defaultService) defaultService = createImageService();
    return defaultService;
};

export const getCardImage = (options) => getDefaultService().getCardImage(options);
export const prefetchVisible = (options) => getDefaultService().prefetchVisible(options);
export const clearCardImage = (options) => getDefaultService().clearCardImage(options);
export const cancelImagePrefetch = (channel) => getDefaultService().cancel(channel);
