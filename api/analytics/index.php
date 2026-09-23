<?php
require_once __DIR__ . '/../config/auth.php';
$user    = require_auth();
$uid     = (int) $user['user_id'];
$eventId = (int) ($_GET['event_id'] ?? 0);
if (!$eventId) json_error('event_id required.');

// Verify access
$stmt = db()->prepare(
    "SELECT e.id FROM events e
     LEFT JOIN event_members em ON em.event_id=e.id AND em.user_id=?
     WHERE e.id=? AND (e.user_id=? OR em.user_id=?) LIMIT 1"
);
$stmt->execute([$uid, $eventId, $uid, $uid]);
if (!$stmt->fetch()) json_error('Event not found.', 404);

// ── Category breakdown ────────────────────────────────────────────
$catRows = db()->prepare(
    "SELECT cat_id, cat_name, cat_emoji, SUM(amount) as total, COUNT(*) as count
     FROM expenses WHERE event_id=? GROUP BY cat_id, cat_name, cat_emoji ORDER BY total DESC"
);
$catRows->execute([$eventId]);
$byCategory = $catRows->fetchAll();

// ── Monthly trend ─────────────────────────────────────────────────
$monthly = db()->prepare(
    "SELECT DATE_FORMAT(expense_date,'%Y-%m') as month, SUM(amount) as total, COUNT(*) as count
     FROM expenses WHERE event_id=? GROUP BY month ORDER BY month ASC"
);
$monthly->execute([$eventId]);
$byMonth = $monthly->fetchAll();

// ── Day of week ───────────────────────────────────────────────────
$dow = db()->prepare(
    "SELECT DAYOFWEEK(expense_date) as dow, SUM(amount) as total, COUNT(*) as count
     FROM expenses WHERE event_id=? GROUP BY dow ORDER BY dow ASC"
);
$dow->execute([$eventId]);
$byDow = $dow->fetchAll();

// ── Top expenses ──────────────────────────────────────────────────
$top = db()->prepare(
    "SELECT id, description, amount, cat_name, cat_emoji, expense_date, paid_by
     FROM expenses WHERE event_id=? ORDER BY amount DESC LIMIT 5"
);
$top->execute([$eventId]);
$topExpenses = $top->fetchAll();

// ── Paid by breakdown ─────────────────────────────────────────────
$paidBy = db()->prepare(
    "SELECT paid_by, SUM(amount) as total, COUNT(*) as count
     FROM expenses WHERE event_id=? GROUP BY paid_by ORDER BY total DESC"
);
$paidBy->execute([$eventId]);
$byPaidBy = $paidBy->fetchAll();

// ── Summary ───────────────────────────────────────────────────────
$summary = db()->prepare(
    "SELECT SUM(amount) as total, COUNT(*) as count, AVG(amount) as avg,
            MAX(amount) as max, MIN(amount) as min, MIN(expense_date) as first_date
     FROM expenses WHERE event_id=?"
);
$summary->execute([$eventId]);
$stats = $summary->fetch();

json_ok([
    'summary'     => $stats,
    'by_category' => $byCategory,
    'by_month'    => $byMonth,
    'by_dow'      => $byDow,
    'top_expenses'=> $topExpenses,
    'by_paid_by'  => $byPaidBy,
]);
