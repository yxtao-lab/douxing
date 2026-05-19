ALTER TABLE `users` RENAME COLUMN `password` TO `password_hash`;--> statement-breakpoint
ALTER TABLE `users` ADD `user_type` tinyint NOT NULL DEFAULT 1 AFTER `email`;--> statement-breakpoint
CREATE TABLE `travel_routes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`budget_range` varchar(64),
	`days` int NOT NULL DEFAULT 1,
	`interest_tags` json,
	`route_detail` json,
	`creator_id` int NOT NULL,
	`status` tinyint NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `travel_routes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `check_ins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`route_id` int NOT NULL,
	`location` json NOT NULL,
	`checked_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`status` tinyint NOT NULL DEFAULT 0,
	`remark` varchar(512),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `check_ins_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `achievements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`achievement_type` varchar(64) NOT NULL,
	`unlocked_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`description` text,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `achievements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `travel_routes` ADD CONSTRAINT `travel_routes_creator_id_users_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `check_ins` ADD CONSTRAINT `check_ins_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `check_ins` ADD CONSTRAINT `check_ins_route_id_travel_routes_id_fk` FOREIGN KEY (`route_id`) REFERENCES `travel_routes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `achievements` ADD CONSTRAINT `achievements_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
