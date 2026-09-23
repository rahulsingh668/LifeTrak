<?php
require_once __DIR__ . '/../config/auth.php';
$user    = require_auth();
$uid     = (int)$user['user_id'];
$eventId = (int)($_GET['event_id'] ?? 0);
if (!$eventId) json_error('Event ID is required.');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$owned = db()->prepare("SELECT id FROM events WHERE id = ? AND user_id = ? LIMIT 1");
$owned->execute([$eventId, $uid]);
if ($owned->fetch()) json_error('Owners cannot leave their event. Delete it or transfer ownership first.', 409);

$stmt = db()->prepare("DELETE FROM event_members WHERE event_id = ? AND user_id = ?");
$stmt->execute([$eventId, $uid]);
if ($stmt->rowCount() === 0) json_error('Event membership not found.', 404);
json_ok(['left' => true]);
