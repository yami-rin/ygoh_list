function wrapText(ctx, text, width, lines = 2) {
    const result = [];
    let line = '';
    for (const char of text) {
        if (ctx.measureText(line + char).width > width && line) { result.push(line); line = ''; }
        line += char;
    }
    if (line) result.push(line);
    if (result.length > lines) {
        result.length = lines;
        let last = result[lines - 1];
        while (last && ctx.measureText(last + '…').width > width) last = last.slice(0, -1);
        result[lines - 1] = last + '…';
    }
    return result;
}

async function decode(url) {
    if (!url) return null;
    const image = new Image();
    image.src = url;
    try { await image.decode(); return image; } catch { return null; }
}

export async function renderExport(canvas, state, loadImage, signal) {
    const pad = 32, labelWidth = 150, cardWidth = 100, artHeight = 146, cellHeight = 158, gap = 12;
    const largestTier = Math.max(...state.tierState.map(cards => cards.length));
    const width = Math.min(1200, Math.max(640, pad * 2 + labelWidth + 32 + Math.min(8, largestTier) * (cardWidth + gap) - gap));
    const columns = Math.floor((width - pad * 2 - labelWidth - 32 + gap) / (cardWidth + gap));
    const heights = state.tierState.map(cards => Math.max(106, Math.ceil(cards.length / columns) * cellHeight + 12));
    const height = 172 + heights.reduce((sum, value) => sum + value + 10, 0) + 54;
    if (height > 16000) throw new Error('カード数が多すぎます。分類を分けるか、JSONで保存してください。');
    const names = state.tierState.flat();
    const decoded = new Map(await Promise.all(names.map(async name => [name, await decode(await loadImage(name))])));
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f2f5f5'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#132c35'; ctx.fillRect(0, 0, width, 140);
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#a8cfbf'; ctx.font = '600 13px sans-serif'; ctx.fillText('遊戯王 禁止・制限予想', pad, 25);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 32px sans-serif';
    wrapText(ctx, state.title.trim() || '次回 禁止・制限予想', width - pad * 2, 1).forEach(line => ctx.fillText(line, pad, 54));
    ctx.fillStyle = '#c5d5d6'; ctx.font = '14px sans-serif'; ctx.fillText(`予想カード ${names.length}枚`, pad, 105);
    let y = 166;
    for (let index = 0; index < state.tierConfig.length; index++) {
        const tier = state.tierConfig[index], cards = state.tierState[index], rowHeight = heights[index];
        ctx.fillStyle = '#fff'; ctx.fillRect(pad, y, width - pad * 2, rowHeight);
        ctx.fillStyle = tier.color + '22'; ctx.fillRect(pad, y, labelWidth, rowHeight);
        ctx.fillStyle = tier.color; ctx.fillRect(pad, y, 5, rowHeight);
        ctx.fillStyle = '#183039'; ctx.font = 'bold 20px sans-serif';
        const labelLines = wrapText(ctx, tier.name, labelWidth - 30, 3);
        const labelY = y + rowHeight / 2 - (labelLines.length * 26 + 24) / 2;
        labelLines.forEach((line, offset) => ctx.fillText(line, pad + 18, labelY + offset * 26));
        ctx.fillStyle = '#687b82'; ctx.font = '13px sans-serif'; ctx.fillText(`${cards.length} 枚`, pad + 18, labelY + labelLines.length * 26 + 6);
        cards.forEach((name, cardIndex) => {
            const x = pad + labelWidth + 16 + cardIndex % columns * (cardWidth + gap);
            const top = y + 12 + Math.floor(cardIndex / columns) * cellHeight;
            const image = decoded.get(name);
            if (image) ctx.drawImage(image, x, top, cardWidth, artHeight);
            else {
                ctx.fillStyle = '#e9efeb'; ctx.fillRect(x, top, cardWidth, artHeight);
                ctx.fillStyle = '#597069'; ctx.font = '12px sans-serif';
                wrapText(ctx, name, cardWidth - 12, 7).forEach((line, offset) => ctx.fillText(line, x + 6, top + 12 + offset * 14));
            }
        });
        y += rowHeight + 10;
    }
    ctx.fillStyle = '#687b82'; ctx.font = '12px sans-serif';
    ctx.fillText('個人の禁止・制限予想です。公式発表ではありません。', pad, height - 32);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNGの生成に失敗しました。');
    return { blob, missing: names.filter(name => !decoded.get(name)).length };
}
