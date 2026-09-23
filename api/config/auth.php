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
    setcookie('lifetrak_session', '', [
        'expires'  => time() - 3600,
        'path'     => '/',
        'secure'   => (APP_ENV === 'production'),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
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

function client_ip(): string {
    // REMOTE_ADDR is intentionally used instead of spoofable forwarding headers.
    // A trusted reverse proxy may overwrite REMOTE_ADDR at the web-server layer.
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

/**
 * Atomic fixed-window rate limiter. The raw email/IP is never stored.
 */
function rate_limit(string $action, string $subject, int $limit, int $windowSeconds): void {
    $now = time();
    $windowStart = intdiv($now, $windowSeconds) * $windowSeconds;
    $subjectHash = hash_hmac('sha256', strtolower(trim($subject)), APP_SECRET);
    $stmt = db()->prepare(
        "INSERT INTO rate_limits (action, subject_hash, window_start, hits)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE hits = LAST_INSERT_ID(hits + 1), updated_at = NOW()"
    );
    $stmt->execute([$action, $subjectHash, $windowStart]);

    $check = db()->prepare(
        "SELECT hits FROM rate_limits WHERE action = ? AND subject_hash = ? AND window_start = ?"
    );
    $check->execute([$action, $subjectHash, $windowStart]);
    $hits = (int)($check->fetchColumn() ?: 0);
    if ($hits > $limit) {
        $retryAfter = max(1, ($windowStart + $windowSeconds) - $now);
        header('Retry-After: ' . $retryAfter);
        json_error('Too many attempts. Please try again later.', 429);
    }

    // Cheap probabilistic cleanup keeps the table bounded without a cron job.
    if (random_int(1, 100) === 1) {
        db()->exec("DELETE FROM rate_limits WHERE updated_at < DATE_SUB(NOW(), INTERVAL 2 DAY)");
    }
}

function require_recent_password(int $uid, string $password): void {
    if ($password === '') json_error('Password is required.', 400);
    $stmt = db()->prepare("SELECT password FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$uid]);
    $hash = $stmt->fetchColumn();
    if (!$hash || !password_verify($password, $hash)) json_error('Incorrect password.', 403);
}

// ── Event access helper ───────────────────────────────────────────
// Returns 'owner' | 'editor' | 'viewer' | null for a user on an event.
function event_role(int $eventId, int $uid): ?string {
    $stmt = db()->prepare(
        "SELECT CASE WHEN e.user_id = ? THEN 'owner' ELSE em.role END AS role
         FROM events e
         LEFT JOIN event_members em ON em.event_id = e.id AND em.user_id = ?
         WHERE e.id = ? AND (e.user_id = ? OR em.user_id = ?) LIMIT 1"
    );
    $stmt->execute([$uid, $uid, $eventId, $uid, $uid]);
    $row = $stmt->fetch();
    return $row ? $row['role'] : null;
}

function can_edit(?string $role): bool { return in_array($role, ['owner','editor'], true); }

// ── Email OTP ─────────────────────────────────────────────────────
function issue_otp(int $userId, string $email, string $name, string $purpose = 'verify'): bool {
    $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    db()->prepare(
        "UPDATE users SET otp_hash = ?, otp_expires = DATE_ADD(NOW(), INTERVAL 10 MINUTE),
                          otp_attempts = 0, otp_last_sent = NOW() WHERE id = ?"
    )->execute([password_hash($code, PASSWORD_BCRYPT), $userId]);

    $reset   = $purpose === 'reset';
    $subject = $reset ? "$code — reset your LifeTrak password" : "$code is your LifeTrak code";
    $html = '<div style="font-family:Inter,Arial,sans-serif;max-width:440px;margin:0 auto;padding:32px 24px">
      <div style="width:48px;height:48px;border-radius:12px;background:#4f7ef8;color:#fff;font-size:22px;font-weight:800;line-height:48px;text-align:center">L</div>
      <h2 style="font-size:20px;margin:20px 0 6px;color:#111">' . ($reset ? 'Reset your password' : 'Verify your email') . '</h2>
      <p style="font-size:14px;color:#555;margin:0 0 22px">Hi ' . htmlspecialchars($name) . ', ' . ($reset ? 'use this code to set a new password for your LifeTrak account' : 'use this code to finish creating your LifeTrak account') . '. It expires in 10 minutes.</p>
      <div style="font-size:34px;font-weight:800;letter-spacing:10px;background:#f4f6fb;border-radius:12px;padding:18px 0;text-align:center;color:#111">' . $code . '</div>
      <p style="font-size:12px;color:#999;margin-top:22px">' . ($reset ? 'Didn\'t request a reset? Your password is unchanged — you can ignore this email.' : 'Didn\'t sign up for LifeTrak? You can ignore this email.') . '</p>
    </div>';
    $headers  = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "From: LifeTrak <no-reply@lifetrak.app>\r\n";
    return @mail($email, $subject, $html, $headers);
}

function otp_rate_limited(?string $lastSent): bool {
    return $lastSent && (time() - strtotime($lastSent)) < 60;
}

// ── Admin access ──────────────────────────────────────────────────
const ADMIN_EMAILS = ['rahulsingh668@gmail.com'];

function require_admin(): array {
    $user = require_auth();
    $stmt = db()->prepare("SELECT email FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([(int)$user['user_id']]);
    $row = $stmt->fetch();
    if (!$row || !in_array(strtolower($row['email']), ADMIN_EMAILS, true)) {
        json_error('Not authorized.', 403);
    }
    return $user;
}
