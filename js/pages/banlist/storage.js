export const SAVE_KEY = 'banlist_editor_v4';
export const DEFAULT_CONFIG = [
    { id: 'tier-0', name: '禁止', color: '#c7535f' },
    { id: 'tier-1', name: '制限', color: '#d18a43' },
    { id: 'tier-2', name: '制限・緩和', color: '#c8a458' },
    { id: 'tier-3', name: '準制限', color: '#b5ae54' },
    { id: 'tier-4', name: '準制限・緩和', color: '#7aa17b' },
    { id: 'tier-5', name: '解除', color: '#519b9c' },
];

export function validateState(data) {
    if (!data || !Array.isArray(data.tierConfig) || !data.tierConfig.length || data.tierConfig.length > 30 || !Array.isArray(data.tierState)) throw new Error('分類とカードのデータが正しくありません。');
    const seen = new Set();
    const ids = new Set();
    const tierConfig = data.tierConfig.map((tier, index) => {
        if (typeof tier?.name !== 'string' || !tier.name.trim() || !/^#[0-9a-f]{6}$/i.test(tier.color)) throw new Error('分類の名前または色が正しくありません。');
        let id = typeof tier.id === 'string' ? tier.id : `tier-${index}`;
        if (ids.has(id)) id = `tier-${index}-${crypto.randomUUID()}`;
        ids.add(id);
        return { id, name: tier.name.trim().slice(0, 24), color: tier.color };
    });
    const tierState = tierConfig.map((_, index) => {
        const cards = data.tierState[index] ?? [];
        if (!Array.isArray(cards) || cards.some(name => typeof name !== 'string' || !name.trim() || name.length > 200)) throw new Error('カードのデータが正しくありません。');
        return cards.filter(name => { if (seen.has(name)) return false; seen.add(name); return true; });
    });
    if (seen.size > 2000) throw new Error('1つのリストに登録できるのは2,000枚までです。');
    return { version: 4, title: typeof data.title === 'string' ? data.title.slice(0, 60) : '次回 禁止・制限予想', tierConfig, tierState };
}

export function emptyState() {
    return { version: 4, title: '次回 禁止・制限予想', tierConfig: DEFAULT_CONFIG.map(tier => ({ ...tier })), tierState: DEFAULT_CONFIG.map(() => []) };
}

export function loadBanlistState() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return validateState(JSON.parse(raw));
    const oldConfig = localStorage.getItem('banlist_tier_config');
    const oldState = localStorage.getItem('banlist_v3');
    if (!oldConfig && !oldState) return emptyState();
    // Leave legacy data intact. The new snapshot is written only after an edit.
    return validateState({ tierConfig: oldConfig ? JSON.parse(oldConfig) : DEFAULT_CONFIG, tierState: oldState ? JSON.parse(oldState) : [] });
}

export function saveBanlistState(state) {
    // One atomic write keeps tier order, names, and cards together.
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}
