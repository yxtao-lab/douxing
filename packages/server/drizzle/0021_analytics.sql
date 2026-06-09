CREATE TABLE `analytics_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `event_name` varchar(64) NOT NULL,
  `event_category` varchar(32) NOT NULL DEFAULT 'business',
  `user_id` int NULL,
  `session_id` varchar(64) NULL,
  `properties` json NULL,
  `source` varchar(16) NOT NULL DEFAULT 'server',
  `occurred_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_analytics_events_name_time` (`event_name`, `occurred_at`),
  KEY `idx_analytics_events_user_time` (`user_id`, `occurred_at`),
  KEY `idx_analytics_events_occurred` (`occurred_at`),
  CONSTRAINT `analytics_events_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
