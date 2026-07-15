-- M7-3 · 服务订单领队指派
ALTER TABLE `service_order`
  ADD COLUMN `assigned_guide_user_id` int NULL AFTER `seller_provider_user_id`,
  ADD COLUMN `assigned_at` timestamp NULL AFTER `assigned_guide_user_id`,
  ADD KEY `idx_service_order_assigned_guide` (`assigned_guide_user_id`),
  ADD CONSTRAINT `service_order_assigned_guide_user_id_users_id_fk`
    FOREIGN KEY (`assigned_guide_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;
