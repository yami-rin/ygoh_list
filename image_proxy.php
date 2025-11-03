<?php
/**
 * 遊戯王カード画像プロキシ
 * CORS制限を回避するためのサーバーサイドプロキシ
 */

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

// Get card ID from query parameter
$cardId = isset($_GET['cid']) ? intval($_GET['cid']) : 0;
$encToken = isset($_GET['enc']) ? $_GET['enc'] : '';

if ($cardId === 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Card ID is required']);
    exit;
}

// Build image URL
if (!empty($encToken)) {
    $imageUrl = "https://www.db.yugioh-card.com/yugiohdb/get_image.action?type=2&cid={$cardId}&ciid=1&enc={$encToken}";
} else {
    $imageUrl = "https://www.db.yugioh-card.com/yugiohdb/card_image.action?cid={$cardId}&request_locale=ja";
}

// Initialize cURL
$ch = curl_init($imageUrl);

// Set cURL options
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    CURLOPT_REFERER => 'https://www.db.yugioh-card.com/',
    CURLOPT_HTTPHEADER => [
        'Accept: image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language: ja,en-US;q=0.9,en;q=0.8'
    ]
]);

// Execute request
$imageData = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);

// Check for errors
if (curl_errno($ch)) {
    http_response_code(500);
    echo json_encode(['error' => curl_error($ch)]);
    curl_close($ch);
    exit;
}

curl_close($ch);

// Check HTTP response code
if ($httpCode !== 200) {
    http_response_code($httpCode);
    echo json_encode(['error' => "Failed to fetch image: HTTP {$httpCode}"]);
    exit;
}

// Set appropriate content type
if ($contentType) {
    header("Content-Type: {$contentType}");
} else {
    header('Content-Type: image/jpeg');
}

// Output image data
echo $imageData;
?>
