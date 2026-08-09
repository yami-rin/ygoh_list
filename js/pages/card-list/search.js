export function getReadingForSort(cardDetailsMap, name) {
    const reading = (cardDetailsMap.get(name)?.reading) || name || '';
    return reading.replace(/^["\u201C\u201D\u300C\u300D\u300E\u300F]+/, '');
}

export function createSearchNormalizer(decodeHtmlEntities) {
    const normalizeCache = new Map();

    return (text) => {
        if (!text) return '';
        const cached = normalizeCache.get(text);
        if (cached !== undefined) return cached;

        let normalized = decodeHtmlEntities(text);
        normalized = normalized.toLowerCase();
        normalized = normalized.replace(/[ァ-ヶ]/g, (match) => {
            const code = match.charCodeAt(0) - 0x60;
            return String.fromCharCode(code);
        });
        normalized = normalized.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (match) => {
            return String.fromCharCode(match.charCodeAt(0) - 0xFEE0);
        });
        normalized = normalized.replace(/　/g, ' ');
        normalized = normalized.replace(/・/g, '');

        if (normalizeCache.size > 50000) normalizeCache.clear();
        normalizeCache.set(text, normalized);
        return normalized;
    };
}
