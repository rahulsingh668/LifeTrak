<?php
require_once __DIR__ . '/../config/auth.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$b     = body();
$email = strtolower(trim($b['email'] ?? ''));
$code  = preg_replace('/\D/', '', (string)($b['code'] ?? ''));
$pass  = $b['password'] ?? '';

if (!$email || strlen($code) !== 6) json_error('Enter the 6-digit code.');
if (strlen($pass) < 8)   json_error('New password must be at least 8 characters.');
if (strlen($pass) > 128) json_error('Password too long.');
rate_limit('reset_password_ip', client_ip(), 20, 900);
rate_limit('reset_password_email', $email, 10, 900);

$stmt = db()->prepare("SELECT id, name, email, otp_hash, otp_expires, otp_attempts FROM users WHERE email = ? LIMIT 1");
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !$user['otp_hash']) json_error('Invalid code.', 400);
if (strtotime($user['otp_expires']) < time()) json_error('That code has expired. Request a new one.', 400);
if ((int)$user['otp_attempts'] >= 5) json_error('Too many attempts. Request a new code.', 429);

if (!password_verify($code, $user['otp_hash'])) {
    db()->prepare("UPDATE users SET otp_attempts = otp_attempts + 1 WHERE id = ?")->execute([$user['id']]);
    json_error('That code isn\'t right. Check the email and try again.', 400);
}

// ── Set password, clear OTP, revoke every existing session ───────
db()->prepare(
    "UPDATE users SET password = ?, email_verified = 1, otp_hash = NULL, otp_expires = NULL, otp_attempts = 0 WHERE id = ?"
)->execute([password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12]), $user['id']]);
db()->prepare("DELETE FROM sessions WHERE user_id = ?")->execute([$user['id']]);

// Fresh session so they land straight in the app
$token = new_session((int)$user['id']);
set_session_cookie($token);

json_ok(['id' => (int)$user['id'], 'name' => $user['name'], 'email' => $user['email']]);
