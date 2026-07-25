<?php
require_once __DIR__ . '/../config/auth.php';
$user = require_auth();
$uid  = (int) $user['user_id'];
$id   = (int) ($_GET['id'] ?? 0);
if (!$id) json_error('Event ID required.');

// Ownership check
$stmt = db()->prepare("SELECT * FROM events WHERE id = ? AND user_id = ? LIMIT 1");
$stmt->execute([$id, $uid]);
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
    $b = body();
    $fields = []; $params = [];
    if (isset($b['name']))       { $fields[] = 'name = ?';       $params[] = sanitize($b['name'], 100); }
    if (isset($b['emoji']))      { $fields[] = 'emoji = ?';      $params[] = sanitize($b['emoji'], 8); }
    if (isset($b['currency']))   { $fields[] = 'currency = ?';   $params[] = sanitize($b['currency'], 4); }
    if (isset($b['budget']))     { $fields[] = 'budget = ?';     $params[] = max(0, (float)$b['budget']); }
    if (isset($b['phases']))     { $fields[] = 'phases = ?';     $params[] = json_encode((array)$b['phases'], JSON_UNESCAPED_UNICODE); }
    if (isset($b['categories'])) { $fields[] = 'categories = ?'; $params[] = json_encode((array)$b['categories'], JSON_UNESCAPED_UNICODE); }
    if (empty($fields)) json_error('Nothing to update.');
    $params[] = $id; $params[] = $uid;
    db()->prepare("UPDATE events SET " . implode(', ', $fields) . " WHERE id = ? AND user_id = ?")->execute($params);
    json_ok(['updated' => true]);
}

// ── DELETE ────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    db()->prepare("DELETE FROM events WHERE id = ? AND user_id = ?")->execute([$id, $uid]);
    json_ok(['deleted' => true]);
}

json_error('Method not allowed', 405);
