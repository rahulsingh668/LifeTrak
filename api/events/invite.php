<?php
require_once __DIR__ . '/../config/auth.php';
$user = require_auth();
$uid  = (int) $user['user_id'];

$method = $_SERVER['REQUEST_METHOD'];

// POST /api/events/invite — send invite
if ($method === 'POST') {
    rate_limit('invite_user', (string)$uid, 20, 3600);
    $b       = body();
    $eventId = (int)($b['event_id'] ?? 0);
    $email   = strtolower(trim($b['email'] ?? ''));
    $role    = in_array($b['role'] ?? '', ['editor','viewer']) ? $b['role'] : 'editor';

    if (!$eventId || !$email) json_error('event_id and email required.');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_error('Invalid email.');

    // Verify owner
    $stmt = db()->prepare("SELECT id, name FROM events WHERE id = ? AND user_id = ? LIMIT 1");
    $stmt->execute([$eventId, $uid]);
    $ev = $stmt->fetch();
    if (!$ev) json_error('Event not found or you are not the owner.', 403);

    // Check if already a member
    $stmt = db()->prepare("SELECT u.id FROM users u JOIN event_members em ON em.user_id=u.id WHERE em.event_id=? AND u.email=? LIMIT 1");
    $stmt->execute([$eventId, $email]);
    if ($stmt->fetch()) json_error('This person is already a member of this event.');

    // Create/replace invite token
    $token   = bin2hex(random_bytes(24));
    $expires = date('Y-m-d H:i:s', strtotime('+7 days'));
    db()->prepare("DELETE FROM event_invites WHERE event_id=? AND email=?")->execute([$eventId, $email]);
    db()->prepare("INSERT INTO event_invites (event_id,invited_by,email,token,role,expires_at) VALUES (?,?,?,?,?,?)")
        ->execute([$eventId, $uid, $email, $token, $role, $expires]);

    // In production: send email with invite link
    // For now return the invite link directly
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? 'lifetrak.app';
    $inviteUrl = $scheme . '://' . $host . '/app?invite=' . $token;
    json_ok(['invite_url' => $inviteUrl, 'expires_at' => $expires]);
}

// GET /api/events/invite?token=xxx — accept invite
if ($method === 'GET') {
    $token = trim($_GET['token'] ?? '');
    if (!$token) json_error('Token required.');

    $stmt = db()->prepare(
        "SELECT ei.*, e.name as event_name FROM event_invites ei
         JOIN events e ON e.id=ei.event_id
         WHERE ei.token=? AND ei.accepted=0 AND ei.expires_at > NOW() LIMIT 1"
    );
    $stmt->execute([$token]);
    $invite = $stmt->fetch();
    if (!$invite) json_error('Invalid or expired invite link.', 404);

    // Owner clicking their own invite link must not demote themselves to editor
    $own = db()->prepare("SELECT id FROM events WHERE id = ? AND user_id = ? LIMIT 1");
    $own->execute([$invite['event_id'], $uid]);
    if ($own->fetch()) {
        json_ok(['event_id' => (int)$invite['event_id'], 'event_name' => $invite['event_name'], 'role' => 'owner', 'already_owner' => true]);
    }

    // Invitations are addressed to a specific verified account. Forwarded or
    // leaked links must not grant access to another signed-in user.
    if (strtolower($user['email']) !== strtolower($invite['email'])) {
        json_error('This invitation was sent to a different email address.', 403);
    }

    // Add member
    db()->prepare("INSERT IGNORE INTO event_members (event_id,user_id,role,invited_by) VALUES (?,?,?,?)")
        ->execute([$invite['event_id'], $uid, $invite['role'], $invite['invited_by']]);
    db()->prepare("UPDATE event_invites SET accepted=1 WHERE token=?")->execute([$token]);

    json_ok(['event_id' => (int)$invite['event_id'], 'event_name' => $invite['event_name'], 'role' => $invite['role']]);
}

json_error('Method not allowed', 405);
