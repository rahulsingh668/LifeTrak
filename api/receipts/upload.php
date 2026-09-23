<?php
require_once __DIR__ . '/../config/auth.php';
$user = require_auth();
$uid  = (int) $user['user_id'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$expId = (int) ($_POST['expense_id'] ?? 0);
if (!$expId) json_error('expense_id required.');

// Match expense editing semantics: event owners/editors may attach a receipt
// to any expense in the shared event; viewers and outsiders may not.
$stmt = db()->prepare("SELECT id, event_id FROM expenses WHERE id = ? LIMIT 1");
$stmt->execute([$expId]);
$expense = $stmt->fetch();
if (!$expense) json_error('Expense not found.', 404);
$role = event_role((int)$expense['event_id'], $uid);
if (!$role) json_error('Expense not found.', 404);
if (!can_edit($role)) json_error('Viewers cannot modify expenses.', 403);

// Validate file
if (empty($_FILES['receipt']) || $_FILES['receipt']['error'] !== UPLOAD_ERR_OK) {
    json_error('No file uploaded or upload error.');
}

$file     = $_FILES['receipt'];
$maxSize  = 5 * 1024 * 1024; // 5MB
$allowed  = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
$finfo    = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($file['tmp_name']);

if ($file['size'] > $maxSize) json_error('File too large. Max 5MB.');
if (!in_array($mimeType, $allowed, true)) json_error('Only JPEG, PNG, WebP or HEIC allowed.');

// Save file
$ext      = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg';
$filename = 'receipt_' . $uid . '_' . $expId . '_' . time() . '.' . strtolower($ext);
$dir      = __DIR__ . '/../../uploads/receipts/';
$path     = $dir . $filename;
$webPath  = '/uploads/receipts/' . $filename;

if (!is_dir($dir)) mkdir($dir, 0755, true);
if (!move_uploaded_file($file['tmp_name'], $path)) json_error('Failed to save file.');

// Update expense record
db()->prepare("UPDATE expenses SET receipt_path = ? WHERE id = ?")
   ->execute([$webPath, $expId]);

json_ok(['receipt_path' => $webPath]);
