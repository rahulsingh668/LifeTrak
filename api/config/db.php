<?php
define('DB_HOST', 'localhost');
define('DB_NAME', 'u983506717_lifetrak');
define('DB_USER', 'u983506717_lifetrakadmin');
define('DB_PASS', 'TravTrak@2026');
define('APP_SECRET', 'lifetrak-tara-rahul-2026-x9k2m7p4q1n8r3s5');
define('APP_ENV', 'production');

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    try {
        $pdo = new PDO(
            "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
            DB_USER, DB_PASS,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        exit;
    }
    return $pdo;
}
