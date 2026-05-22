CREATE TABLE `achievement_definitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`achievement_code` varchar(64) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`category` varchar(32) NOT NULL DEFAULT 'explore',
	`condition_type` varchar(50) NOT NULL,
	`condition_value` json,
	`icon_url` varchar(500),
	`points_reward` int NOT NULL DEFAULT 0,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `achievement_definitions_id` PRIMARY KEY(`id`),
	CONSTRAINT `achievement_definitions_achievement_code_unique` UNIQUE(`achievement_code`)
);
