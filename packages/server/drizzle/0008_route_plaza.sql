ALTER TABLE `travel_routes` ADD `is_public` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `travel_routes` ADD `comment_count` int NOT NULL DEFAULT 0;--> statement-breakpoint
CREATE TABLE `route_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`route_id` int NOT NULL,
	`user_id` int NOT NULL,
	`content` varchar(500) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `route_comments_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
ALTER TABLE `route_comments` ADD CONSTRAINT `route_comments_route_id_travel_routes_id_fk` FOREIGN KEY (`route_id`) REFERENCES `travel_routes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `route_comments` ADD CONSTRAINT `route_comments_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_route_comments_route_created` ON `route_comments` (`route_id`,`created_at`);
