-- M5 · 标品上架（service_product + SKU）与订单直购字段
CREATE TABLE `service_product` (
  `id` int NOT NULL AUTO_INCREMENT,
  `org_id` int NOT NULL,
  `category_code` varchar(64) NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text,
  `cover_url` varchar(512),
  `destination` varchar(128),
  `status` varchar(16) NOT NULL DEFAULT 'draft',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_service_product_org` (`org_id`),
  KEY `idx_service_product_status` (`status`),
  KEY `idx_service_product_category` (`category_code`),
  CONSTRAINT `service_product_org_id_biz_org_id_fk` FOREIGN KEY (`org_id`) REFERENCES `biz_org` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `service_product_sku` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `name` varchar(128) NOT NULL,
  `price` decimal(12,2) NOT NULL,
  `stock` int NOT NULL DEFAULT 0,
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_service_product_sku_product` (`product_id`),
  CONSTRAINT `service_product_sku_product_id_service_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `service_product` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `service_order`
  MODIFY COLUMN `demand_id` int NULL,
  ADD COLUMN `product_id` int NULL,
  ADD COLUMN `sku_id` int NULL;
--> statement-breakpoint
ALTER TABLE `service_order`
  ADD KEY `idx_service_order_product` (`product_id`),
  ADD CONSTRAINT `service_order_product_id_service_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `service_product` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `service_order_sku_id_service_product_sku_id_fk` FOREIGN KEY (`sku_id`) REFERENCES `service_product_sku` (`id`) ON DELETE SET NULL;
