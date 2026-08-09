const TOAST_VARIANTS = new Set(['success', 'warning', 'danger', 'info']);

function requireElement(element, apiName) {
    if (!element || element.nodeType !== 1) throw new TypeError(`${apiName} requires an Element`);
    return element;
}

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
    })[character]);
}

export function setLoading(element, loading, { text } = {}) {
    const target = requireElement(element, 'setLoading');
    target.hidden = !loading;
    target.setAttribute('aria-busy', String(Boolean(loading)));
    if (text !== undefined) target.textContent = String(text);
    return target;
}

export function showEmpty(element, empty, { title, description } = {}) {
    const target = requireElement(element, 'showEmpty');
    target.hidden = !empty;
    if (title !== undefined) {
        const titleElement = target.querySelector('.ygo-empty__title');
        if (titleElement) titleElement.textContent = String(title);
    }
    if (description !== undefined) {
        const descriptionElement = target.querySelector('.ygo-empty__description');
        if (descriptionElement) descriptionElement.textContent = String(description);
    }
    return target;
}

export function getModal(element, { bootstrap = globalThis.bootstrap } = {}) {
    const target = requireElement(element, 'getModal');
    if (bootstrap?.Modal?.getOrCreateInstance) {
        return bootstrap.Modal.getOrCreateInstance(target);
    }
    return {
        show() {
            target.hidden = false;
            target.style.display = 'block';
            target.classList.add('show');
            target.setAttribute('aria-hidden', 'false');
        },
        hide() {
            target.hidden = true;
            target.style.display = 'none';
            target.classList.remove('show');
            target.setAttribute('aria-hidden', 'true');
        },
        dispose() {},
    };
}

export function showToast(container, message, {
    variant = 'info',
    duration = 3000,
    bootstrap = globalThis.bootstrap,
} = {}) {
    const region = requireElement(container, 'showToast');
    const safeVariant = TOAST_VARIANTS.has(variant) ? variant : 'info';
    region.setAttribute('aria-live', region.getAttribute('aria-live') || 'polite');
    region.setAttribute('aria-atomic', region.getAttribute('aria-atomic') || 'true');

    const toast = region.ownerDocument.createElement('div');
    toast.className = `toast ygo-toast ygo-toast--${safeVariant}`;
    toast.setAttribute('role', safeVariant === 'danger' ? 'alert' : 'status');
    toast.setAttribute('aria-atomic', 'true');
    const body = region.ownerDocument.createElement('div');
    body.className = 'toast-body';
    body.textContent = String(message ?? '');
    toast.append(body);
    region.append(toast);

    if (bootstrap?.Toast?.getOrCreateInstance) {
        const instance = bootstrap.Toast.getOrCreateInstance(toast, { delay: duration, autohide: duration > 0 });
        toast.addEventListener('hidden.bs.toast', () => toast.remove(), { once: true });
        instance.show();
    } else {
        toast.classList.add('show');
        if (duration > 0) globalThis.setTimeout(() => toast.remove(), duration);
    }
    return toast;
}
