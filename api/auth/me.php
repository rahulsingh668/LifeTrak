<?php
require_once __DIR__ . '/../config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$user = require_auth();
json_ok(['id' => $user['user_id'], 'name' => $user['name'], 'email' => $user['email']]);
