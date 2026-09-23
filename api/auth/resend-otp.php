<?php
require_once __DIR__ . '/../config/auth.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$b     = body();
$email = strtolower(trim($b['email'] ?? ''));
if (!$email) json_error('Email is required.');
rate_limit('resend_otp_ip', client_ip(), 10, 3600);
rate_limit('resend_otp_email', $email, 5, 3600);

$stmt = db()->prepare("SELECT id, name, email_verified, otp_last_sent FROM users WHERE email = ? LIMIT 1");
$stmt->execute([$email]);
$user = $stmt->fetch();

// Same reply whether or not the account exists / is verified
if ($user && !(int)$user['email_verified']) {
    if (otp_rate_limited($user['otp_last_sent'])) json_error('Please wait a minute before requesting another code.', 429);
    issue_otp((int)$user['id'], $email, $user['name']);
}
json_ok(['sent' => true]);
