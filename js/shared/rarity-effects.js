// レアリティ演出の設定（localStorage['rarityEffectSettings']）。
// 未保存のブラウザでも演出が出るよう既定値を持つ。options.html で保存した設定があればそちらを優先する。
export const DEFAULT_RARITY_EFFECTS = {
    'SR': ['silver-shimmer'],
    'M+SR': ['silver-shimmer'],
    'P+SR': ['silver-shimmer', 'starfoil'],
    'UR': ['gold-shimmer'],
    'P+UR': ['gold-shimmer', 'starfoil'],
    'UL': ['gold-border', 'gold-glow'],
    'GR': ['ghost'],
    'PG': ['gold-full-glow'],
    'CR': ['collectors'],
    'HR': ['holographic'],
    'SE': ['prismatic'],
    'GSE': ['gold-glow', 'prismatic'],
    'EXSE': ['diamond'],
    'P+SE': ['prismatic', 'starfoil'],
    'PSE': ['prism-glow'],
    'QCSE': ['rainbow-border', 'prismatic'],
    '20th': ['20th', 'rainbow-border'],
    '10000th': ['platinum', 'rainbow-border'],
    'GMR': ['aurora'],
};

export function loadRarityEffectSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem('rarityEffectSettings') || 'null');
        if (saved && typeof saved === 'object') return saved;
    } catch { /* 壊れた値は既定値で置き換える */ }
    return structuredClone(DEFAULT_RARITY_EFFECTS);
}
