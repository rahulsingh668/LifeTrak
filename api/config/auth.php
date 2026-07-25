<?php
require_once __DIR__ . '/db.php';

// ── CORS + JSON headers ───────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = [
    'http://localhost:3000',
    'http://localhost:8080',
    'https://lifetrak.in',        // ← update with your real domain
    'https://www.lifetrak.in',
];
if (in_array($origin, $allowed, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// ── Session helpers ───────────────────────────────────────────────
function session_token(): ?string {
    return $_COOKIE['lifetrak_session'] ?? null;
}

function set_session_cookie(string $token, int $days = 30): void {
    $expires = time() + $days * 86400;
    setcookie('lifetrak_session', $token, [
        'expires'  => $expires,
        'path'     => '/',
        'secure'   => (APP_ENV === 'production'),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function clear_session_cookie(): void {
    setcookie('lifetrak_session', '', ['expires' => time() - 3600, 'path' => '/']);
}

function require_auth(): array {
    $token = session_token();
    if (!$token) { json_error('Unauthorised', 401); }

    $stmt = db()->prepare(
        "SELECT s.user_id, u.name, u.email
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id = ? AND s.expires_at > NOW()
         LIMIT 1"
    );
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if (!$row) { json_error('Session expired. Please log in again.', 401); }
    return $row;
}

function new_session(int $userId): string {
    $token = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', strtotime('+30 days'));
    // Clean old sessions for this user
    db()->prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at < NOW()")->execute([$userId]);
    db()->prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
        ->execute([$token, $userId, $expires]);
    return $token;
}

// ── Response helpers ──────────────────────────────────────────────
function json_ok(mixed $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode(['ok' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(string $message, int $code = 400): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function body(): array {
    $raw = file_get_contents('php://input');
    return $raw ? (json_decode($raw, true) ?? []) : [];
}

function sanitize(string $val, int $max = 255): string {
    return mb_substr(trim(strip_tags($val)), 0, $max);
}
