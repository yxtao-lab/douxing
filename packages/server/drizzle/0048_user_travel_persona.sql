CREATE TABLE `user_travel_persona` (
	`id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
	`user_id` int NOT NULL,
	`persona_version` int NOT NULL DEFAULT 1,
	`travel_style` varchar(64),
	`rhythm` varchar(32) NOT NULL DEFAULT 'balanced',
	`budget_tier` varchar(32) NOT NULL DEFAULT 'mid-range',
	`budget_flexibility` varchar(32) NOT NULL DEFAULT 'flexible',
	`companion_structure` json,
	`top_destinations` json,
	`top_poi_types` json,
	`interest_tags` json,
	`memory_themes` json,
	`avoid_list` json,
	`photo_enthusiasm` varchar(32) NOT NULL DEFAULT 'medium',
	`route_count` int NOT NULL DEFAULT 0,
	`checkin_count` int NOT NULL DEFAULT 0,
	`photo_count` int NOT NULL DEFAULT 0,
	`summary` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE now(),
	CONSTRAINT `user_travel_persona_user_id_unique` UNIQUE(`user_id`),
	CONSTRAINT `user_travel_persona_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
);
--> statement-breakpoint
CREATE INDEX `user_travel_persona_user_id_index` ON `user_travel_persona` (`user_id`);
