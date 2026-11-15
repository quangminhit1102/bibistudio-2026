<?php
// Test/dev adapter only. Never copied to the release reader.
if (($_SERVER['REQUEST_URI'] ?? '') === '/__relay-ready') {
    header('Content-Type: application/json'); echo json_encode(['runtime'=>'php']); exit;
}
define('BIBI_CONTENT_CONFIG_FILE', '/relay/private/content-reader.json');
require '/relay/content-reader.php';
