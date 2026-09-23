<?php
require_once __DIR__ . '/../config/auth.php';
$user     = require_auth();
$uid      = (int)$user['user_id'];
$eventId  = (int)($_GET['event_id'] ?? 0);
$memberId = (int)($_GET['member_id'] ?? 0);
if (!$eventId || !$memberId) json_error('Event and member IDs are required.');

$owner = db()->prepare("SELECT id FROM events WHERE id = ? AND user_id = ? LIMIT 1");
$owner->execute([$eventId, $uid]);
if (!$owner->fetch()) json_error('Only the event owner can manage members.', 403);

$member = db()->prepare("SELECT id FROM event_members WHERE event_id = ? AND user_id = ? LIMIT 1");
$member->execute([$eventId, $memberId]);
if (!$member->fetch()) json_error('Member not found.', 404);

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    rate_limit('member_update_user', (string)$uid, 60, 3600);
    $b = body();
    $role = $b['role'] ?? '';
    if (!in_array($role, ['editor', 'viewer'], true)) json_error('Role must be editor or viewer.');
    db()->prepare("UPDATE event_members SET role = ? WHERE event_id = ? AND user_id = ?")
        ->execute([$role, $eventId, $memberId]);
    json_ok(['updated' => true, 'role' => $role]);
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    rate_limit('member_remove_user', (string)$uid, 30, 3600);
    db()->prepare("DELETE FROM event_members WHERE event_id = ? AND user_id = ?")
        ->execute([$eventId, $memberId]);
    json_ok(['removed' => true]);
}

json_error('Method not allowed', 405);
