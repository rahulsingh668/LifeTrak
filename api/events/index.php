<?php
require_once __DIR__ . '/../config/auth.php';
$user = require_auth();
$uid  = (int) $user['user_id'];

// ── GET /api/events ───────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = db()->prepare(
        "SELECT id, slug, name, emoji, currency, budget, phases, categories, created_at
         FROM events WHERE user_id = ? ORDER BY created_at ASC"
    );
    $rows->execute([$uid]);
    $events = array_map(function($r) {
        $r['id']         = (int) $r['id'];
        $r['budget']     = (float) $r['budget'];
        $r['phases']     = json_decode($r['phases'] ?? '[]', true);
        $r['categories'] = json_decode($r['categories'], true);
        return $r;
    }, $rows->fetchAll());
    json_ok($events);
}

// ── POST /api/events ──────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b = body();
    $name  = sanitize($b['name'] ?? '', 100);
    $emoji = sanitize($b['emoji'] ?? '📋', 8);
    $currency   = sanitize($b['currency'] ?? '₹', 4);
    $budget     = max(0, (float)($b['budget'] ?? 0));
    $phases     = array_map('strval', array_values(array_filter((array)($b['phases'] ?? []))));
    $categories = (array)($b['categories'] ?? []);

    if (!$name) json_error('Event name is required.');
    if (empty($categories)) json_error('At least one category is required.');

    $slug = 'custom_' . time();
    $stmt = db()->prepare(
        "INSERT INTO events (user_id, slug, name, emoji, currency, budget, phases, categories)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $uid, $slug, $name, $emoji, $currency, $budget,
        json_encode($phases, JSON_UNESCAPED_UNICODE),
        json_encode($categories, JSON_UNESCAPED_UNICODE),
    ]);
    $id = (int) db()->lastInsertId();

    json_ok([
        'id' => $id, 'slug' => $slug, 'name' => $name, 'emoji' => $emoji,
        'currency' => $currency, 'budget' => $budget,
        'phases' => $phases, 'categories' => $categories,
    ], 201);
}

json_error('Method not allowed', 405);
