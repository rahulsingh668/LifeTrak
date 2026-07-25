<?php
require_once __DIR__ . '/../config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$b = body();
$name  = sanitize($b['name']  ?? '', 100);
$email = strtolower(trim($b['email'] ?? ''));
$pass  = $b['password'] ?? '';

// ── Validation ────────────────────────────────────────────────────
if (!$name)                         json_error('Name is required.');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_error('Enter a valid email address.');
if (strlen($pass) < 8)              json_error('Password must be at least 8 characters.');
if (strlen($pass) > 128)            json_error('Password too long.');

// ── Check email uniqueness ────────────────────────────────────────
$stmt = db()->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
$stmt->execute([$email]);
if ($stmt->fetch()) json_error('An account with that email already exists.');

// ── Create user ───────────────────────────────────────────────────
$hash = password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12]);
$stmt = db()->prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)");
$stmt->execute([$name, $email, $hash]);
$userId = (int) db()->lastInsertId();

// ── Seed default events for new user ─────────────────────────────
$defaultEvents = require __DIR__ . '/../config/default_events.php';
$ins = db()->prepare(
    "INSERT INTO events (user_id, slug, name, emoji, currency, budget, phases, categories)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
);
foreach ($defaultEvents as $ev) {
    $ins->execute([
        $userId, $ev['slug'], $ev['name'], $ev['emoji'],
        $ev['currency'], $ev['budget'],
        json_encode($ev['phases'] ?? [], JSON_UNESCAPED_UNICODE),
        json_encode($ev['categories'], JSON_UNESCAPED_UNICODE),
    ]);
}

// ── Issue session ─────────────────────────────────────────────────
$token = new_session($userId);
set_session_cookie($token);

json_ok(['id' => $userId, 'name' => $name, 'email' => $email], 201);
