CREATE TABLE `route_playbooks` (
  `id` varchar(64) NOT NULL,
  `city` varchar(64) NOT NULL,
  `scope` varchar(128) NOT NULL,
  `keywords` json NOT NULL,
  `themes` json NOT NULL,
  `classic_order` json NOT NULL,
  `segments` json NOT NULL,
  `summary_zh` text NOT NULL,
  `summary_en` text NOT NULL,
  `enabled` tinyint NOT NULL DEFAULT 1,
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_route_playbooks_city` (`city`),
  KEY `idx_route_playbooks_enabled` (`enabled`)
);
