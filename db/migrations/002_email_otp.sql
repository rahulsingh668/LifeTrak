-- Email OTP verification — run once in phpMyAdmin
ALTER TABLE `users`
  ADD COLUMN `email_verified` TINYINT(1) NOT NULL DEFAULT 0 AFTER `password`,
  ADD COLUMN `otp_hash`       VARCHAR(255) NULL DEFAULT NULL,
  ADD COLUMN `otp_expires`    DATETIME NULL DEFAULT NULL,
  ADD COLUMN `otp_attempts`   TINYINT NOT NULL DEFAULT 0,
  ADD COLUMN `otp_last_sent`  DATETIME NULL DEFAULT NULL;

-- Grandfather every existing account (you, Tara, current members)
UPDATE `users` SET `email_verified` = 1;
