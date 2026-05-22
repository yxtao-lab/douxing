CREATE TABLE `badges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`badge_code` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`category` varchar(32) NOT NULL DEFAULT 'achievement',
	`condition_type` varchar(50) NOT NULL,
	`condition_value` json,
	`icon_url` varchar(500),
	`rarity` varchar(32) NOT NULL DEFAULT 'common',
	`points_reward` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `badges_id` PRIMARY KEY(`id`),
	CONSTRAINT `badges_badge_code_unique` UNIQUE(`badge_code`)
);
--> statement-breakpoint
CREATE TABLE `user_badges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`badge_id` int NOT NULL,
	`unlock_time` timestamp NOT NULL DEFAULT (now()),
	`progress` json,
	`is_displayed` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_badges_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_user_badge` UNIQUE(`user_id`,`badge_id`)
);
--> statement-breakpoint
ALTER TABLE `user_badges` ADD CONSTRAINT `user_badges_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_badges` ADD CONSTRAINT `user_badges_badge_id_badges_id_fk` FOREIGN KEY (`badge_id`) REFERENCES `badges`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_user_badges_user` ON `user_badges` (`user_id`);
