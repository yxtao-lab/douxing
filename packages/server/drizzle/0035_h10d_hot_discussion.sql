-- H10-d：评论点赞/精选 + POI 外链讨论
ALTER TABLE `route_comments`
  ADD COLUMN `like_count` int NOT NULL DEFAULT 0,
  ADD COLUMN `is_featured` tinyint NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX `idx_route_comments_hot` ON `route_comments` (`route_id`, `is_featured`, `like_count`);
--> statement-breakpoint
CREATE TABLE `route_comment_likes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `comment_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `route_comment_likes_id` PRIMARY KEY(`id`),
  CONSTRAINT `route_comment_likes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action,
  CONSTRAINT `route_comment_likes_comment_id_route_comments_id_fk` FOREIGN KEY (`comment_id`) REFERENCES `route_comments`(`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uk_route_comment_likes_user_comment` ON `route_comment_likes` (`user_id`, `comment_id`);
--> statement-breakpoint
CREATE TABLE `route_poi_external_links` (
  `id` int AUTO_INCREMENT NOT NULL,
  `route_id` int NOT NULL,
  `user_id` int NOT NULL,
  `day_index` int,
  `attraction_id` int,
  `poi_name` varchar(128),
  `title` varchar(128) NOT NULL,
  `url` varchar(512) NOT NULL,
  `platform` varchar(32) NOT NULL DEFAULT 'other',
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `route_poi_external_links_id` PRIMARY KEY(`id`),
  CONSTRAINT `route_poi_external_links_route_id_travel_routes_id_fk` FOREIGN KEY (`route_id`) REFERENCES `travel_routes`(`id`) ON DELETE cascade ON UPDATE no action,
  CONSTRAINT `route_poi_external_links_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX `idx_route_poi_external_links_route` ON `route_poi_external_links` (`route_id`, `attraction_id`, `day_index`);
