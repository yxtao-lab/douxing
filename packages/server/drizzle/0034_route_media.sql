CREATE TABLE `route_media` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `route_id` int NOT NULL,
  `scope` varchar(8) NOT NULL,
  `day_index` int NULL,
  `attraction_id` int NULL,
  `poi_name` varchar(128) NULL,
  `stored_video_url` varchar(512) NOT NULL,
  `cover_url` varchar(512) NULL,
  `duration_sec` int NOT NULL,
  `byte_size` int NOT NULL,
  `status` tinyint NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `route_media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `route_media` ADD CONSTRAINT `route_media_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `route_media` ADD CONSTRAINT `route_media_route_id_travel_routes_id_fk` FOREIGN KEY (`route_id`) REFERENCES `travel_routes`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `idx_route_media_route` ON `route_media` (`route_id`, `status`);
--> statement-breakpoint
CREATE INDEX `idx_route_media_poi` ON `route_media` (`route_id`, `attraction_id`, `day_index`, `status`);
