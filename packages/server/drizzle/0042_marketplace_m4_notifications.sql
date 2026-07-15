-- M4 · 发单接单站内通知（匹配推送；G3 统一收件箱前的简化表）
CREATE TABLE `marketplace_notification` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `type` varchar(32) NOT NULL,
  `ref_type` varchar(32) NOT NULL,
  `ref_id` int NOT NULL,
  `message_key` varchar(128) NOT NULL,
  `payload` json NULL,
  `read_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_marketplace_notification_user` (`user_id`),
  KEY `idx_marketplace_notification_user_read` (`user_id`, `read_at`),
  KEY `idx_marketplace_notification_ref` (`ref_type`, `ref_id`),
  CONSTRAINT `marketplace_notification_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
