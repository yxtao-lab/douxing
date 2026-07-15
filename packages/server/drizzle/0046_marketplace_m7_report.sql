-- M7-4 · 服务订单履约汇报（行中签到 + 图文）
CREATE TABLE `service_order_report` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `author_user_id` int NOT NULL,
  `report_type` varchar(16) NOT NULL,
  `content` text,
  `photos` json,
  `latitude` decimal(10,7) NULL,
  `longitude` decimal(10,7) NULL,
  `place_name` varchar(256) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_service_order_report_order` (`order_id`),
  KEY `idx_service_order_report_author` (`author_user_id`),
  CONSTRAINT `service_order_report_order_id_fk`
    FOREIGN KEY (`order_id`) REFERENCES `service_order` (`id`) ON DELETE CASCADE,
  CONSTRAINT `service_order_report_author_user_id_fk`
    FOREIGN KEY (`author_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
);
