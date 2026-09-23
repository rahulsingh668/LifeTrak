<?php
require_once __DIR__ . '/../config/auth.php';
$user = require_auth();
$uid  = (int)$user['user_id'];

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    rate_limit('account_update_user', (string)$uid, 20, 3600);
    $b = body();
    $name = sanitize((string)($b['name'] ?? ''), 100);
    $newPassword = (string)($b['new_password'] ?? '');
    if (!$name) json_error('Name is required.');
    if ($newPassword !== '') {
        if (strlen($newPassword) < 8) json_error('New password must be at least 8 characters.');
        if (strlen($newPassword) > 128) json_error('Password too long.');
        require_recent_password($uid, (string)($b['current_password'] ?? ''));
        db()->prepare("UPDATE users SET name = ?, password = ? WHERE id = ?")
            ->execute([$name, password_hash($newPassword, PASSWORD_BCRYPT, ['cost'=>12]), $uid]);
        $token = session_token();
        db()->prepare("DELETE FROM sessions WHERE user_id = ? AND id <> ?")->execute([$uid, $token]);
    } else {
        db()->prepare("UPDATE users SET name = ? WHERE id = ?")->execute([$name, $uid]);
    }
    json_ok(['id'=>$uid, 'name'=>$name, 'email'=>$user['email']]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') json_error('Method not allowed', 405);
rate_limit('account_delete_user', (string)$uid, 5, 3600);

$b = body();
require_recent_password($uid, (string)($b['password'] ?? ''));

// Foreign keys remove owned events, memberships, sessions, and the user's expenses.
// The transaction ensures the account is either completely removed or untouched.
$pdo = db();
$pdo->beginTransaction();
try {
    $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$uid]);
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    json_error('Account deletion failed. Please try again.', 500);
}
clear_session_cookie();
json_ok(['deleted' => true]);
