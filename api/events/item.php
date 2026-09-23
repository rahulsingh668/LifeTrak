<?php
require_once __DIR__ . '/../config/auth.php';
$user = require_auth();
$uid  = (int) $user['user_id'];
$id   = (int) ($_GET['id'] ?? 0);
if (!$id) json_error('Event ID required.');

// Access check (owner or shared member)
$role = event_role($id, $uid);
if (!$role) json_error('Event not found.', 404);
$stmt = db()->prepare("SELECT * FROM events WHERE id = ? LIMIT 1");
$stmt->execute([$id]);
$ev = $stmt->fetch();
if (!$ev) json_error('Event not found.', 404);

// ── GET ───────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $ev['id']         = (int) $ev['id'];
    $ev['budget']     = (float) $ev['budget'];
    $ev['phases']     = json_decode($ev['phases'] ?? '[]', true);
    $ev['categories'] = json_decode($ev['categories'], true);
    json_ok($ev);
}

// ── PUT ───────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    if (!can_edit($role)) json_error('Only owners and editors can update this event.', 403);
    $b = body();
    $fields = []; $params = [];
    if (isset($b['name']))       { $fields[] = 'name = ?';       $params[] = sanitize($b['name'], 100); }
    if (isset($b['emoji']))      { $fields[] = 'emoji = ?';      $params[] = sanitize($b['emoji'], 8); }
    if (isset($b['currency']))   { $fields[] = 'currency = ?';   $params[] = sanitize($b['currency'], 4); }
    if (isset($b['budget']))     { $fields[] = 'budget = ?';     $params[] = max(0, (float)$b['budget']); }
    if (isset($b['phases']))     { $fields[] = 'phases = ?';     $params[] = json_encode((array)$b['phases'], JSON_UNESCAPED_UNICODE); }
    if (isset($b['categories'])) { $fields[] = 'categories = ?'; $params[] = json_encode((array)$b['categories'], JSON_UNESCAPED_UNICODE); }
    if (empty($fields)) json_error('Nothing to update.');
    $params[] = $id;
    db()->prepare("UPDATE events SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
    json_ok(['updated' => true]);
}

// ── DELETE ────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    if ($role !== 'owner') json_error('Only the owner can delete this event.', 403);
    db()->prepare("DELETE FROM events WHERE id = ?")->execute([$id]);
    json_ok(['deleted' => true]);
}

json_error('Method not allowed', 405);
