-- LifeTrak DB Schema v3.0.0
-- Canonical schema for a fresh installation.
-- Existing installations should run migrations/003_reliability_security.sql.

SET NAMES utf8mb4;

-- ── Users (unchanged) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`           VARCHAR(100)  NOT NULL,
  `email`          VARCHAR(255)  NOT NULL UNIQUE,
  `password`       VARCHAR(255)  NOT NULL,
  `email_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `otp_hash`       VARCHAR(255) NULL DEFAULT NULL,
  `otp_expires`    DATETIME NULL DEFAULT NULL,
  `otp_attempts`   TINYINT NOT NULL DEFAULT 0,
  `otp_last_sent`  DATETIME NULL DEFAULT NULL,
  `created_at`     DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Events (add base_currency) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS `events` (
  `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id`       INT UNSIGNED  NOT NULL,
  `slug`          VARCHAR(64)   NOT NULL,
  `name`          VARCHAR(100)  NOT NULL,
  `emoji`         VARCHAR(8)    NOT NULL DEFAULT '📋',
  `currency`      VARCHAR(4)    NOT NULL DEFAULT '₹',
  `budget`        DECIMAL(14,2) NOT NULL DEFAULT 0,
  `phases`        JSON          NULL,
  `categories`    JSON          NOT NULL,
  `created_at`    DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Event members (shared events) ────────────────────────────────
CREATE TABLE IF NOT EXISTS `event_members` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `event_id`   INT UNSIGNED  NOT NULL,
  `user_id`    INT UNSIGNED  NOT NULL,
  `role`       ENUM('owner','editor','viewer') NOT NULL DEFAULT 'editor',
  `invited_by` INT UNSIGNED  NULL,
  `joined_at`  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_event_user` (`event_id`, `user_id`),
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`)  REFERENCES `users`(`id`)  ON DELETE CASCADE,
  INDEX `idx_event_id` (`event_id`),
  INDEX `idx_user_id`  (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Event invites ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `event_invites` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `event_id`   INT UNSIGNED  NOT NULL,
  `invited_by` INT UNSIGNED  NOT NULL,
  `email`      VARCHAR(255)  NOT NULL,
  `token`      VARCHAR(64)   NOT NULL UNIQUE,
  `role`       ENUM('editor','viewer') NOT NULL DEFAULT 'editor',
  `accepted`   TINYINT(1)    NOT NULL DEFAULT 0,
  `expires_at` DATETIME      NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`event_id`)   REFERENCES `events`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Expenses (add original currency fields) ───────────────────────
CREATE TABLE IF NOT EXISTS `expenses` (
  `id`              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `event_id`        INT UNSIGNED  NOT NULL,
  `user_id`         INT UNSIGNED  NOT NULL,
  `cat_id`          VARCHAR(64)   NOT NULL,
  `cat_name`        VARCHAR(100)  NOT NULL,
  `cat_emoji`       VARCHAR(8)    NOT NULL DEFAULT '📦',
  `description`     VARCHAR(255)  NOT NULL,
  `amount`          DECIMAL(14,2) NOT NULL,
  `orig_amount`     DECIMAL(14,2) NULL COMMENT 'Amount in original currency before conversion',
  `orig_currency`   VARCHAR(4)    NULL COMMENT 'Original currency code if different from event currency',
  `exchange_rate`   DECIMAL(14,6) NULL COMMENT 'Rate used for conversion',
  `expense_date`    DATE          NOT NULL,
  `paid_by`         VARCHAR(50)   NOT NULL DEFAULT 'Me',
  `tag`             VARCHAR(20)   NOT NULL DEFAULT '',
  `phase`           VARCHAR(50)   NOT NULL DEFAULT '',
  `notes`           TEXT          NOT NULL DEFAULT '',
  `receipt_path`    VARCHAR(500)  NULL COMMENT 'Path to uploaded receipt image',
  `client_mutation_id` VARCHAR(64) NULL COMMENT 'Client-generated idempotency key for creates',
  `created_at`      DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`)  REFERENCES `users`(`id`)  ON DELETE CASCADE,
  INDEX `idx_event_id`  (`event_id`),
  INDEX `idx_expense_date` (`expense_date`),
  UNIQUE KEY `uq_expense_mutation` (`event_id`, `client_mutation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Sessions (unchanged) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `sessions` (
  `id`         VARCHAR(128)  NOT NULL PRIMARY KEY,
  `user_id`    INT UNSIGNED  NOT NULL,
  `expires_at` DATETIME      NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Database-backed request throttling ───────────────────────────
CREATE TABLE IF NOT EXISTS `rate_limits` (
  `action`       VARCHAR(64)  NOT NULL,
  `subject_hash` CHAR(64)     NOT NULL,
  `window_start` INT UNSIGNED NOT NULL,
  `hits`         INT UNSIGNED NOT NULL DEFAULT 1,
  `updated_at`   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`action`, `subject_hash`, `window_start`),
  INDEX `idx_rate_limit_cleanup` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
