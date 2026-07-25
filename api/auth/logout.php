<?php
require_once __DIR__ . '/../config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$token = session_token();
if ($token) {
    db()->prepare("DELETE FROM sessions WHERE id = ?")->execute([$token]);
}
clear_session_cookie();
json_ok(['message' => 'Logged out']);
