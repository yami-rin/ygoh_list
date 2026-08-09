const DEFAULT_CHANNEL = 'gallery';

export const createGalleryImageQueue = ({ maxConcurrent = 6 } = {}) => {
    const pending = [];
    const generations = new Map();
    const observers = new Map();
    let active = 0;
    let diagnostics = {
        enqueued: 0,
        started: 0,
        completed: 0,
        cancelledPending: 0,
        staleCompletions: 0,
        cacheHits: 0,
        cacheMisses: 0,
        maxActive: 0
    };

    const currentGeneration = (channel) => generations.get(channel) || 0;
    const isCurrent = (entry) => currentGeneration(entry.channel) === entry.generation;

    const pump = () => {
        while (active < maxConcurrent && pending.length > 0) {
            const entry = pending.shift();
            if (!isCurrent(entry)) {
                diagnostics.cancelledPending++;
                continue;
            }

            active++;
            diagnostics.started++;
            diagnostics.maxActive = Math.max(diagnostics.maxActive, active);

            Promise.resolve()
                .then(entry.load)
                .then((value) => {
                    if (isCurrent(entry) && entry.element?.isConnected !== false) {
                        entry.apply?.(value);
                    } else {
                        diagnostics.staleCompletions++;
                    }
                })
                .catch((error) => {
                    if (isCurrent(entry) && entry.element?.isConnected !== false) {
                        entry.onError?.(error);
                    } else {
                        diagnostics.staleCompletions++;
                    }
                })
                .finally(() => {
                    active--;
                    diagnostics.completed++;
                    pump();
                });
        }
    };

    const enqueue = (channel, generation, task) => {
        if (generation !== currentGeneration(channel)) return;
        pending.push({ channel, generation, ...task });
        diagnostics.enqueued++;
        pump();
    };

    const begin = (channel = DEFAULT_CHANNEL) => {
        observers.get(channel)?.disconnect();
        observers.delete(channel);

        const nextGeneration = currentGeneration(channel) + 1;
        generations.set(channel, nextGeneration);

        for (let index = pending.length - 1; index >= 0; index--) {
            if (pending[index].channel === channel) {
                pending.splice(index, 1);
                diagnostics.cancelledPending++;
            }
        }
        return nextGeneration;
    };

    const cancel = (channel = DEFAULT_CHANNEL) => {
        begin(channel);
        pump();
    };

    const observe = (channel, elements, createTask, options = {}) => {
        const generation = begin(channel);
        const targets = Array.from(elements || []);
        if (targets.length === 0) return generation;

        const queueTarget = (element, index) => {
            const task = createTask(element, index);
            if (task) enqueue(channel, generation, { element, ...task });
        };

        if (!('IntersectionObserver' in window)) {
            targets.forEach(queueTarget);
            return generation;
        }

        const indices = new Map(targets.map((element, index) => [element, index]));
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                observer.unobserve(entry.target);
                queueTarget(entry.target, indices.get(entry.target));
            }
        }, {
            root: options.root || null,
            rootMargin: options.rootMargin || '0px',
            threshold: options.threshold ?? 0.01
        });

        observers.set(channel, observer);
        targets.forEach((element) => observer.observe(element));
        return generation;
    };

    const enqueueCurrent = (channel, task) => {
        let generation = currentGeneration(channel);
        if (generation === 0) generation = begin(channel);
        enqueue(channel, generation, task);
    };

    const getDiagnostics = () => ({
        ...diagnostics,
        active,
        pending: pending.length,
        maxConcurrent
    });

    const resetDiagnostics = () => {
        diagnostics = {
            enqueued: 0,
            started: 0,
            completed: 0,
            cancelledPending: 0,
            staleCompletions: 0,
            cacheHits: 0,
            cacheMisses: 0,
            maxActive: active
        };
    };

    return {
        observe,
        cancel,
        enqueueCurrent,
        recordCacheHit: () => { diagnostics.cacheHits++; },
        recordCacheMiss: () => { diagnostics.cacheMisses++; },
        getDiagnostics,
        resetDiagnostics
    };
};
