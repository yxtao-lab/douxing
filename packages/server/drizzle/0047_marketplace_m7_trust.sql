-- M-TRUST-01 · 履约评价与争议处理（M7 扩展）
CREATE TABLE `service_order_review` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `target_type` varchar(16) NOT NULL,
  `from_user_id` int NOT NULL,
  `to_target_type` varchar(16) NOT NULL,
  `to_user_id` int NULL,
  `to_org_id` int NULL,
  `rating` int NOT NULL,
  `content` text,
  `tags` json,
  `reply_content` text,
  `reply_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_service_order_review_order_target` (`order_id`, `target_type`),
  KEY `idx_service_order_review_order` (`order_id`),
  KEY `idx_service_order_review_from_user` (`from_user_id`),
  KEY `idx_service_order_review_to_user` (`to_user_id`),
  KEY `idx_service_order_review_to_org` (`to_org_id`),
  CONSTRAINT `service_order_review_order_id_fk`
    FOREIGN KEY (`order_id`) REFERENCES `service_order` (`id`) ON DELETE CASCADE,
  CONSTRAINT `service_order_review_from_user_id_fk`
    FOREIGN KEY (`from_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `service_order_review_to_user_id_fk`
    FOREIGN KEY (`to_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `service_order_review_to_org_id_fk`
    FOREIGN KEY (`to_org_id`) REFERENCES `biz_org` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint

CREATE TABLE `service_order_dispute` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `initiator_user_id` int NOT NULL,
  `respondent_type` varchar(16) NOT NULL,
  `respondent_user_id` int NULL,
  `respondent_org_id` int NULL,
  `type` varchar(32) NOT NULL,
  `reason` text,
  `status` varchar(32) NOT NULL DEFAULT 'pending',
  `platform_note` text,
  `resolved_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_service_order_dispute_order` (`order_id`),
  KEY `idx_service_order_dispute_initiator` (`initiator_user_id`),
  KEY `idx_service_order_dispute_respondent_user` (`respondent_user_id`),
  KEY `idx_service_order_dispute_respondent_org` (`respondent_org_id`),
  KEY `idx_service_order_dispute_status` (`status`),
  CONSTRAINT `service_order_dispute_order_id_fk`
    FOREIGN KEY (`order_id`) REFERENCES `service_order` (`id`) ON DELETE CASCADE,
  CONSTRAINT `service_order_dispute_initiator_user_id_fk`
    FOREIGN KEY (`initiator_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `service_order_dispute_respondent_user_id_fk`
    FOREIGN KEY (`respondent_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `service_order_dispute_respondent_org_id_fk`
    FOREIGN KEY (`respondent_org_id`) REFERENCES `biz_org` (`id`) ON DELETE SET NULL
);
