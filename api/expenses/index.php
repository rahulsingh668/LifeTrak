<?php
require_once __DIR__ . '/../config/auth.php';
$user    = require_auth();
$uid     = (int) $user['user_id'];
$eventId = (int) ($_GET['event_id'] ?? 0);

// Verify event ownership
if ($eventId) {
    $chk = db()->prepare("SELECT id FROM events WHERE id = ? AND user_id = ? LIMIT 1");
    $chk->execute([$eventId, $uid]);
    if (!$chk->fetch()) json_error('Event not found.', 404);
}

// ── GET /api/expenses?event_id=N ─────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!$eventId) json_error('event_id is required.');
    $rows = db()->prepare(
        "SELECT id, event_id, cat_id, cat_name, cat_emoji, description,
                amount, expense_date AS `date`, paid_by, tag, phase, notes, created_at
         FROM expenses WHERE event_id = ? AND user_id = ?
         ORDER BY expense_date DESC, created_at DESC"
    );
    $rows->execute([$eventId, $uid]);
    $expenses = array_map(function($r) {
        $r['id']       = (int) $r['id'];
        $r['event_id'] = (int) $r['event_id'];
        $r['amount']   = (float) $r['amount'];
        return $r;
    }, $rows->fetchAll());
    json_ok($expenses);
}

// ── POST /api/expenses ────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b = body();
    $eventId = (int)($b['event_id'] ?? 0);
    if (!$eventId) json_error('event_id is required.');

    // Re-verify ownership
    $chk = db()->prepare("SELECT id FROM events WHERE id = ? AND user_id = ? LIMIT 1");
    $chk->execute([$eventId, $uid]);
    if (!$chk->fetch()) json_error('Event not found.', 404);

    $desc   = sanitize($b['description'] ?? $b['desc'] ?? '', 255);
    $amount = (float)($b['amount'] ?? 0);
    $date   = $b['date'] ?? $b['expense_date'] ?? '';

    if (!$desc)                          json_error('Description is required.');
    if ($amount <= 0)                    json_error('Amount must be greater than 0.');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) json_error('Invalid date format (YYYY-MM-DD).');

    $stmt = db()->prepare(
        "INSERT INTO expenses
         (event_id, user_id, cat_id, cat_name, cat_emoji, description, amount, expense_date, paid_by, tag, phase, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $eventId, $uid,
        sanitize($b['cat_id']    ?? $b['catId'] ?? 'misc', 64),
        sanitize($b['cat_name']  ?? $b['catName'] ?? '', 100),
        sanitize($b['cat_emoji'] ?? $b['catEmoji'] ?? '📦', 8),
        $desc, $amount, $date,
        sanitize($b['paid_by']   ?? $b['paidBy'] ?? 'Me', 20),
        sanitize($b['tag'] ?? '', 20),
        sanitize($b['phase'] ?? '', 50),
        sanitize($b['notes'] ?? '', 1000),
    ]);
    $newId = (int) db()->lastInsertId();
    json_ok(['id' => $newId, 'event_id' => $eventId, 'amount' => $amount, 'date' => $date], 201);
}

json_error('Method not allowed', 405);
