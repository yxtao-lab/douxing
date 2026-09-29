ALTER TABLE `users` ADD `bonus_plan_candidates` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `bonus_photo_count` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `bonus_photo_bytes` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `poster_sticker_unlocked` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
CREATE TABLE `point_redemptions` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`product_id` varchar(64) NOT NULL,
	`points_spent` int NOT NULL,
	`dedupe_key` varchar(191) NOT NULL,
	`meta` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `point_redemptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_point_redemptions_dedupe` UNIQUE(`dedupe_key`)
);--> statement-breakpoint
CREATE INDEX `idx_point_redemptions_user_time` ON `point_redemptions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_point_redemptions_product` ON `point_redemptions` (`product_id`);--> statement-breakpoint
ALTER TABLE `point_redemptions` ADD CONSTRAINT `point_redemptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
