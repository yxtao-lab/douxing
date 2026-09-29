ALTER TABLE `users` ADD `verification_points` int NOT NULL DEFAULT 0;--> statement-breakpoint
CREATE TABLE `verification_point_events` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`event_type` varchar(64) NOT NULL,
	`points` int NOT NULL,
	`balance_after` int NOT NULL,
	`dedupe_key` varchar(191) NOT NULL,
	`route_id` int,
	`check_in_id` int,
	`attraction_id` int,
	`meta` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `verification_point_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_verification_point_events_dedupe` UNIQUE(`dedupe_key`)
);--> statement-breakpoint
CREATE INDEX `idx_verification_point_events_user_time` ON `verification_point_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_verification_point_events_route` ON `verification_point_events` (`route_id`);--> statement-breakpoint
CREATE INDEX `idx_verification_point_events_type` ON `verification_point_events` (`event_type`);--> statement-breakpoint
ALTER TABLE `verification_point_events` ADD CONSTRAINT `verification_point_events_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `verification_point_events` ADD CONSTRAINT `verification_point_events_route_id_travel_routes_id_fk` FOREIGN KEY (`route_id`) REFERENCES `travel_routes`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `verification_point_events` ADD CONSTRAINT `verification_point_events_check_in_id_check_ins_id_fk` FOREIGN KEY (`check_in_id`) REFERENCES `check_ins`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `verification_point_events` ADD CONSTRAINT `verification_point_events_attraction_id_attractions_id_fk` FOREIGN KEY (`attraction_id`) REFERENCES `attractions`(`id`) ON DELETE set null ON UPDATE no action;
