<?php
// Local-only router, deliberately excluded from the deployable backend/relay assets.
$path=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH);
if($path==='/__relay-ready'){header('Content-Type: application/json');header('Cache-Control: no-store');echo '{"ok":true,"runtime":"php"}';return;}
if($path==='/api/analytics/relay/collect.php'){require '/relay/collect.php';return;}
http_response_code(404);
