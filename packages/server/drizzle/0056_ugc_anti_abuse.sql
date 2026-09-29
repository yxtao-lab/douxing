CREATE TABLE `route_reports` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`route_id` int NOT NULL,
	`reporter_user_id` int NOT NULL,
	`reason` varchar(32) NOT NULL,
	`detail` text,
	`status` varchar(16) NOT NULL DEFAULT 'open',
	`resolver_user_id` int,
	`resolve_note` varchar(512),
	`resolved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `route_reports_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `idx_route_reports_route_status` ON `route_reports` (`route_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_route_reports_reporter` ON `route_reports` (`reporter_user_id`);--> statement-breakpoint
CREATE INDEX `idx_route_reports_status` ON `route_reports` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `uk_route_reports_reporter_reason` ON `route_reports` (`route_id`,`reporter_user_id`,`reason`);--> statement-breakpoint
ALTER TABLE `route_reports` ADD CONSTRAINT `route_reports_route_id_travel_routes_id_fk` FOREIGN KEY (`route_id`) REFERENCES `travel_routes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `route_reports` ADD CONSTRAINT `route_reports_reporter_user_id_users_id_fk` FOREIGN KEY (`reporter_user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `route_reports` ADD CONSTRAINT `route_reports_resolver_user_id_users_id_fk` FOREIGN KEY (`resolver_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `travel_routes` ADD `trust_demoted` tinyint NOT NULL DEFAULT 0;
