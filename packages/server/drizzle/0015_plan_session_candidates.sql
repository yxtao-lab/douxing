CREATE TABLE `plan_session_candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` int NOT NULL,
	`route_id` int NOT NULL,
	`label` varchar(64) NOT NULL,
	`variant_key` varchar(32),
	`sort_order` tinyint NOT NULL DEFAULT 0,
	`is_selected` tinyint NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `plan_session_candidates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `plan_session_candidates` ADD CONSTRAINT `plan_session_candidates_session_id_plan_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `plan_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `plan_session_candidates` ADD CONSTRAINT `plan_session_candidates_route_id_travel_routes_id_fk` FOREIGN KEY (`route_id`) REFERENCES `travel_routes`(`id`) ON DELETE cascade ON UPDATE no action;
