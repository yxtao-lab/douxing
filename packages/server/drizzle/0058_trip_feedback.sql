CREATE TABLE `trip_feedbacks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`route_id` int NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'draft',
	`planned_count` int NOT NULL DEFAULT 0,
	`visited_count` int NOT NULL DEFAULT 0,
	`skipped_count` int NOT NULL DEFAULT 0,
	`completion_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
	`visited_json` json NOT NULL,
	`skipped_json` json NOT NULL,
	`rating_summary_json` json NOT NULL,
	`summary_text` text NOT NULL,
	`golden_payload_json` json,
	`memory_ids_json` json,
	`finalized_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trip_feedbacks_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_trip_feedbacks_user_route` UNIQUE(`user_id`,`route_id`)
);--> statement-breakpoint
CREATE INDEX `idx_trip_feedbacks_user_time` ON `trip_feedbacks` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_trip_feedbacks_status` ON `trip_feedbacks` (`status`);--> statement-breakpoint
ALTER TABLE `trip_feedbacks` ADD CONSTRAINT `trip_feedbacks_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trip_feedbacks` ADD CONSTRAINT `trip_feedbacks_route_id_travel_routes_id_fk` FOREIGN KEY (`route_id`) REFERENCES `travel_routes`(`id`) ON DELETE cascade ON UPDATE no action;
