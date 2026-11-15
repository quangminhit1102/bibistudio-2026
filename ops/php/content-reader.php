<?php
declare(strict_types=1);
// Stable read-only reader. The owned loader supplies this constant, never a URL or environment variable.
ini_set('display_errors', '0');
ini_set('log_errors', '0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Cache-Control: no-store');
function bibi_content_reply(int $status, string $message = ''): never {
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'HEAD') echo $message;
    exit;
}
if (!defined('BIBI_CONTENT_CONFIG_FILE')) bibi_content_reply(404, 'Không tìm thấy trang');
function bibi_content_bytes(string $root, string $file, int $limit): string {
    if ($file === '' || str_contains($file, "\0") || str_contains($file, '\\') || str_starts_with($file, '/') || preg_match('~(?:^|/)\.{1,2}(?:/|$)~', $file)) throw new RuntimeException();
    $path = $root . '/' . $file;
    $actual = realpath($path);
    if ($actual !== $path || !is_file($path) || is_link($path) || filesize($path) > $limit) throw new RuntimeException();
    $bytes = file_get_contents($path, false, null, 0, $limit + 1);
    if ($bytes === false || strlen($bytes) > $limit) throw new RuntimeException();
    return $bytes;
}
function bibi_content_json(string $bytes): array {
    $result = json_decode($bytes, true, 128, JSON_THROW_ON_ERROR);
    if (!is_array($result)) throw new RuntimeException();
    return $result;
}
function bibi_content_id(mixed $value): bool { return is_string($value) && preg_match('/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/D', $value) === 1; }
function bibi_content_hash(mixed $value): bool { return is_string($value) && preg_match('/^[a-f0-9]{64}$/D', $value) === 1; }
function bibi_content_redirect(string $origin, string $path): never {
    if (!preg_match('~^/(?:blog(?:/[a-z0-9/-]*)?|sitemap\.xml|sitemaps/blog\.xml)$~D', $path)) throw new RuntimeException();
    header('Location: ' . $origin . $path, true, 301);
    exit;
}
try {
    clearstatcache(true);
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if ($method !== 'GET' && $method !== 'HEAD') { header('Allow: GET, HEAD'); bibi_content_reply(405, 'Phương thức không được hỗ trợ'); }
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    if (strlen($uri) > 8192 || !str_starts_with($uri, '/') || preg_match('/[\x00-\x20\\\\]/', $uri)) bibi_content_reply(404, 'Không tìm thấy trang');
    $parts = explode('?', $uri, 2); $path = $parts[0];
    if (str_contains($path, '%') || str_contains($path, '//') || preg_match('~(?:^|/)\.{1,2}(?:/|$)~', $path) || !preg_match('~^/(?:blog(?:/[a-z0-9/-]*)?|sitemap\.xml/?|sitemaps/blog\.xml/?|media/content/[a-f0-9]{64}\.(?:webp|png|jpg))$~D', $path)) bibi_content_reply(404, 'Không tìm thấy trang');
    $page = null;
    foreach (explode('&', $parts[1] ?? '') as $pair) {
        if ($pair === '') continue;
        $item = explode('=', $pair, 2); $key = rawurldecode($item[0]);
        if ($key !== 'page') { if (str_starts_with($key, 'page[')) bibi_content_reply(400, 'Phân trang không hợp lệ'); continue; }
        $value = rawurldecode($item[1] ?? '');
        if ($page !== null || !preg_match('/^[1-9][0-9]{0,6}$/D', $value) || (int)$value > 1000000) bibi_content_reply(400, 'Phân trang không hợp lệ');
        $page = (int)$value;
    }
    $configFile = BIBI_CONTENT_CONFIG_FILE;
    if (!is_string($configFile) || realpath($configFile) !== $configFile || is_link($configFile)) throw new RuntimeException();
    $config = bibi_content_json(bibi_content_bytes(dirname($configFile), basename($configFile), 8192));
    $keys = array_keys($config); sort($keys);
    if ($keys !== ['canonicalOrigin','contentRoot','environment','schemaVersion'] || ($config['schemaVersion'] ?? 0) !== 1 || !in_array($config['environment'] ?? '', ['local','production'], true)) throw new RuntimeException();
    $root = $config['contentRoot']; $origin = $config['canonicalOrigin'];
    if (!is_string($root) || !str_starts_with($root, '/') || realpath($root) !== $root || is_link($root) || !is_string($origin)) throw new RuntimeException();
    $canonical = parse_url($origin);
    if (!$canonical || !isset($canonical['scheme'], $canonical['host']) || isset($canonical['user']) || isset($canonical['pass']) || isset($canonical['query']) || isset($canonical['fragment']) || ($canonical['path'] ?? '') !== '' || !in_array($canonical['scheme'], ['http','https'], true)) throw new RuntimeException();
    if ($config['environment'] === 'production' && $origin !== 'https://bibistudio.vn') throw new RuntimeException();
    if ($config['environment'] === 'local' && $canonical['scheme'] !== 'https' && !in_array($canonical['host'], ['127.0.0.1','localhost','[::1]'], true)) throw new RuntimeException();
    $pointer = bibi_content_json(bibi_content_bytes($root, 'active', 1024));
    if (($pointer['schemaVersion'] ?? 0) !== 1 || !bibi_content_id($pointer['generationId'] ?? null) || !bibi_content_hash($pointer['manifestSha256'] ?? null)) throw new RuntimeException();
    $directory = $root . '/generations/' . $pointer['generationId'];
    $manifestBytes = bibi_content_bytes($directory, 'manifest.json', 16 * 1024 * 1024);
    if (!hash_equals($pointer['manifestSha256'], hash('sha256', $manifestBytes))) throw new RuntimeException();
    $manifest = bibi_content_json($manifestBytes);
    if (($manifest['schemaVersion'] ?? 0) !== 1 || ($manifest['id'] ?? '') !== $pointer['generationId'] || ($manifest['rendererVersion'] ?? '') !== 'content-doc-v1' || ($manifest['publicDataFile'] ?? '') !== 'public.json' || !bibi_content_hash($manifest['publicDataSha256'] ?? null) || !is_array($manifest['routes'] ?? null) || !is_array($manifest['media'] ?? null) || !is_array($manifest['fileHashes'] ?? null)) throw new RuntimeException();
    $publicBytes = bibi_content_bytes($directory, 'public.json', 64 * 1024 * 1024);
    if (!hash_equals($manifest['publicDataSha256'], hash('sha256', $publicBytes))) throw new RuntimeException();
    if (str_starts_with($path, '/media/content/')) {
        if ($page !== null) bibi_content_reply(400, 'Phân trang không hợp lệ');
        $key = substr($path, strlen('/media/content/')); $image = $manifest['media'][$key] ?? null;
        if ($image === null) bibi_content_reply(404, 'Không tìm thấy ảnh');
        $extension = pathinfo($key, PATHINFO_EXTENSION); $mime = ['webp'=>'image/webp','png'=>'image/png','jpg'=>'image/jpeg'][$extension];
        if (!is_array($image) || ($image['hash'] ?? '') !== substr($key, 0, 64) || ($image['mime'] ?? '') !== $mime || !preg_match('~^[a-f0-9-]{36}/' . preg_quote($key, '~') . '$~D', $image['file'] ?? '') || !is_int($image['bytes'] ?? null) || $image['bytes'] <= 0 || $image['bytes'] > 32 * 1024 * 1024) throw new RuntimeException();
        $bytes = bibi_content_bytes($root . '/media', $image['file'], 32 * 1024 * 1024);
        if (strlen($bytes) !== $image['bytes'] || !hash_equals($image['hash'], hash('sha256', $bytes))) throw new RuntimeException();
        $etag = '"' . $image['hash'] . '"'; header('Content-Type: ' . $mime); header('Cache-Control: public, max-age=31536000, immutable'); header('ETag: ' . $etag);
        if (in_array($etag, array_map('trim', explode(',', $_SERVER['HTTP_IF_NONE_MATCH'] ?? '')), true)) { http_response_code(304); exit; }
        header('Content-Length: ' . strlen($bytes)); if ($method === 'GET') echo $bytes; exit;
    }
    $normalized = rtrim($path, '/');
    if ($page !== null) {
        if (!preg_match('~^/blog(?:/category/[a-z0-9-]+)?$~D', $normalized)) bibi_content_reply(400, 'Phân trang không hợp lệ');
        $normalized = $page === 1 ? $normalized : $normalized . '/page/' . $page;
    }
    $route = $manifest['routes'][$normalized] ?? null;
    if ($normalized === '/sitemap.xml') $route = ['kind'=>'index'];
    if ($route === null) bibi_content_reply(404, 'Không tìm thấy trang');
    if (($route['kind'] ?? '') === 'redirect') { $normalized = $route['location'] ?? ''; $route = $manifest['routes'][$normalized] ?? null; if (($route['kind'] ?? '') !== 'html') throw new RuntimeException(); }
    $host = strtolower($_SERVER['HTTP_HOST'] ?? '');
    $canonicalHost = strtolower($canonical['host'] . (isset($canonical['port']) ? ':' . $canonical['port'] : ''));
    $localHost = preg_match('/^(?:127\.0\.0\.1|localhost|\[::1\])(?::[0-9]+)?$/D', $host) === 1;
    $secure = ($_SERVER['HTTPS'] ?? '') === 'on' || ($_SERVER['SERVER_PORT'] ?? '') === '443';
    $hostRedirect = $config['environment'] === 'production' ? ($host !== $canonicalHost || !$secure) : (!$localHost && $host !== $canonicalHost);
    if ($hostRedirect || $path !== $normalized || $page !== null) bibi_content_redirect($origin, $normalized);
    if ($route['kind'] === 'index') {
        header('Content-Type: application/xml; charset=utf-8');
        $xml = '<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>' . htmlspecialchars($origin . '/sitemaps/site.xml', ENT_XML1) . '</loc></sitemap><sitemap><loc>' . htmlspecialchars($origin . '/sitemaps/blog.xml', ENT_XML1) . '</loc></sitemap></sitemapindex>';
        header('Content-Length: ' . strlen($xml)); if ($method === 'GET') echo $xml; exit;
    }
    if (($route['kind'] ?? '') !== 'html' || !preg_match('~^(?:pages/[a-f0-9]{64}\.html|sitemap-blog\.xml)$~D', $route['file'] ?? '') || !bibi_content_hash($route['sha256'] ?? null) || ($manifest['fileHashes'][$route['file']] ?? '') !== $route['sha256'] || !in_array($route['contentType'] ?? '', ['text/html','application/xml'], true)) throw new RuntimeException();
    $bytes = bibi_content_bytes($directory, $route['file'], 64 * 1024 * 1024);
    if (!hash_equals($route['sha256'], hash('sha256', $bytes))) throw new RuntimeException();
    header('Content-Type: ' . $route['contentType'] . '; charset=utf-8');
    header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if ($config['environment'] !== 'production') header('X-Robots-Tag: noindex, nofollow');
    header('Content-Length: ' . strlen($bytes)); if ($method === 'GET') echo $bytes;
} catch (Throwable $error) { bibi_content_reply(503, 'Nội dung tạm thời chưa sẵn sàng'); }
