ALTER TABLE `travel_routes` ADD `view_count` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `travel_routes` ADD `like_count` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `travel_routes` ADD `collect_count` int NOT NULL DEFAULT 0;--> statement-breakpoint
CREATE TABLE `route_likes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`route_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `route_likes_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE TABLE `route_favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`route_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `route_favorites_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
ALTER TABLE `route_likes` ADD CONSTRAINT `route_likes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `route_likes` ADD CONSTRAINT `route_likes_route_id_travel_routes_id_fk` FOREIGN KEY (`route_id`) REFERENCES `travel_routes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `route_favorites` ADD CONSTRAINT `route_favorites_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `route_favorites` ADD CONSTRAINT `route_favorites_route_id_travel_routes_id_fk` FOREIGN KEY (`route_id`) REFERENCES `travel_routes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX `uk_route_likes_user_route` ON `route_likes` (`user_id`,`route_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uk_route_favorites_user_route` ON `route_favorites` (`user_id`,`route_id`);
