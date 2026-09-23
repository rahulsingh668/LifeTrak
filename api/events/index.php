<?php
require_once __DIR__ . '/../config/auth.php';
$user = require_auth();
$uid  = (int) $user['user_id'];

// ── GET — list all events (owned + shared) ────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Own events + events shared with this user
    $rows = db()->prepare(
        "SELECT e.id, e.slug, e.name, e.emoji, e.currency, e.budget,
                e.phases, e.categories, e.user_id, e.created_at,
                COALESCE(em.role, 'owner') as my_role,
                u.name as owner_name
         FROM events e
         LEFT JOIN event_members em ON em.event_id=e.id AND em.user_id=?
         LEFT JOIN users u ON u.id=e.user_id
         WHERE e.user_id=? OR em.user_id=?
         ORDER BY e.created_at ASC"
    );
    $rows->execute([$uid, $uid, $uid]);
    $events = array_map(function($r) use ($uid) {
        $r['id']         = (int) $r['id'];
        $r['budget']     = (float) $r['budget'];
        $r['phases']     = json_decode($r['phases'] ?? '[]', true);
        $r['categories'] = json_decode($r['categories'], true);
        $r['is_owner']   = (int)$r['user_id'] === $uid;
        // Owner role always wins, even if a stray event_members row exists
        if ($r['is_owner']) $r['my_role'] = 'owner';
        return $r;
    }, $rows->fetchAll());

    // Get members for each event
    foreach ($events as &$ev) {
        $mStmt = db()->prepare(
            "SELECT u.id, u.name, u.email, em.role
             FROM event_members em JOIN users u ON u.id=em.user_id
             WHERE em.event_id=?"
        );
        $mStmt->execute([$ev['id']]);
        $ev['members'] = $mStmt->fetchAll();
    }

    json_ok($events);
}

// ── POST — create event ───────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b          = body();
    $name       = sanitize($b['name'] ?? '', 100);
    $emoji      = sanitize($b['emoji'] ?? '📋', 8);
    $currency   = sanitize($b['currency'] ?? '₹', 4);
    $budget     = max(0, (float)($b['budget'] ?? 0));
    $phases     = array_values(array_filter((array)($b['phases'] ?? [])));
    $categories = (array)($b['categories'] ?? []);
    if (!$name) json_error('Event name is required.');
    if (empty($categories)) json_error('At least one category is required.');
    $slug = 'custom_' . time();
    $stmt = db()->prepare(
        "INSERT INTO events (user_id,slug,name,emoji,currency,budget,phases,categories)
         VALUES (?,?,?,?,?,?,?,?)"
    );
    $stmt->execute([
        $uid, $slug, $name, $emoji, $currency, $budget,
        json_encode($phases, JSON_UNESCAPED_UNICODE),
        json_encode($categories, JSON_UNESCAPED_UNICODE),
    ]);
    $id = (int) db()->lastInsertId();
    json_ok(['id'=>$id,'slug'=>$slug,'name'=>$name,'emoji'=>$emoji,'currency'=>$currency,'budget'=>$budget,'phases'=>$phases,'categories'=>$categories,'my_role'=>'owner','members'=>[]], 201);
}

json_error('Method not allowed', 405);
