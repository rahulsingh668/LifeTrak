<?php
require_once __DIR__ . '/../config/auth.php';
$user = require_auth();
$uid  = (int) $user['user_id'];
$id   = (int) ($_GET['id'] ?? 0);
if (!$id) json_error('Expense ID required.');

$stmt = db()->prepare("SELECT * FROM expenses WHERE id = ? LIMIT 1");
$stmt->execute([$id]);
$exp = $stmt->fetch();
if (!$exp) json_error('Expense not found.', 404);

// Shared events: any owner/editor of the event may modify expenses in it
$role = event_role((int)$exp['event_id'], $uid);
if (!$role)           json_error('Expense not found.', 404);
if (!can_edit($role)) json_error('Viewers cannot modify expenses.', 403);

// ── PUT ───────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $b = body();
    $fields = []; $params = [];
    if (isset($b['description']) || isset($b['desc'])) {
        $fields[] = 'description = ?';
        $params[] = sanitize($b['description'] ?? $b['desc'], 255);
    }
    if (isset($b['amount']))    {
        if (!is_numeric($b['amount']) || !is_finite((float)$b['amount'])) json_error('Enter a valid amount.');
        $amt = round((float)$b['amount'], 2);
        if ($amt == 0.0) json_error('Amount cannot be zero.');
        $fields[] = 'amount = ?'; $params[] = $amt;
    }
    if (isset($b['date']) || isset($b['expense_date'])) {
        $newDate = $b['date'] ?? $b['expense_date'];
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $newDate)) json_error('Invalid date format (YYYY-MM-DD).');
        $fields[] = 'expense_date = ?';
        $params[] = $newDate;
    }
    if (isset($b['cat_id']) || isset($b['catId']))       { $fields[] = 'cat_id = ?';    $params[] = sanitize($b['cat_id'] ?? $b['catId'], 64); }
    if (isset($b['cat_name']) || isset($b['catName']))   { $fields[] = 'cat_name = ?';  $params[] = sanitize($b['cat_name'] ?? $b['catName'], 100); }
    if (isset($b['cat_emoji']) || isset($b['catEmoji'])) { $fields[] = 'cat_emoji = ?'; $params[] = sanitize($b['cat_emoji'] ?? $b['catEmoji'], 8); }
    if (isset($b['paid_by']) || isset($b['paidBy']))     { $fields[] = 'paid_by = ?';   $params[] = sanitize($b['paid_by'] ?? $b['paidBy'], 20); }
    if (isset($b['tag']))   { $fields[] = 'tag = ?';   $params[] = sanitize($b['tag'], 20); }
    if (isset($b['phase'])) { $fields[] = 'phase = ?'; $params[] = sanitize($b['phase'], 50); }
    if (isset($b['notes'])) { $fields[] = 'notes = ?'; $params[] = sanitize($b['notes'], 1000); }
    if (array_key_exists('orig_amount', $b)) {
        if ($b['orig_amount'] !== null && $b['orig_amount'] !== '' &&
            (!is_numeric($b['orig_amount']) || !is_finite((float)$b['orig_amount']))) json_error('Invalid original amount.');
        $fields[] = 'orig_amount = ?';
        $params[] = $b['orig_amount'] === null || $b['orig_amount'] === '' ? null : round((float)$b['orig_amount'], 2);
    }
    if (array_key_exists('orig_currency', $b)) {
        $fields[] = 'orig_currency = ?';
        $params[] = $b['orig_currency'] === null || $b['orig_currency'] === '' ? null : sanitize((string)$b['orig_currency'], 4);
    }
    if (array_key_exists('exchange_rate', $b)) {
        $rate = $b['exchange_rate'] === null || $b['exchange_rate'] === '' ? null : (float)$b['exchange_rate'];
        if ($rate !== null && (!is_finite($rate) || $rate <= 0)) json_error('Invalid exchange rate.');
        $fields[] = 'exchange_rate = ?'; $params[] = $rate;
    }
    if (empty($fields)) json_error('Nothing to update.');
    $params[] = $id;
    db()->prepare("UPDATE expenses SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
    json_ok(['updated' => true]);
}

// ── DELETE ────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    db()->prepare("DELETE FROM expenses WHERE id = ?")->execute([$id]);
    json_ok(['deleted' => true]);
}

json_error('Method not allowed', 405);
