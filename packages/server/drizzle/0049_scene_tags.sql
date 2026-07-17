ALTER TABLE `attractions` ADD COLUMN `scene_tags` json AFTER `tags`--> statement-breakpoint
ALTER TABLE `travel_routes` ADD COLUMN `scene_tags` json AFTER `interest_tags`--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `preferred_scenes` json AFTER `interest_tags`;
