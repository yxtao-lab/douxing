-- M0 · 发单接单平台领域建模（模块 B）
CREATE TABLE `biz_org` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(128) NOT NULL,
  `org_type` varchar(32) NOT NULL,
  `license_no` varchar(64) NULL,
  `status` varchar(16) NOT NULL DEFAULT 'pending',
  `settlement_config` json NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_biz_org_status_type` (`status`, `org_type`)
);
--> statement-breakpoint
CREATE TABLE `org_member` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `org_id` int NOT NULL,
  `org_role` varchar(16) NOT NULL DEFAULT 'staff',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_org_member_org_user` (`org_id`, `user_id`),
  KEY `idx_org_member_user` (`user_id`),
  CONSTRAINT `org_member_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `org_member_org_id_biz_org_id_fk` FOREIGN KEY (`org_id`) REFERENCES `biz_org` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `service_provider` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `provider_type` varchar(32) NOT NULL,
  `org_id` int NULL,
  `cert_status` varchar(16) NOT NULL DEFAULT 'pending',
  `credit_score` int NOT NULL DEFAULT 100,
  `category_codes` json NOT NULL,
  `service_regions` json NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_service_provider_user` (`user_id`),
  KEY `idx_service_provider_org` (`org_id`),
  KEY `idx_service_provider_cert` (`cert_status`),
  CONSTRAINT `service_provider_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `service_provider_org_id_biz_org_id_fk` FOREIGN KEY (`org_id`) REFERENCES `biz_org` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `demand_group` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(128) NOT NULL,
  `group_type` varchar(32) NOT NULL DEFAULT 'other',
  `headcount` int NULL,
  `owner_user_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_demand_group_owner` (`owner_user_id`),
  CONSTRAINT `demand_group_owner_user_id_users_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `group_member` (
  `id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `user_id` int NOT NULL,
  `member_role` varchar(16) NOT NULL DEFAULT 'collaborator',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_group_member_group_user` (`group_id`, `user_id`),
  CONSTRAINT `group_member_group_id_demand_group_id_fk` FOREIGN KEY (`group_id`) REFERENCES `demand_group` (`id`) ON DELETE CASCADE,
  CONSTRAINT `group_member_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `service_demand` (
  `id` int NOT NULL AUTO_INCREMENT,
  `demand_no` varchar(32) NOT NULL,
  `publisher_type` varchar(16) NOT NULL DEFAULT 'user',
  `publisher_user_id` int NOT NULL,
  `publisher_group_id` int NULL,
  `category_code` varchar(64) NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text NULL,
  `destination` varchar(128) NULL,
  `start_date` date NULL,
  `end_date` date NULL,
  `budget_min` decimal(12, 2) NULL,
  `budget_max` decimal(12, 2) NULL,
  `budget_type` varchar(16) NULL,
  `status` varchar(16) NOT NULL DEFAULT 'draft',
  `route_id` int NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_service_demand_no` (`demand_no`),
  KEY `idx_service_demand_status_publisher` (`status`, `publisher_user_id`),
  KEY `idx_service_demand_category` (`category_code`),
  CONSTRAINT `service_demand_publisher_user_id_users_id_fk` FOREIGN KEY (`publisher_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `service_demand_publisher_group_id_demand_group_id_fk` FOREIGN KEY (`publisher_group_id`) REFERENCES `demand_group` (`id`) ON DELETE SET NULL,
  CONSTRAINT `service_demand_route_id_travel_routes_id_fk` FOREIGN KEY (`route_id`) REFERENCES `travel_routes` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `demand_quote` (
  `id` int NOT NULL AUTO_INCREMENT,
  `demand_id` int NOT NULL,
  `org_id` int NULL,
  `provider_user_id` int NULL,
  `amount` decimal(12, 2) NOT NULL,
  `proposal_text` text NULL,
  `status` varchar(16) NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_demand_quote_demand` (`demand_id`),
  CONSTRAINT `demand_quote_demand_id_service_demand_id_fk` FOREIGN KEY (`demand_id`) REFERENCES `service_demand` (`id`) ON DELETE CASCADE,
  CONSTRAINT `demand_quote_org_id_biz_org_id_fk` FOREIGN KEY (`org_id`) REFERENCES `biz_org` (`id`) ON DELETE SET NULL,
  CONSTRAINT `demand_quote_provider_user_id_users_id_fk` FOREIGN KEY (`provider_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `service_order` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_no` varchar(32) NOT NULL,
  `demand_id` int NOT NULL,
  `quote_id` int NULL,
  `buyer_user_id` int NOT NULL,
  `seller_org_id` int NULL,
  `seller_provider_user_id` int NULL,
  `total_amount` decimal(12, 2) NOT NULL,
  `platform_fee` decimal(12, 2) NOT NULL DEFAULT 0.00,
  `status` varchar(16) NOT NULL DEFAULT 'pending_pay',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_service_order_no` (`order_no`),
  KEY `idx_service_order_demand` (`demand_id`),
  KEY `idx_service_order_buyer` (`buyer_user_id`),
  CONSTRAINT `service_order_demand_id_service_demand_id_fk` FOREIGN KEY (`demand_id`) REFERENCES `service_demand` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `service_order_quote_id_demand_quote_id_fk` FOREIGN KEY (`quote_id`) REFERENCES `demand_quote` (`id`) ON DELETE SET NULL,
  CONSTRAINT `service_order_buyer_user_id_users_id_fk` FOREIGN KEY (`buyer_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `service_order_seller_org_id_biz_org_id_fk` FOREIGN KEY (`seller_org_id`) REFERENCES `biz_org` (`id`) ON DELETE SET NULL,
  CONSTRAINT `service_order_seller_provider_user_id_users_id_fk` FOREIGN KEY (`seller_provider_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
