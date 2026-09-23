-- LifeTrak v3 reliability/security migration.
-- Safe to re-run after 002_email_otp.sql on an existing installation.

SET @add_mutation_column = (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='expenses' AND COLUMN_NAME='client_mutation_id'),
    'SELECT 1',
    'ALTER TABLE `expenses` ADD COLUMN `client_mutation_id` VARCHAR(64) NULL COMMENT ''Client-generated idempotency key for creates'' AFTER `receipt_path`'
  )
);
PREPARE stmt FROM @add_mutation_column; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_mutation_index = (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='expenses' AND INDEX_NAME='uq_expense_mutation'),
    'SELECT 1',
    'ALTER TABLE `expenses` ADD UNIQUE KEY `uq_expense_mutation` (`event_id`, `client_mutation_id`)'
  )
);
PREPARE stmt FROM @add_mutation_index; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `rate_limits` (
  `action`       VARCHAR(64)  NOT NULL,
  `subject_hash` CHAR(64)     NOT NULL,
  `window_start` INT UNSIGNED NOT NULL,
  `hits`         INT UNSIGNED NOT NULL DEFAULT 1,
  `updated_at`   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`action`, `subject_hash`, `window_start`),
  INDEX `idx_rate_limit_cleanup` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
