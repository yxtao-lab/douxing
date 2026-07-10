-- M1 · 发单接单供给入驻（资质附件 + 审核字段）
ALTER TABLE `biz_org`
  ADD COLUMN `contact_phone` varchar(32) NULL,
  ADD COLUMN `description` text NULL,
  ADD COLUMN `review_note` text NULL,
  ADD COLUMN `reviewed_at` timestamp NULL,
  ADD COLUMN `reviewed_by` int NULL;
--> statement-breakpoint
ALTER TABLE `biz_org`
  ADD CONSTRAINT `biz_org_reviewed_by_users_id_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `service_provider`
  ADD COLUMN `display_name` varchar(64) NULL,
  ADD COLUMN `bio` text NULL,
  ADD COLUMN `portfolio_urls` json NULL,
  ADD COLUMN `review_note` text NULL,
  ADD COLUMN `reviewed_at` timestamp NULL,
  ADD COLUMN `reviewed_by` int NULL;
--> statement-breakpoint
ALTER TABLE `service_provider`
  ADD CONSTRAINT `service_provider_reviewed_by_users_id_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;
--> statement-breakpoint
CREATE TABLE `biz_org_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `org_id` int NOT NULL,
  `doc_type` varchar(32) NOT NULL,
  `file_url` varchar(512) NOT NULL,
  `file_name` varchar(256) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_biz_org_documents_org_type` (`org_id`, `doc_type`),
  CONSTRAINT `biz_org_documents_org_id_biz_org_id_fk` FOREIGN KEY (`org_id`) REFERENCES `biz_org` (`id`) ON DELETE CASCADE
);
