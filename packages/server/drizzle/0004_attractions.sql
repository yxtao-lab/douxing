CREATE TABLE `attractions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`city` varchar(64) NOT NULL,
	`city_code` varchar(32) NOT NULL,
	`latitude` decimal(10,7) NOT NULL,
	`longitude` decimal(10,7) NOT NULL,
	`tags` json NOT NULL,
	`description` text,
	`ticket_price` int NOT NULL DEFAULT 0,
	`aliases` json,
	`status` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attractions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_attractions_city` ON `attractions` (`city`);--> statement-breakpoint
CREATE INDEX `idx_attractions_city_code` ON `attractions` (`city_code`);--> statement-breakpoint
CREATE INDEX `idx_attractions_name` ON `attractions` (`name`);--> statement-breakpoint
ALTER TABLE `check_ins` ADD `attraction_id` int;--> statement-breakpoint
ALTER TABLE `check_ins` ADD CONSTRAINT `check_ins_attraction_id_attractions_id_fk` FOREIGN KEY (`attraction_id`) REFERENCES `attractions`(`id`) ON DELETE set null ON UPDATE no action;
