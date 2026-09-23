<?php
require_once __DIR__ . '/../config/auth.php';
require_admin();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

// ── Headline totals ──────────────────────────────────────────────
$totals = db()->query(
    "SELECT
       (SELECT COUNT(*) FROM users)                          AS users,
       (SELECT COUNT(*) FROM users WHERE email_verified = 1) AS verified,
       (SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS new_7d,
       (SELECT COUNT(*) FROM events)                         AS events,
       (SELECT COUNT(*) FROM expenses)                       AS expenses,
       (SELECT COUNT(DISTINCT em.user_id) FROM event_members em) AS shared_users"
)->fetch();

// ── Per-user breakdown ───────────────────────────────────────────
$rows = db()->query(
    "SELECT u.id, u.name, u.email, u.email_verified, u.created_at,
            COUNT(DISTINCT e.id)  AS events_created,
            COUNT(DISTINCT ex.id) AS expenses_logged,
            MAX(ex.created_at)    AS last_activity
     FROM users u
     LEFT JOIN events e   ON e.user_id  = u.id
     LEFT JOIN expenses ex ON ex.user_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at DESC"
)->fetchAll();

$users = array_map(function($r) {
    return [
        'id'              => (int)$r['id'],
        'name'            => $r['name'],
        'email'           => $r['email'],
        'verified'        => (bool)(int)$r['email_verified'],
        'joined'          => $r['created_at'],
        'events_created'  => (int)$r['events_created'],
        'expenses_logged' => (int)$r['expenses_logged'],
        'last_activity'   => $r['last_activity'],
    ];
}, $rows);

json_ok([
    'totals' => [
        'users'        => (int)$totals['users'],
        'verified'     => (int)$totals['verified'],
        'new_7d'       => (int)$totals['new_7d'],
        'events'       => (int)$totals['events'],
        'expenses'     => (int)$totals['expenses'],
        'shared_users' => (int)$totals['shared_users'],
    ],
    'users' => $users,
]);
