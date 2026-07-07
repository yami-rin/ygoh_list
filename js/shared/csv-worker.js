// 遊戯王マスターCSVのパーサー（共通基盤）
// - ES module としてメインスレッドから import 可能
// - module Worker としても動作（postMessage でCSVテキストを受け取り、パース結果を返す）
// CSV columns: [カードID,]名前,読み方,レベル,属性,種族,カードタイプ,攻撃力,守備力,カードテキスト

export function parseCsvCards(csvText) {
    // Remove BOM if present
    if (csvText.charCodeAt(0) === 0xFEFF) {
        csvText = csvText.substring(1);
    }

    const lines = csvText.split('\n');
    if (lines.length < 2) return [];

    // Check if first column is カードID (new format) or 名前 (old format)
    const headers = lines[0].split(',');
    const hasCardId = headers[0].includes('カードID') || headers[0].includes('ID');

    const cards = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV line (handle commas in quotes)
        const values = [];
        let current = '';
        let inQuotes = false;
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current);

        const offset = hasCardId ? 1 : 0;
        const clean = (v) => v == null ? '' : v.trim();
        const name = clean(values[offset]);
        if (!name) continue;

        cards.push({
            cardId: hasCardId ? clean(values[0]) : '',
            name,
            reading: clean(values[offset + 1]),
            level: clean(values[offset + 2]),
            attribute: clean(values[offset + 3]),
            race: clean(values[offset + 4]),
            cardType: clean(values[offset + 5]),
            attack: clean(values[offset + 6]),
            defense: clean(values[offset + 7]),
            cardText: clean(values[offset + 8]),
        });
    }
    return cards;
}

// Worker として実行されている場合のみメッセージハンドラを登録
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
    self.onmessage = (e) => {
        try {
            const cards = parseCsvCards(e.data);
            self.postMessage({ cards });
        } catch (err) {
            self.postMessage({ error: err.message });
        }
    };
}
