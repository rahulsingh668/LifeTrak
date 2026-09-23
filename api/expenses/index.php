<?php
require_once __DIR__ . '/../config/auth.php';
$user    = require_auth();
$uid     = (int) $user['user_id'];
$eventId = (int) ($_GET['event_id'] ?? 0);

// ── GET /api/expenses?event_id=N ─────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!$eventId) json_error('event_id is required.');
    $role = event_role($eventId, $uid);
    if (!$role) json_error('Event not found.', 404);

    // Shared events: return ALL expenses in the event, tagged with creator
    $rows = db()->prepare(
        "SELECT ex.id, ex.event_id, ex.user_id, ex.cat_id, ex.cat_name, ex.cat_emoji,
                ex.description, ex.amount, ex.orig_amount, ex.orig_currency,
                ex.exchange_rate,
                ex.expense_date AS `date`, ex.paid_by, ex.tag, ex.phase, ex.notes,
                ex.receipt_path, ex.created_at, u.name AS created_by_name
         FROM expenses ex LEFT JOIN users u ON u.id = ex.user_id
         WHERE ex.event_id = ?
         ORDER BY ex.expense_date DESC, ex.created_at DESC"
    );
    $rows->execute([$eventId]);
    $expenses = array_map(function($r) use ($uid) {
        $r['id']       = (int) $r['id'];
        $r['event_id'] = (int) $r['event_id'];
        $r['user_id']  = (int) $r['user_id'];
        $r['amount']   = (float) $r['amount'];
        $r['orig_amount'] = $r['orig_amount'] !== null ? (float)$r['orig_amount'] : null;
        $r['exchange_rate'] = $r['exchange_rate'] !== null ? (float)$r['exchange_rate'] : null;
        $r['is_mine']  = (int) $r['user_id'] === $uid;
        return $r;
    }, $rows->fetchAll());
    json_ok($expenses);
}

// ── POST /api/expenses ────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b = body();
    $eventId = (int)($b['event_id'] ?? 0);
    if (!$eventId) json_error('event_id is required.');

    $role = event_role($eventId, $uid);
    if (!$role)          json_error('Event not found.', 404);
    if (!can_edit($role)) json_error('Viewers cannot add expenses to this event.', 403);

    $desc   = sanitize($b['description'] ?? $b['desc'] ?? '', 255);
    $amountRaw = $b['amount'] ?? null;
    if (!is_numeric($amountRaw) || !is_finite((float)$amountRaw)) json_error('Enter a valid amount.');
    $amount = round((float)$amountRaw, 2);
    $date   = $b['date'] ?? $b['expense_date'] ?? '';
    $mutationId = trim((string)($b['client_mutation_id'] ?? ''));

    if (!$desc)                          json_error('Description is required.');
    if ($amount == 0.0)                  json_error('Amount cannot be zero. Use a negative amount for adjustments.');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) json_error('Invalid date format (YYYY-MM-DD).');
    if ($mutationId !== '' && !preg_match('/^[A-Za-z0-9_-]{16,64}$/', $mutationId)) {
        json_error('Invalid client mutation ID.');
    }

    // A retried offline create returns the original record instead of duplicating it.
    if ($mutationId !== '') {
        $existing = db()->prepare(
            "SELECT id, event_id, amount, expense_date AS `date` FROM expenses
             WHERE event_id = ? AND client_mutation_id = ? LIMIT 1"
        );
        $existing->execute([$eventId, $mutationId]);
        if ($row = $existing->fetch()) {
            $row['id'] = (int)$row['id'];
            $row['event_id'] = (int)$row['event_id'];
            $row['amount'] = (float)$row['amount'];
            $row['idempotent_replay'] = true;
            json_ok($row);
        }
    }

    if (isset($b['orig_amount']) && $b['orig_amount'] !== null && $b['orig_amount'] !== '' &&
        (!is_numeric($b['orig_amount']) || !is_finite((float)$b['orig_amount']))) json_error('Invalid original amount.');
    $origAmount = isset($b['orig_amount']) && $b['orig_amount'] !== null && $b['orig_amount'] !== ''
        ? round((float)$b['orig_amount'], 2) : null;
    $exchangeRate = isset($b['exchange_rate']) && $b['exchange_rate'] !== null && $b['exchange_rate'] !== ''
        ? (float)$b['exchange_rate'] : null;
    if ($exchangeRate !== null && (!is_finite($exchangeRate) || $exchangeRate <= 0)) json_error('Invalid exchange rate.');

    $stmt = db()->prepare(
        "INSERT INTO expenses
         (event_id, user_id, cat_id, cat_name, cat_emoji, description, amount,
          orig_amount, orig_currency, exchange_rate, expense_date, paid_by, tag, phase, notes,
          client_mutation_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    try {
        $stmt->execute([
            $eventId, $uid,
            sanitize($b['cat_id']    ?? $b['catId'] ?? 'misc', 64),
            sanitize($b['cat_name']  ?? $b['catName'] ?? '', 100),
            sanitize($b['cat_emoji'] ?? $b['catEmoji'] ?? '📦', 8),
            $desc, $amount,
            $origAmount,
            isset($b['orig_currency']) && $b['orig_currency'] !== null ? sanitize((string)$b['orig_currency'], 4) : null,
            $exchangeRate,
            $date,
            sanitize($b['paid_by']   ?? $b['paidBy'] ?? 'Me', 20),
            sanitize($b['tag'] ?? '', 20),
            sanitize($b['phase'] ?? '', 50),
            sanitize($b['notes'] ?? '', 1000),
            $mutationId !== '' ? $mutationId : null,
        ]);
    } catch (PDOException $e) {
        // Two simultaneous retries may both pass the read above. The unique
        // key is authoritative; return the winning row on that race.
        if ($mutationId !== '' && $e->getCode() === '23000') {
            $existing = db()->prepare("SELECT id, event_id, amount, expense_date AS `date` FROM expenses WHERE event_id=? AND client_mutation_id=? LIMIT 1");
            $existing->execute([$eventId, $mutationId]);
            if ($row = $existing->fetch()) {
                $row['id']=(int)$row['id']; $row['event_id']=(int)$row['event_id']; $row['amount']=(float)$row['amount'];
                $row['idempotent_replay']=true; json_ok($row);
            }
        }
        throw $e;
    }
    $newId = (int) db()->lastInsertId();
    json_ok(['id' => $newId, 'event_id' => $eventId, 'amount' => $amount, 'date' => $date], 201);
}

json_error('Method not allowed', 405);
