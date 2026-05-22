CREATE TABLE `plan_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`route_id` int,
	`provider` varchar(16),
	`status` tinyint NOT NULL DEFAULT 0,
	`title` varchar(128),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plan_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plan_session_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` int NOT NULL,
	`role` varchar(16) NOT NULL,
	`content` text NOT NULL,
	`route_snapshot` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `plan_session_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `plan_sessions` ADD CONSTRAINT `plan_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `plan_sessions` ADD CONSTRAINT `plan_sessions_route_id_travel_routes_id_fk` FOREIGN KEY (`route_id`) REFERENCES `travel_routes`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `plan_session_messages` ADD CONSTRAINT `plan_session_messages_session_id_plan_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `plan_sessions`(`id`) ON DELETE cascade ON UPDATE no action;
