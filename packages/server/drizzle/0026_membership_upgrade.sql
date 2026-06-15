ALTER TABLE `users` ADD COLUMN `member_expires_at` timestamp NULL DEFAULT NULL AFTER `member_level`;
--> statement-breakpoint
CREATE TABLE `membership_change_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `from_level` tinyint NOT NULL DEFAULT 0,
  `to_level` tinyint NOT NULL DEFAULT 0,
  `source` varchar(32) NOT NULL,
  `remark` varchar(500) DEFAULT NULL,
  `order_id` int DEFAULT NULL,
  `operator_id` int DEFAULT NULL,
  `member_expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_membership_logs_user_id` (`user_id`),
  KEY `idx_membership_logs_created_at` (`created_at`),
  CONSTRAINT `membership_change_logs_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
