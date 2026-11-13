<?php
declare(strict_types=1);
// Generated from a reviewed source: root is never taken from the request or headers.
ini_set('display_errors', '0');
header('Cache-Control: no-store');
function bibi_loader_fail(int $status): never {
 http_response_code($status); header('Content-Type: application/json');
 echo '{"error":{"code":"ANALYTICS_RELAY_UNAVAILABLE"}}'; exit;
}
try {
 $root = __BIBI_DEPLOY_ROOT__;
 $current = realpath($root.'/current');
 $releases = realpath($root.'/releases');
 if ($current === false || $releases === false || !str_starts_with($current, $releases.'/') || dirname($current) !== $releases) bibi_loader_fail(503);
 $manifestFile = $current.'/manifest.json';
 if (!is_file($manifestFile) || filesize($manifestFile) > 65536) bibi_loader_fail(503);
 $manifest = json_decode(file_get_contents($manifestFile), true, 16, JSON_THROW_ON_ERROR);
 if (($manifest['schemaVersion'] ?? 0) < 6 || !isset($manifest['visitorContext'])) bibi_loader_fail(404);
 $feature = $manifest['visitorContext'];
 if (($feature['requiredMin'] ?? null) !== 1 || ($feature['compatibleMax'] ?? null) !== 1 || !preg_match('/^[a-f0-9]{64}$/', $feature['relaySha256'] ?? '')) bibi_loader_fail(503);
 $hash = hash_init('sha256');
 foreach (['collect.php', 'context.php'] as $name) {
  $file = $current.'/backend/relay/'.$name;
  if (realpath($file) !== $file || !is_file($file) || filesize($file) > 65536) bibi_loader_fail(503);
  hash_update($hash, $name."\n".hash_file('sha256', $file)."\n");
 }
 if (!hash_equals($feature['relaySha256'], hash_final($hash))) bibi_loader_fail(503);
 $configFile = $root.'/private/analytics-relay.json';
 if (realpath($configFile) !== $configFile || !is_file($configFile) || filesize($configFile) > 8192) bibi_loader_fail(503);
 $bibiRelayConfig = json_decode(file_get_contents($configFile), true, 16, JSON_THROW_ON_ERROR);
 if (($bibiRelayConfig['environment'] ?? '') !== 'production') bibi_loader_fail(503);
 require $current.'/backend/relay/collect.php';
} catch (Throwable $error) { bibi_loader_fail(503); }
