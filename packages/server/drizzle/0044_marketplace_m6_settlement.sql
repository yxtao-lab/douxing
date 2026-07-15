-- M6 · 商户结算台账（confirmed 后待结算）
CREATE TABLE `org_settlement` (
  `id` int NOT NULL AUTO_INCREMENT,
  `org_id` int NOT NULL,
  `order_id` int NOT NULL,
  `order_no` varchar(32) NOT NULL,
  `gross_amount` decimal(12,2) NOT NULL,
  `platform_fee` decimal(12,2) NOT NULL,
  `net_amount` decimal(12,2) NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `settled_at` timestamp NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_org_settlement_order` (`order_id`),
  KEY `idx_org_settlement_org` (`org_id`),
  KEY `idx_org_settlement_status` (`status`),
  CONSTRAINT `org_settlement_org_id_biz_org_id_fk` FOREIGN KEY (`org_id`) REFERENCES `biz_org` (`id`) ON DELETE CASCADE,
  CONSTRAINT `org_settlement_order_id_service_order_id_fk` FOREIGN KEY (`order_id`) REFERENCES `service_order` (`id`) ON DELETE RESTRICT
);
