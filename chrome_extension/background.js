// 遊戯王カード画像取得ヘルパー - バックグラウンドスクリプト

console.log('遊戯王カード画像取得ヘルパー: バックグラウンドスクリプト起動');

// 画像リクエストのヘッダーを修正
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const headers = details.requestHeaders;

    // Refererヘッダーを追加/修正
    const refererIndex = headers.findIndex(h => h.name.toLowerCase() === 'referer');
    if (refererIndex >= 0) {
      headers[refererIndex].value = 'https://www.db.yugioh-card.com/';
    } else {
      headers.push({
        name: 'Referer',
        value: 'https://www.db.yugioh-card.com/'
      });
    }

    // User-Agentを追加
    const uaIndex = headers.findIndex(h => h.name.toLowerCase() === 'user-agent');
    if (uaIndex >= 0) {
      headers[uaIndex].value = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    return { requestHeaders: headers };
  },
  {
    urls: [
      'https://www.db.yugioh-card.com/yugiohdb/get_image.action*',
      'https://www.db.yugioh-card.com/yugiohdb/card_image.action*'
    ]
  },
  ['blocking', 'requestHeaders']
);

// レスポンスヘッダーを修正してCORSを許可
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    const headers = details.responseHeaders;

    // CORS headers を追加
    headers.push({
      name: 'Access-Control-Allow-Origin',
      value: '*'
    });

    headers.push({
      name: 'Access-Control-Allow-Methods',
      value: 'GET, POST, OPTIONS'
    });

    headers.push({
      name: 'Access-Control-Allow-Headers',
      value: '*'
    });

    return { responseHeaders: headers };
  },
  {
    urls: [
      'https://www.db.yugioh-card.com/yugiohdb/get_image.action*',
      'https://www.db.yugioh-card.com/yugiohdb/card_image.action*'
    ]
  },
  ['blocking', 'responseHeaders']
);

// メッセージリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchImage') {
    fetchImageWithBypass(request.url)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true; // async response
  }
});

// 画像を取得する関数
async function fetchImageWithBypass(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Referer': 'https://www.db.yugioh-card.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onloadend = () => resolve({ success: true, dataUrl: reader.result });
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
}
