<?php
require_once __DIR__ . '/../config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$b     = body();
$email = strtolower(trim($b['email'] ?? ''));
$pass  = $b['password'] ?? '';

if (!$email || !$pass) json_error('Email and password are required.');

// ── Lookup user ───────────────────────────────────────────────────
$stmt = db()->prepare("SELECT id, name, email, password FROM users WHERE email = ? LIMIT 1");
$stmt->execute([$email]);
$user = $stmt->fetch();

// Always run verify even on miss to prevent timing attacks
$hash = $user['password'] ?? '$2y$12$invalidhashpadding000000000000000000000000000000000000000';
if (!$user || !password_verify($pass, $hash)) {
    json_error('Incorrect email or password.', 401);
}

// ── Issue session ─────────────────────────────────────────────────
$token = new_session((int) $user['id']);
set_session_cookie($token);

json_ok(['id' => $user['id'], 'name' => $user['name'], 'email' => $user['email']]);
