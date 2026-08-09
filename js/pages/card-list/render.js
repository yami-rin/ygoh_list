export function createRarityBadgeRenderer(escapeHtml) {
    return (rarity) => {
        if (!rarity) return '';
        const normalized = String(rarity).toUpperCase();
        let className = '';
        if (/HR|GMR|10000TH|CR/.test(normalized)) className = 'rarity-b-holo';
        else if (normalized.includes('SE')) className = 'rarity-b-se';
        else if (normalized.includes('UR') || normalized.includes('GR') || normalized === 'PG') className = 'rarity-b-ur';
        else if (normalized.includes('SR')) className = 'rarity-b-sr';
        else if (normalized === 'UL') className = 'rarity-b-ul';
        else if (normalized === 'M') className = 'rarity-b-m';
        else if (normalized === 'R' || normalized === 'P') className = 'rarity-b-r';
        return `<span class="rarity-badge ${className}">${escapeHtml(rarity)}</span>`;
    };
}
