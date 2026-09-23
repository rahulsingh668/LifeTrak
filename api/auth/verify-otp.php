<?php
require_once __DIR__ . '/../config/auth.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$b     = body();
$email = strtolower(trim($b['email'] ?? ''));
$code  = preg_replace('/\D/', '', (string)($b['code'] ?? ''));

if (!$email || strlen($code) !== 6) json_error('Enter the 6-digit code.');
rate_limit('verify_otp_ip', client_ip(), 30, 900);
rate_limit('verify_otp_email', $email, 10, 900);

$stmt = db()->prepare(
    "SELECT id, name, email, email_verified, otp_hash, otp_expires, otp_attempts
     FROM users WHERE email = ? LIMIT 1"
);
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user)                        json_error('Invalid code.', 400);
if ((int)$user['email_verified'])  json_error('This email is already verified — just sign in.', 400);
if (!$user['otp_hash'] || !$user['otp_expires'] || strtotime($user['otp_expires']) < time())
    json_error('That code has expired. Tap "Resend code" for a new one.', 400);
if ((int)$user['otp_attempts'] >= 5)
    json_error('Too many attempts. Tap "Resend code" for a new one.', 429);

if (!password_verify($code, $user['otp_hash'])) {
    db()->prepare("UPDATE users SET otp_attempts = otp_attempts + 1 WHERE id = ?")->execute([$user['id']]);
    json_error('That code isn\'t right. Check the email and try again.', 400);
}

// ── Verified: clear OTP state, open session ──────────────────────
db()->prepare(
    "UPDATE users SET email_verified = 1, otp_hash = NULL, otp_expires = NULL, otp_attempts = 0 WHERE id = ?"
)->execute([$user['id']]);

$token = new_session((int)$user['id']);
set_session_cookie($token);

json_ok(['id' => (int)$user['id'], 'name' => $user['name'], 'email' => $user['email']]);
