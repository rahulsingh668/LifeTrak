-- LifeTrak Database Schema v1.0.0
-- Run once on Hostinger MySQL via phpMyAdmin or CLI

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `users` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`       VARCHAR(100)  NOT NULL,
  `email`      VARCHAR(255)  NOT NULL UNIQUE,
  `password`   VARCHAR(255)  NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `events` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id`     INT UNSIGNED  NOT NULL,
  `slug`        VARCHAR(64)   NOT NULL,
  `name`        VARCHAR(100)  NOT NULL,
  `emoji`       VARCHAR(8)    NOT NULL DEFAULT '📋',
  `currency`    VARCHAR(4)    NOT NULL DEFAULT '₹',
  `budget`      DECIMAL(14,2) NOT NULL DEFAULT 0,
  `phases`      JSON          NULL,
  `categories`  JSON          NOT NULL,
  `created_at`  DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `expenses` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `event_id`     INT UNSIGNED  NOT NULL,
  `user_id`      INT UNSIGNED  NOT NULL,
  `cat_id`       VARCHAR(64)   NOT NULL,
  `cat_name`     VARCHAR(100)  NOT NULL,
  `cat_emoji`    VARCHAR(8)    NOT NULL DEFAULT '📦',
  `description`  VARCHAR(255)  NOT NULL,
  `amount`       DECIMAL(14,2) NOT NULL,
  `expense_date` DATE          NOT NULL,
  `paid_by`      VARCHAR(20)   NOT NULL DEFAULT 'Me',
  `tag`          VARCHAR(20)   NOT NULL DEFAULT '',
  `phase`        VARCHAR(50)   NOT NULL DEFAULT '',
  `notes`        TEXT          NOT NULL DEFAULT '',
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`)  REFERENCES `users`(`id`)  ON DELETE CASCADE,
  INDEX `idx_event_id`     (`event_id`),
  INDEX `idx_expense_date` (`expense_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sessions` (
  `id`         VARCHAR(128)  NOT NULL PRIMARY KEY,
  `user_id`    INT UNSIGNED  NOT NULL,
  `expires_at` DATETIME      NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
