CREATE TABLE `analytics_daily_metrics` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `metric_date` date NOT NULL,
  `users_new` int NOT NULL DEFAULT 0,
  `routes_new` int NOT NULL DEFAULT 0,
  `orders_new` int NOT NULL DEFAULT 0,
  `checkins_new` int NOT NULL DEFAULT 0,
  `plan_sessions_new` int NOT NULL DEFAULT 0,
  `rolled_up_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_analytics_daily_metrics_date` (`metric_date`),
  KEY `idx_analytics_daily_metrics_date` (`metric_date`)
);
