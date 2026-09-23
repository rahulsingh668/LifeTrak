<?php
require_once __DIR__ . '/../config/auth.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$b     = body();
$email = strtolower(trim($b['email'] ?? ''));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_error('Enter a valid email address.');
rate_limit('forgot_password_ip', client_ip(), 10, 3600);
rate_limit('forgot_password_email', $email, 5, 3600);

$stmt = db()->prepare("SELECT id, name, otp_last_sent FROM users WHERE email = ? LIMIT 1");
$stmt->execute([$email]);
$user = $stmt->fetch();

// Identical response whether or not the account exists — no enumeration
if ($user) {
    if (otp_rate_limited($user['otp_last_sent'])) json_error('Please wait a minute before requesting another code.', 429);
    issue_otp((int)$user['id'], $email, $user['name'], 'reset');
}
json_ok(['sent' => true]);
