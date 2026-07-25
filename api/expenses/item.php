<?php
require_once __DIR__ . '/../config/auth.php';
$user = require_auth();
$uid  = (int) $user['user_id'];
$id   = (int) ($_GET['id'] ?? 0);
if (!$id) json_error('Expense ID required.');

$stmt = db()->prepare("SELECT * FROM expenses WHERE id = ? AND user_id = ? LIMIT 1");
$stmt->execute([$id, $uid]);
$exp = $stmt->fetch();
if (!$exp) json_error('Expense not found.', 404);

// ── PUT ───────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $b = body();
    $fields = []; $params = [];
    if (isset($b['description']) || isset($b['desc'])) {
        $fields[] = 'description = ?';
        $params[] = sanitize($b['description'] ?? $b['desc'], 255);
    }
    if (isset($b['amount']))    { $fields[] = 'amount = ?';       $params[] = max(0, (float)$b['amount']); }
    if (isset($b['date']) || isset($b['expense_date'])) {
        $fields[] = 'expense_date = ?';
        $params[] = $b['date'] ?? $b['expense_date'];
    }
    if (isset($b['cat_id']) || isset($b['catId']))       { $fields[] = 'cat_id = ?';    $params[] = sanitize($b['cat_id'] ?? $b['catId'], 64); }
    if (isset($b['cat_name']) || isset($b['catName']))   { $fields[] = 'cat_name = ?';  $params[] = sanitize($b['cat_name'] ?? $b['catName'], 100); }
    if (isset($b['cat_emoji']) || isset($b['catEmoji'])) { $fields[] = 'cat_emoji = ?'; $params[] = sanitize($b['cat_emoji'] ?? $b['catEmoji'], 8); }
    if (isset($b['paid_by']) || isset($b['paidBy']))     { $fields[] = 'paid_by = ?';   $params[] = sanitize($b['paid_by'] ?? $b['paidBy'], 20); }
    if (isset($b['tag']))   { $fields[] = 'tag = ?';   $params[] = sanitize($b['tag'], 20); }
    if (isset($b['phase'])) { $fields[] = 'phase = ?'; $params[] = sanitize($b['phase'], 50); }
    if (isset($b['notes'])) { $fields[] = 'notes = ?'; $params[] = sanitize($b['notes'], 1000); }
    if (empty($fields)) json_error('Nothing to update.');
    $params[] = $id; $params[] = $uid;
    db()->prepare("UPDATE expenses SET " . implode(', ', $fields) . " WHERE id = ? AND user_id = ?")->execute($params);
    json_ok(['updated' => true]);
}

// ── DELETE ────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    db()->prepare("DELETE FROM expenses WHERE id = ? AND user_id = ?")->execute([$id, $uid]);
    json_ok(['deleted' => true]);
}

json_error('Method not allowed', 405);
